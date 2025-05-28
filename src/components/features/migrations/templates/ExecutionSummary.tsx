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
      status: 'success' | 'failed';
      totalRecords: number;
      successfulRecords: number;
      failedRecords: number;
      executionTimeMs: number;
      errorCount: number;
      errors?: Array<{
        recordId: string;
        error: string;
        retryable: boolean;
      }>;
    }>;
  };
  uniqueErrors?: Array<{
    message: string;
    originalMessage: string;
    count: number;
    examples: string[];
  }>;
  onRetry?: () => void;
  onDownloadReport?: () => void;
}

export function ExecutionSummary({ result, uniqueErrors, onRetry, onDownloadReport }: ExecutionSummaryProps) {

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
        return <Badge variant="completed">Completed Successfully</Badge>;
      case 'partial':
        return <Badge variant="partial">Completed with Errors</Badge>;
      case 'failed':
        return <Badge variant="failed">Failed</Badge>;
      default:
        return <Badge variant="pending">Unknown</Badge>;
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

  const renderParentTargetRecords = (): React.ReactNode => {
    // Find the parent step (first step that creates the main records)
    const parentStep = result.stepResults.find(step => 
      step.stepName === 'interpretationRuleMaster' || 
      step.stepName.includes('Master') || 
      step.stepName.includes('main') ||
      step.stepName.includes('parent') ||
      result.stepResults.indexOf(step) === 0
    );
    
    if (!parentStep || parentStep.successfulRecords === 0) return null;
    
    // Get parent target record IDs from overall lookup mappings
    const allTargetRecords: string[] = [];
    for (const [sourceId, targetId] of Object.entries(result.lookupMappings)) {
      if (typeof targetId === 'string' && (targetId.length === 15 || targetId.length === 18)) {
        allTargetRecords.push(targetId);
      }
    }
    
    // Remove duplicates and limit to parent step successful records
    const uniqueParentRecords = Array.from(new Set(allTargetRecords)).slice(0, parentStep.successfulRecords);
    
    if (uniqueParentRecords.length === 0) return null;
    
    // Determine the record type name based on step name
    const getRecordTypeName = (stepName: string) => {
      if (stepName.includes('interpretation') || stepName.includes('Interpretation')) {
        return 'interpretation rule';
      }
      if (stepName.includes('payCode') || stepName.includes('PayCode')) {
        return 'pay code';
      }
      if (stepName.includes('employee') || stepName.includes('Employee')) {
        return 'employee';
      }
      return 'record';
    };
    
    const recordTypeName = getRecordTypeName(parentStep.stepName);
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Parent Target Records Created</CardTitle>
          <CardDescription>
            {uniqueParentRecords.length.toLocaleString()} {recordTypeName}{uniqueParentRecords.length !== 1 ? 's' : ''} successfully created in target organisation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground mb-3">
            These are the main {recordTypeName} records that were created. Child records may reference these parent records.
          </div>
          
          {/* Display first 10 record IDs */}
          <div className="bg-gray-50 p-3 rounded border">
            <div className="text-xs font-medium text-gray-700 mb-2">Target Record IDs:</div>
            <div className="font-mono text-xs text-gray-600 space-y-1">
              {uniqueParentRecords.slice(0, 10).map((recordId, index) => (
                <div key={index} className="break-all">{recordId}</div>
              ))}
              {uniqueParentRecords.length > 10 && (
                <div className="text-gray-500 italic">
                  ... and {uniqueParentRecords.length - 10} more record{uniqueParentRecords.length - 10 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Records Created</div>
              <div className="font-semibold text-green-600">{uniqueParentRecords.length.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Step</div>
              <div className="font-semibold">{parentStep.stepName}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const successRate = result.totalRecords > 0 
    ? Math.round((result.successfulRecords / result.totalRecords) * 100)
    : 0;

  const failedSteps = result.stepResults.filter(step => step.status === 'failed');
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{successfulSteps.length}</div>
              <div className="text-muted-foreground">Successful Steps</div>
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

      {/* Unique Errors Summary */}
      {uniqueErrors && uniqueErrors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">
              Error Analysis
            </CardTitle>
            <CardDescription>
              {uniqueErrors.length} unique error type{uniqueErrors.length !== 1 ? 's' : ''} identified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {uniqueErrors.map((uniqueError, index) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                <div className="font-medium text-red-800 mb-2">
                  Error Pattern #{index + 1}
                </div>
                <div className="text-red-700 text-sm font-mono mb-2">
                  {uniqueError.message}
                </div>
                {uniqueError.originalMessage && uniqueError.originalMessage !== uniqueError.message && (
                  <div className="text-red-600 text-xs mb-2">
                    <strong>Example:</strong> {uniqueError.originalMessage}
                  </div>
                )}
                <div className="text-red-700 text-sm">
                  <div className="flex items-center gap-4 mb-1">
                    <span><strong>Affected records:</strong> {uniqueError.count}</span>
                    <span><strong>Percentage:</strong> {result.totalRecords > 0 ? Math.round((uniqueError.count / result.totalRecords) * 100) : 0}%</span>
                  </div>
                  {uniqueError.examples.length > 0 && (
                    <div className="text-xs mt-1">
                      <strong>Example record IDs:</strong> {uniqueError.examples.join(', ')}
                      {uniqueError.count > uniqueError.examples.length && ` (and ${uniqueError.count - uniqueError.examples.length} more)`}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="text-xs text-red-600">
              Review these error patterns to understand what went wrong and how to prevent similar issues in future migrations.
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

      {/* Parent Target Records */}
      {renderParentTargetRecords()}
    </div>
  );
} 