'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ObjectSelection } from '@/components/features/migrations/ObjectSelection';
import { MigrationProgressHome } from '@/components/features/migrations/MigrationProgressHome';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function MigrationExecutePage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const isReprocessing = searchParams.get('reprocess') === 'true';

  // Unwrap the params promise
  const { id } = React.use(params);

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['migration-project', id],
    queryFn: async () => {
      const response = await fetch(`/api/migrations/${id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
  });

  // Execute migration mutation
  const executeMigration = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/migrations/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectTypes: selectedObjects,
          useBulkApi: true,
          preserveRelationships: true,
          allowPartialSuccess: true,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start migration');
      }
      return response.json();
    },
    onSuccess: () => {
      setIsExecuting(true);
      // Invalidate running migrations to ensure button state updates
      queryClient.invalidateQueries({ queryKey: ['running-migrations-check'] });
    },
  });

  // Auto-execute when reprocessing
  useEffect(() => {
    if (isReprocessing && project && !isExecuting && !executeMigration.isPending) {
      executeMigration.mutate();
    }
  }, [isReprocessing, project, isExecuting, executeMigration]);

  const handleExecute = async () => {
    if (!isReprocessing && selectedObjects.length === 0) {
      alert('Please select at least one object to migrate');
      return;
    }
    
    await executeMigration.mutateAsync();
  };

  const handleComplete = () => {
    // Ensure cache is invalidated before navigation
    queryClient.invalidateQueries({ queryKey: ['running-migrations-check'] });
    queryClient.invalidateQueries({ queryKey: ['migrations'] });
    router.push(`/migrations/${id}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Migration project not found
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Link href={`/migrations/${id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-2">
          {isExecuting ? 'Migration in progress...' : isReprocessing ? 'Reprocessing migration...' : 'Select objects to migrate'}
        </p>
      </div>

      {!isExecuting ? (
        <div className="space-y-6">
          {isReprocessing ? (
            // Show reprocessing state
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Reprocessing Migration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm font-medium">Source Organisation</p>
                    <p className="text-sm text-muted-foreground">{project.sourceOrg.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Target Organisation</p>
                    <p className="text-sm text-muted-foreground">{project.targetOrg.name}</p>
                  </div>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Migration is being reprocessed with the same configuration as before. The validation step has been skipped.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Migration Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Migration Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm font-medium">Source Organisation</p>
                      <p className="text-sm text-muted-foreground">{project.sourceOrg.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Target Organisation</p>
                      <p className="text-sm text-muted-foreground">{project.targetOrg.name}</p>
                    </div>
                  </div>

                  <ObjectSelection
                    sourceOrgId={project.source_org_id}
                    onSelectionChange={setSelectedObjects}
                  />
                </CardContent>
              </Card>

              {/* Execute Button */}
              <div className="flex justify-end">
                <Button
                  size="lg"
                  onClick={handleExecute}
                  disabled={selectedObjects.length === 0 || executeMigration.isPending}
                >
                  {executeMigration.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Starting Migration...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Migration
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {executeMigration.error && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Migration execution failed
                </AlertDescription>
              </Alert>
              
              {/* Detailed Error Information */}
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-800 text-base">Error Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm text-red-800 font-mono">
                      {executeMigration.error.message}
                    </div>
                  </div>
                  
                  {/* Show step-by-step errors if available */}
                  {(executeMigration.error as Error & { details?: Array<{ stepName: string; errors?: Array<{ error: string }> }> })?.details && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Step Failures:</h4>
                      {(executeMigration.error as Error & { details: Array<{ stepName: string; errors?: Array<{ error: string }> }> }).details.map((detail, index) => (
                        <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                          <div className="font-medium text-red-800">{detail.stepName}</div>
                          {detail.errors?.map((error, errorIndex) => (
                            <div key={errorIndex} className="text-red-700 mt-1 font-mono text-xs">
                              {error.error}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Check the project details for more information about the migration session.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
                        <MigrationProgressHome
          projectId={id}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
} 