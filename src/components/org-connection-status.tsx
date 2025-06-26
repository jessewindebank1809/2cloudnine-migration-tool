'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenHealthDetail {
  orgId: string;
  orgName: string;
  lastRefreshAttempt?: string;
  lastSuccessfulRefresh?: string;
  refreshFailureCount: number;
  requiresReconnect: boolean;
  error?: string;
  orgDetails?: {
    id: string;
    name: string;
    salesforce_org_id: string;
    org_type: string;
    instance_url: string;
    updated_at: string;
    token_expires_at?: string;
  };
}

interface TokenHealthReport {
  totalOrgs: number;
  healthyOrgs: number;
  unhealthyOrgs: number;
  requireReconnect: number;
  details: TokenHealthDetail[];
}

export function OrgConnectionStatus() {
  const [healthReport, setHealthReport] = useState<TokenHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealthReport = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/token-health');
      const data = await response.json();
      
      if (data.success) {
        setHealthReport(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch health report');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthReport();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchHealthReport, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = (orgId: string) => {
    // Navigate to reconnect page or trigger reconnect flow
    window.location.href = `/organisations/${orgId}/reconnect`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          Loading connection status...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!healthReport) {
    return null;
  }

  const hasIssues = healthReport.unhealthyOrgs > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Organisation Connection Status</CardTitle>
            <CardDescription>
              {healthReport.healthyOrgs} of {healthReport.totalOrgs} organisations connected
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHealthReport}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasIssues ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">All organisations connected</AlertTitle>
            <AlertDescription className="text-green-700">
              All tokens are refreshing successfully.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {healthReport.requireReconnect > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  {healthReport.requireReconnect} organisation{healthReport.requireReconnect > 1 ? 's' : ''} require reconnection.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              {healthReport.details.map((detail) => (
                <div
                  key={detail.orgId}
                  className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{detail.orgName}</span>
                      {detail.orgDetails && (
                        <Badge variant="outline" className="text-xs">
                          {detail.orgDetails.org_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {detail.error || 'Connection issue detected'}
                    </p>
                    {detail.refreshFailureCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Failed {detail.refreshFailureCount} refresh attempt{detail.refreshFailureCount > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  {detail.requiresReconnect && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReconnect(detail.orgId)}
                    >
                      Reconnect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}