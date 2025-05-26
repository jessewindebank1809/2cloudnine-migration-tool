'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { ExecutionResult } from '@/lib/migration/templates/core/interfaces';

interface ExecutionSummaryProps {
  result: ExecutionResult & {
    stepResults: Array<{
      stepName: string;
      status: 'success' | 'partial' | 'failed';
      totalRecords: number;
      successfulRecords: number;
      failedRecords: number;
      executionTimeMs: number;
      errorCount: number;
    }>;
  };
  onRetry?: () => void;
  onDownloadReport?: () => void;
}

export function ExecutionSummary({ result, onRetry, onDownloadReport }: ExecutionSummaryProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <XCircle className="h-6 w-6 text-grey-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed Successfully</Badge>;
      case 'partial':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Completed with Errors</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const successRate = result.totalRecords > 0 
    ? Math.round((result.successfulRecords / result.totalRecords) * 100)
    : 0;

  const failedSteps = result.stepResults.filter(step => step.status === 'failed');
  const partialSteps = result.stepResults.filter(step => step.status === 'partial');
  const successfulSteps = result.stepResults.filter(step => step.status === 'success');

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(result.status)}
              <div>
                <CardTitle>Migration Complete</CardTitle>
                <CardDescription>
                  Execution finished in {formatDuration(result.executionTimeMs)}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(result.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{result.totalRecords.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Records</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.successfulRecords.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.failedRecords.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{successRate}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>

          {/* Step Summary */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{successfulSteps.length}</div>
              <div className="text-muted-foreground">Successful Steps</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">{partialSteps.length}</div>
              <div className="text-muted-foreground">Partial Steps</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{failedSteps.length}</div>
              <div className="text-muted-foreground">Failed Steps</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {onDownloadReport && (
              <Button variant="outline" onClick={onDownloadReport}>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            )}
            {onRetry && result.status !== 'success' && (
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Failed Records
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Step Results */}
      <Card>
        <CardHeader>
          <CardTitle>Step Details</CardTitle>
          <CardDescription>Detailed breakdown of each migration step</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {result.stepResults.map((step, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(step.status)}
                    <div>
                      <div className="font-medium">{step.stepName}</div>
                      <div className="text-sm text-muted-foreground">
                        Executed in {formatDuration(step.executionTimeMs)}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(step.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Records</div>
                    <div className="font-semibold">{step.totalRecords.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Successful</div>
                    <div className="font-semibold text-green-600">{step.successfulRecords.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Failed</div>
                    <div className="font-semibold text-red-600">{step.failedRecords.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Success Rate</div>
                    <div className="font-semibold">
                      {step.totalRecords > 0 
                        ? Math.round((step.successfulRecords / step.totalRecords) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>

                {step.errorCount > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm text-red-800">
                      <strong>{step.errorCount}</strong> error{step.errorCount !== 1 ? 's' : ''} occurred during this step.
                      Check the detailed error log for more information.
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Summary */}
      {result.error && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">Execution Error</CardTitle>
            <CardDescription>An error occurred during migration execution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm text-red-800 font-mono">
                {result.error}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record Mappings Summary */}
      {Object.keys(result.lookupMappings).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Record Mappings</CardTitle>
            <CardDescription>
              {Object.keys(result.lookupMappings).length.toLocaleString()} source records mapped to target records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Record mappings have been stored and can be used for future migrations or rollback operations.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 