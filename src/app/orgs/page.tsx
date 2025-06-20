'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, ExternalLink, Trash2, Check, X, Edit2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Organisation {
  id: string;
  name: string;
  org_type: 'PRODUCTION' | 'SANDBOX';
  instance_url: string;
  salesforce_org_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function OrganisationsPage() {
  const searchParams = useSearchParams();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    orgType: 'PRODUCTION' as 'PRODUCTION' | 'SANDBOX',
  });

  // Check for connect parameter to auto-open dialog
  useEffect(() => {
    const shouldConnect = searchParams.get('connect');
    if (shouldConnect === 'true') {
      setIsConnectDialogOpen(true);
    }
  }, [searchParams]);



  // Handle OAuth callback errors
  const oauthError = searchParams.get('error');
  const getErrorMessage = (error: string) => {
    switch (error) {
      case 'org_already_connected':
        return 'You have already connected this Salesforce organisation. Each organisation can only be connected once per user account.';
      case 'session_mismatch':
        return 'Session mismatch detected. Please refresh the page and try again. If the problem persists, sign out and sign in again.';
      case 'session_validation_failed':
        return 'Session validation failed. Please sign out and sign in again to resolve this issue.';
      case 'session_management_issue':
        return 'A session management issue was detected. Please refresh the page and try again. If this continues, clear your browser cache and sign in again.';
      case 'critical_session_error':
        return 'Critical session error detected. Please sign out completely, clear your browser cache, and sign in again.';
      case 'state_expired':
        return 'Authentication session expired. Please try connecting again.';
      case 'oauth_failed':
        return 'OAuth authentication failed. Please try again.';
      case 'token_exchange_failed':
        return 'Failed to exchange authorization code for tokens. Please try again.';
      case 'callback_failed':
        return 'OAuth callback failed. Please try again.';
      case 'userinfo_failed':
        return 'Failed to retrieve user information from Salesforce.';
      case 'org_not_found':
        return 'Organisation not found. Please try creating a new organisation.';
      case 'invalid_state':
        return 'Invalid OAuth state parameter. Please try again.';
      case 'missing_params':
        return 'Missing required OAuth parameters. Please try again.';
      case 'unauthorized':
        return 'You are not authorised to perform this action. Please sign in again.';
      case 'oauth_init_failed':
        return 'Failed to initiate OAuth authentication. Please try again.';
      case 'org_not_connected':
        return 'This organisation is not properly connected to Salesforce. Please reconnect to fix this issue.';
      default:
        return 'An unknown error occurred during authentication.';
    }
  };

  const { data, isLoading: isOrgsLoading, error, refetch } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const response = await fetch('/api/organisations');
      if (!response.ok) throw new Error('Failed to fetch organisations');
      return response.json();
    },
  });

  // Check for reconnect parameter to auto-trigger reconnection
  useEffect(() => {
    const reconnectOrgId = searchParams.get('reconnect');
    const errorOrgId = searchParams.get('orgId');
    const error = searchParams.get('error');
    
    if (reconnectOrgId && data?.organisations) {
      const orgToReconnect = data.organisations.find((org: Organisation) => org.id === reconnectOrgId);
      if (orgToReconnect) {
        console.log(`Auto-reconnecting organisation: ${orgToReconnect.name}`);
        handleReconnect(orgToReconnect);
      }
    }
    
    // Handle org_not_connected error by auto-triggering reconnection
    if (error === 'org_not_connected' && errorOrgId && data?.organisations) {
      const orgToReconnect = data.organisations.find((org: Organisation) => org.id === errorOrgId);
      if (orgToReconnect) {
        console.log(`Organisation not connected, auto-reconnecting: ${orgToReconnect.name}`);
        handleReconnectForDisconnectedOrg(orgToReconnect);
      }
    }
  }, [searchParams, data]);

  const handleConnectOrg = async () => {
    try {
      // Auto-generate instance URL for production and sandbox
      const instanceUrl = formData.orgType === 'PRODUCTION' 
        ? 'https://login.salesforce.com'
        : 'https://test.salesforce.com';

      const response = await fetch('/api/organisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          orgType: formData.orgType,
          instanceUrl: instanceUrl,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setIsConnectDialogOpen(false);
        setFormData({ name: '', orgType: 'PRODUCTION' });
        
        // If OAuth URL is provided, redirect to authenticate with the org
        if (result.oauthUrl) {
          console.log('Redirecting to OAuth for organisation authentication...');
          window.location.href = result.oauthUrl;
        } else {
          refetch(); // Refresh the organisation list
        }
      }
    } catch (error) {
      console.error('Failed to connect organisation:', error);
    }
  };

  const handleReconnect = async (org: Organisation) => {
    // Trigger the OAuth flow for the selected organisation
    const oauthUrl = `/api/auth/oauth2/salesforce?orgId=${encodeURIComponent(org.id)}&instanceUrl=${encodeURIComponent(org.instance_url)}`;
    window.location.href = oauthUrl;
  };

  const handleReconnectForDisconnectedOrg = async (org: Organisation) => {
    // For disconnected orgs, use default URLs based on org type since instance_url might be null
    const defaultInstanceUrl = org.org_type === 'PRODUCTION' 
      ? 'https://login.salesforce.com'
      : 'https://test.salesforce.com';
    
    const oauthUrl = `/api/auth/oauth2/salesforce?orgId=${encodeURIComponent(org.id)}&instanceUrl=${encodeURIComponent(defaultInstanceUrl)}`;
    window.location.href = oauthUrl;
  };

  const handleEditClick = (org: Organisation) => {
    setEditingOrgId(org.id);
    setEditingName(org.name);
  };

  const handleSaveEdit = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organisations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      if (response.ok) {
        setEditingOrgId(null);
        setEditingName('');
        refetch(); // Refresh the organisation list
      } else {
        alert('Failed to update organisation name');
      }
    } catch (error) {
      console.error('Failed to update organisation:', error);
      alert('Failed to update organisation name');
    }
  };

  const handleCancelEdit = () => {
    setEditingOrgId(null);
    setEditingName('');
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/organisations/${orgId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        refetch(); // Refresh the organisation list
      } else {
        alert(`Failed to delete organisation: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete organisation:', error);
      alert('Failed to delete organisation. Please try again.');
    }
  };

  if (isOrgsLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Error</h1>
          <p>Failed to load organisations</p>
        </div>
      </div>
    );
  }

  const organisations = data?.organisations || [];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Organisations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your connected Salesforce organisations
          </p>
        </div>
        <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Connect Organisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect New Organisation</DialogTitle>
              <DialogDescription>
                Add a new Salesforce organisation to use for migrations. You will be redirected to authenticate with that specific org.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Production Org, Sandbox Environment"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Environment</Label>
                <RadioGroup
                  value={formData.orgType}
                  onValueChange={(value) => setFormData({ ...formData, orgType: value as 'PRODUCTION' | 'SANDBOX' })}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PRODUCTION" id="production" />
                    <Label htmlFor="production">Production/Developer</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SANDBOX" id="sandbox" />
                    <Label htmlFor="sandbox">Sandbox</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  {formData.orgType === 'PRODUCTION' 
                    ? 'Will connect to: https://login.salesforce.com' 
                    : 'Will connect to: https://test.salesforce.com'
                  }
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsConnectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConnectOrg}
                disabled={!formData.name}
              >
                Authorise
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Message */}
      {oauthError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm font-medium">
            {getErrorMessage(oauthError)}
          </p>
        </div>
      )}

      {/* Success Message */}
      {searchParams.get('success') === 'connected' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm font-medium">
            Organisation connected successfully!
          </p>
        </div>
      )}

      {/* Organisations Table */}
      {organisations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
            <p className="text-sm text-muted-foreground">No organisations connected yet</p>
            <Button onClick={() => setIsConnectDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Connect Your First Organisation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Connected Organisations ({organisations.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  <TableHead className="w-48">Instance URL</TableHead>
                  <TableHead>Org ID</TableHead>
                  <TableHead>Last Connected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organisations.map((org: Organisation) => (
                  <TableRow key={org.id} className="group">
                    <TableCell>
                      {editingOrgId === org.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(org.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <Button size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(org.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={handleCancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{org.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleEditClick(org)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.org_type === 'PRODUCTION' ? 'production' : 'sandbox'}>
                        {org.org_type === 'PRODUCTION' ? 'Production' : 'Sandbox'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        {org.salesforce_org_id ? (
                          <div title="Connected">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </div>
                        ) : (
                          <div title="Disconnected">
                            <XCircle className="h-4 w-4 text-red-500" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {org.instance_url}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => window.open(org.instance_url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {org.salesforce_org_id || 'Not connected'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {org.salesforce_org_id && org.updated_at ? new Date(org.updated_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric'
                        }) : 'Not connected'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleReconnect(org)}
                          className="text-blue-600 hover:text-blue-700 h-8 w-8"
                          title={org.salesforce_org_id ? "Refresh connection" : "Reconnect organisation"}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteOrg(org.id, org.name)}
                          className="text-destructive hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 