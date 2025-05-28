'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  Database,
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow, format } from 'date-fns';

interface MigrationProgressProps {
  projectId: string;
  onComplete?: () => void;
}

interface SessionProgress {
  id: string;
  objectType: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  createdAt: string;
  completedAt?: string;
  progress: {
    sessionId: string;
    status: string;
    totalRecords: number;
    processedRecords: number;
    successfulRecords: number;
    failedRecords: number;
    percentComplete: number;
    estimatedTimeRemaining?: number;
    currentBatch?: number;
    totalBatches?: number;
  };
}

export function MigrationProgressHome({ projectId, onComplete }: MigrationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch migration progress
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['migration-progress', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/migrations/${projectId}/progress`);
      if (!response.ok) throw new Error('Failed to fetch progress');
      return response.json();
    },
    refetchInterval: 1000, // Refetch every second while running
    enabled: !!projectId,
  });

  // Update elapsed time
  useEffect(() => {
    if (data?.status === 'RUNNING') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data?.status]);

  // Call onComplete when migration finishes
  useEffect(() => {
    if (data?.status === 'COMPLETED' && onComplete) {
      onComplete();
    }
  }, [data?.status, onComplete]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading Migration Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Fetching migration status...</span>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Loading session details...</span>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Calculating progress...</span>
              <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <div className="text-blue-800">
              Please wait while we load the latest migration progress...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load migration progress
          </AlertDescription>
        </Alert>
        
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800 text-base">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-sm text-red-800 font-mono">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Try refreshing the page or check the project details for more information.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRunning = data?.status === 'RUNNING';
  const isCompleted = data?.status === 'COMPLETED';
  const isFailed = data?.status === 'FAILED';
  const isPartialSuccess = data?.status === 'PARTIAL_SUCCESS';
  const hasErrors = data?.overall?.failedRecords > 0;

  const statusIcon: Record<string, React.ReactElement> = {
    RUNNING: <Loader2 className="h-5 w-5 animate-spin" />,
    COMPLETED: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    FAILED: <XCircle className="h-5 w-5 text-destructive" />,
    PARTIAL_SUCCESS: <AlertCircle className="h-5 w-5 text-yellow-600" />,
    IDLE: <Clock className="h-5 w-5 text-muted-foreground" />,
  };

  const statusLabel: Record<string, string> = {
    RUNNING: 'Migration in Progress',
    COMPLETED: 'Migration Completed',
    FAILED: 'Migration Failed',
    PARTIAL_SUCCESS: 'Completed with Errors',
    IDLE: 'Not Started',
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const estimateTimeRemaining = (session: SessionProgress) => {
    if (!session.progress.estimatedTimeRemaining) return null;
    
    const seconds = Math.round(session.progress.estimatedTimeRemaining / 1000);
    return formatTime(seconds);
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusIcon[data?.status || 'IDLE']}
              <CardTitle>{statusLabel[data?.status || 'IDLE']}</CardTitle>
            </div>
            {isRunning && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Overall Progress */}
            {data?.overall && (
              <>
                <div className="space-y-2">
                  <Progress value={data.overall.percentComplete} className="h-3" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{data.overall.percentComplete}% Complete</span>
                    <span>
                      {data.overall.processedRecords.toLocaleString()} / {data.overall.totalRecords.toLocaleString()} records
                    </span>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-2xl font-semibold">
                            {data.overall.successfulRecords.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Successful</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <div>
                          <p className="text-2xl font-semibold">
                            {data.overall.failedRecords.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-2xl font-semibold">
                            {formatTime(elapsedTime)}
                          </p>
                          <p className="text-xs text-muted-foreground">Elapsed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Details for Failed Migrations or Completed with Errors */}
      {(isFailed || isPartialSuccess || (isCompleted && hasErrors)) && data?.errorLog && (
        <Card className={isFailed ? "border-red-200" : "border-yellow-200"}>
          <CardHeader>
            <CardTitle className={isFailed ? "text-red-800 text-base flex items-center gap-2" : "text-yellow-800 text-base flex items-center gap-2"}>
              {isFailed ? <XCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {isFailed ? 'Migration Error Details' : 'Migration Completed with Errors'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={isFailed ? "p-3 bg-red-50 border border-red-200 rounded" : "p-3 bg-yellow-50 border border-yellow-200 rounded"}>
              <div className={isFailed ? "text-sm text-red-800 font-mono" : "text-sm text-yellow-800 font-mono"}>
                {data.errorLog}
              </div>
            </div>
            
            {/* Show step-by-step errors if available */}
            {data?.stepResults && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Step Failures:</h4>
                {data.stepResults
                  .filter((step: any) => (step.status === 'failed' || step.status === 'partial') && step.errors?.length > 0)
                  .map((step: any, index: number) => (
                    <div key={index} className={step.status === 'failed' ? "p-2 bg-red-50 border border-red-200 rounded text-sm" : "p-2 bg-yellow-50 border border-yellow-200 rounded text-sm"}>
                      <div className={step.status === 'failed' ? "font-medium text-red-800" : "font-medium text-yellow-800"}>
                        {step.stepName} ({step.successfulRecords}/{step.totalRecords} records successful)
                      </div>
                      {step.errors?.slice(0, 5).map((error: any, errorIndex: number) => (
                        <div key={errorIndex} className={step.status === 'failed' ? "text-red-700 mt-1 font-mono text-xs" : "text-yellow-700 mt-1 font-mono text-xs"}>
                          {error.error}
                        </div>
                      ))}
                      {step.errors?.length > 5 && (
                        <div className={step.status === 'failed' ? "text-red-600 mt-1 text-xs" : "text-yellow-600 mt-1 text-xs"}>
                          ... and {step.errors.length - 5} more errors
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              {isFailed 
                ? 'Review the errors above to understand what went wrong during migration.'
                : 'Migration completed successfully for some records. Review the errors above to understand what went wrong with the failed records.'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Session Progress */}
      {data?.sessions && data.sessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Object Progress</h3>
          {data.sessions.map((session: SessionProgress) => (
            <Card key={session.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{session.objectType}</span>
                  </div>
                  <Badge variant={
                    session.status === 'COMPLETED' ? 'completed' :
                    session.status === 'RUNNING' ? 'running' :
                    session.status === 'FAILED' ? 'failed' :
                    'pending'
                  }>
                    {session.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Progress 
                      value={session.progress.percentComplete} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {session.progress.processedRecords.toLocaleString()} / {session.progress.totalRecords.toLocaleString()} records
                      </span>
                      {session.progress.currentBatch && session.progress.totalBatches && (
                        <span>
                          Batch {session.progress.currentBatch} of {session.progress.totalBatches}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-4">
                      <span className="text-green-600">
                        ✓ {session.progress.successfulRecords.toLocaleString()}
                      </span>
                      {session.progress.failedRecords > 0 && (
                        <span className="text-destructive">
                          ✗ {session.progress.failedRecords.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {session.status === 'RUNNING' && estimateTimeRemaining(session) && (
                      <span className="text-muted-foreground">
                        ~{estimateTimeRemaining(session)} remaining
                      </span>
                    )}
                  </div>

                  {session.completedAt && (
                    <div className="text-xs text-muted-foreground">
                      Completed {formatDistanceToNow(new Date(session.completedAt), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Performance Metrics */}
      {isRunning && data?.sessions?.some((s: SessionProgress) => s.status === 'RUNNING') && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Records/Second</p>
                <p className="text-lg font-semibold">
                  {elapsedTime > 0 
                    ? Math.round(data.overall.processedRecords / elapsedTime).toLocaleString()
                    : '0'
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold">
                  {data.overall.processedRecords > 0
                    ? Math.round((data.overall.successfulRecords / data.overall.processedRecords) * 100)
                    : 0
                  }%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 