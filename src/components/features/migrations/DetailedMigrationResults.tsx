'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight,
  AlertCircle,
  RotateCcw
} from 'lucide-react';

interface RecordResult {
  sourceId: string;
  sourceName: string;
  recordName?: string;
  targetId?: string;
  targetUrl?: string;
  status: 'success' | 'failed';
  successfulChildRecords: number;
  failedChildRecords: number;
  totalChildRecords: number;
  errors: any[];
  childRecordDetails: {
    stepName: string;
    successCount: number;
    failCount: number;
    errors: any[];
  }[];
}

interface DetailedMigrationResultsProps {
  recordResults: RecordResult[];
  sessionId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  executionTimeMs: number;
  status: 'success' | 'failed';
  onRetry?: () => void;
}

export function DetailedMigrationResults({
  recordResults,
  sessionId,
  totalRecords,
  successfulRecords,
  failedRecords,
  executionTimeMs,
  status,
  onRetry
}: DetailedMigrationResultsProps) {
  const [expandedRecords, setExpandedRecords] = React.useState<Set<string>>(new Set());

  const toggleRecord = (recordId: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const successfulParentRecords = recordResults.filter(r => r.status === 'success').length;
  const failedParentRecords = recordResults.filter(r => r.status === 'failed').length;

  // Calculate actual totals from record data - show what was attempted before rollback
  const actualSuccessfulRecords = recordResults.reduce((total, record) => {
    return total + record.successfulChildRecords + (record.status === 'success' ? 1 : 0);
  }, 0);
  
  const actualFailedRecords = recordResults.reduce((total, record) => {
    return total + record.failedChildRecords + (record.status === 'failed' ? 1 : 0);
  }, 0);

  // Determine if this was a rollback scenario
  const hadRollback = status === 'failed' && actualSuccessfulRecords > 0;
  const migrationFailed = actualFailedRecords > 0 || status === 'failed';

  // Only show detailed results if there are records that have been processed
  const hasProcessedRecords = totalRecords > 0;

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Migration Results</CardTitle>
              <CardDescription>
                Completed in {formatDuration(executionTimeMs)}
              </CardDescription>
            </div>
            {getStatusBadge(status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4" data-testid="migration-results">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600" data-testid="total-successful">
                {hadRollback ? 0 : successfulParentRecords}
              </div>
              <div className="text-sm text-muted-foreground">
                {hadRollback ? 'Records Remaining (After Rollback)' : 'Records Created'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600" data-testid="total-failed">
                {failedParentRecords}
              </div>
              <div className="text-sm text-muted-foreground">Records Failed</div>
            </div>
          </div>

          {hadRollback && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Migration failed with {actualFailedRecords} errors. {actualSuccessfulRecords} records were initially created but have been automatically rolled back to maintain data integrity.
              </AlertDescription>
            </Alert>
          )}

          {migrationFailed && !hadRollback && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {actualFailedRecords} records failed during migration.
              </AlertDescription>
            </Alert>
          )}

          {onRetry && actualFailedRecords > 0 && (
            <div className="mt-4 flex justify-end">
              <Button onClick={onRetry} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Failed Records
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Attempt Summary - Show what was attempted even if rolled back */}
      {hadRollback && hasProcessedRecords && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Attempt Summary</CardTitle>
            <CardDescription>
              Records that were initially created before rollback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="text-lg font-semibold text-blue-700">{actualSuccessfulRecords}</div>
                <div className="text-blue-600">Initially Created</div>
              </div>
              <div className="text-center p-3 bg-red-50 border border-red-200 rounded">
                <div className="text-lg font-semibold text-red-700">{actualFailedRecords}</div>
                <div className="text-red-600">Failed to Create</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Record Results - Only show if records were processed */}
      {hasProcessedRecords && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Results</CardTitle>
            <CardDescription>
              {hadRollback 
                ? 'Migration attempts for each selected record (before rollback)' 
                : 'Detailed results for each selected record'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recordResults.map((record) => (
                <Collapsible
                  key={record.sourceId}
                  open={expandedRecords.has(record.sourceId)}
                  onOpenChange={() => toggleRecord(record.sourceId)}
                >
                  <CollapsibleTrigger asChild>
                    <div className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      !migrationFailed && record.status === 'success' 
                        ? 'border-green-200 bg-green-50' 
                        : hadRollback && record.status === 'success'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-red-200 bg-red-50'
                    }`} data-testid="record-result" data-source-id={record.sourceId}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedRecords.has(record.sourceId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {getStatusIcon(
                            !migrationFailed && record.status === 'success' 
                              ? 'success' 
                              : hadRollback && record.status === 'success'
                              ? 'warning'
                              : 'failed'
                          )}
                          <div>
                            <div className="font-medium">
                              {record.recordName || record.sourceName || record.sourceId}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Source ID: {record.sourceId}
                            </div>
                            {hadRollback && record.status === 'success' && (
                              <div className="text-xs text-yellow-600 font-medium">
                                Initially created, then rolled back
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium" data-testid="record-successful">
                              {record.status === 'success' ? 
                                `${record.successfulChildRecords + 1}` : 
                                record.successfulChildRecords} {hadRollback ? 'initially created' : 'successful'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid="record-failed">
                              {record.status === 'failed' ? 
                                record.failedChildRecords + 1 : 
                                record.failedChildRecords} failed
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 ml-7 space-y-3">
                      {!migrationFailed && record.status === 'success' && record.targetId && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-green-800">
                                Parent Record Created Successfully
                              </div>
                              <div className="text-sm text-green-700">
                                Target ID: {record.targetId}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (record.targetUrl) {
                                  window.open(record.targetUrl, '_blank');
                                }
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Record
                            </Button>
                          </div>
                        </div>
                      )}

                      {hadRollback && record.status === 'success' && record.targetId && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="font-medium text-yellow-800 mb-2">
                            Record Was Rolled Back
                          </div>
                          <div className="text-sm text-yellow-700">
                            This record was initially created successfully but was rolled back due to other failures in the migration. 
                            Original Target ID: {record.targetId}
                          </div>
                        </div>
                      )}

                      {record.errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                          <div className="font-medium text-red-800 mb-2">
                            Parent Record Errors
                          </div>
                          {record.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700 font-mono">
                              {error.error || error.message}
                            </div>
                          ))}
                        </div>
                      )}

                      {record.childRecordDetails.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-medium text-sm">
                            Child Record Details {hadRollback ? '(Before Rollback)' : ''}:
                          </div>
                          {record.childRecordDetails.map((detail, index) => (
                            <div key={index} className="p-2 border rounded text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{detail.stepName}</span>
                                <span className="text-muted-foreground">
                                  {detail.successCount} success, {detail.failCount} failed
                                </span>
                              </div>
                              {detail.errors.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {detail.errors.slice(0, 3).map((error, errorIndex) => (
                                    <div key={errorIndex} className="text-xs text-red-600 font-mono">
                                      {error.error || error.message}
                                    </div>
                                  ))}
                                  {detail.errors.length > 3 && (
                                    <div className="text-xs text-muted-foreground">
                                      ... and {detail.errors.length - 3} more errors
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 