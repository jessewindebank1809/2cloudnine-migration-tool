'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { ExecutionProgress } from '@/lib/migration/templates/core/interfaces';

interface MigrationProgressProps {
  progress: ExecutionProgress;
  stepResults?: Array<{
    stepName: string;
    status: 'success' | 'failed';
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    executionTimeMs: number;
    errorCount: number;
  }>;
}

export function MigrationProgress({ progress, stepResults = [] }: MigrationProgressProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-grey-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'partial':
        return <Badge variant="partial">Partial</Badge>;
      case 'failed':
        return <Badge variant="failed">Failed</Badge>;
      case 'running':
        return <Badge variant="running">Running</Badge>;
      default:
        return <Badge variant="pending">Pending</Badge>;
    }
  };

  const progressPercentage = progress.totalSteps > 0 
    ? Math.round((progress.currentStep / progress.totalSteps) * 100)
    : 0;

  const successRate = progress.totalRecords > 0 
    ? Math.round((progress.successfulRecords / progress.totalRecords) * 100)
    : 0;

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

  const getEstimatedTimeRemaining = () => {
    if (progress.estimatedCompletion) {
      const remaining = progress.estimatedCompletion.getTime() - Date.now();
      return remaining > 0 ? formatDuration(remaining) : 'Completing...';
    }
    return 'Calculating...';
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(progress.status)}
                Migration Progress
              </CardTitle>
              <CardDescription>
                Step {progress.currentStep} of {progress.totalSteps}: {progress.stepName}
              </CardDescription>
            </div>
            {getStatusBadge(progress.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Records</div>
              <div className="font-semibold">{progress.totalRecords.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Successful</div>
              <div className="font-semibold text-green-600">{progress.successfulRecords.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Failed</div>
              <div className="font-semibold text-red-600">{progress.failedRecords.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Success Rate</div>
              <div className="font-semibold">{successRate}%</div>
            </div>
          </div>

          {progress.status === 'running' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Started</div>
                <div className="font-semibold">{progress.startTime.toLocaleTimeString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Est. Remaining</div>
                <div className="font-semibold">{getEstimatedTimeRemaining()}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Results */}
      {stepResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step Results</CardTitle>
            <CardDescription>Detailed results for each migration step</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stepResults.map((step, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(step.status)}
                    <div>
                      <div className="font-medium">{step.stepName}</div>
                      <div className="text-sm text-muted-foreground">
                        {step.totalRecords.toLocaleString()} records • {formatDuration(step.executionTimeMs)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-green-600">{step.successfulRecords}</span>
                      {step.failedRecords > 0 && (
                        <>
                          {' • '}
                          <span className="text-red-600">{step.failedRecords} failed</span>
                        </>
                      )}
                    </div>
                    {step.errorCount > 0 && (
                      <div className="text-xs text-red-600">
                        {step.errorCount} error{step.errorCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 