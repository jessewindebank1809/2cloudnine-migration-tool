'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, ExternalLink, Trash2, Check, X } from 'lucide-react';
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



  const { data, isLoading: isOrgsLoading, error, refetch } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const response = await fetch('/api/organisations');
      if (!response.ok) throw new Error('Failed to fetch organisations');
      return response.json();
    },
  });

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
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

      {/* Organisations Grid */}
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
        <div className="grid gap-6 md:grid-cols-2">
          {organisations.map((org: Organisation) => (
            <Card key={org.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {editingOrgId === org.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="text-lg font-semibold flex-1"
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
                      <CardTitle 
                        className="text-lg truncate cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleEditClick(org)}
                      >
                        {org.name}
                      </CardTitle>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={org.org_type === 'PRODUCTION' ? 'default' : 'secondary'}>
                        {org.org_type === 'PRODUCTION' ? 'Production' : 'Sandbox'}
                      </Badge>
                      <Badge 
                        variant={org.salesforce_org_id ? 'secondary' : 'destructive'}
                        className={org.salesforce_org_id ? 'bg-green-500 text-white hover:bg-green-600' : ''}
                      >
                        {org.salesforce_org_id ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteOrg(org.id, org.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Instance URL</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground truncate">
                        {org.instance_url}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => window.open(org.instance_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">Org ID</p>
                    <p className="text-sm text-muted-foreground">
                      {org.salesforce_org_id || 'Not connected'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {org.created_at ? new Date(org.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric'
                        }) : 'Unknown'}
                      </p>
                    </div>
                    {!org.salesforce_org_id && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReconnect(org)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Reconnect
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 