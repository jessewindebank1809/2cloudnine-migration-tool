'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ObjectSelection } from '@/components/features/migrations/ObjectSelection';
import { MigrationProgressHome } from '@/components/features/migrations/MigrationProgressHome';

interface PageProps {
  params: {
    id: string;
  };
}

export default function MigrationExecutePage({ params }: PageProps) {
  const router = useRouter();
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['migration-project', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/migrations/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
  });

  // Execute migration mutation
  const executeMigration = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/migrations/${params.id}/execute`, {
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
    },
  });

  const handleExecute = async () => {
    if (selectedObjects.length === 0) {
      alert('Please select at least one object to migrate');
      return;
    }
    
    await executeMigration.mutateAsync();
  };

  const handleComplete = () => {
    router.push(`/migrations/${params.id}`);
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
        <Link href={`/migrations/${params.id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-2">
          {isExecuting ? 'Migration in progress...' : 'Select objects to migrate'}
        </p>
      </div>

      {!isExecuting ? (
        <div className="space-y-6">
          {/* Migration Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Migration Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm font-medium">Source Organization</p>
                  <p className="text-sm text-muted-foreground">{project.sourceOrg.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Target Organization</p>
                  <p className="text-sm text-muted-foreground">{project.targetOrg.name}</p>
                </div>
              </div>

              <ObjectSelection
                sourceOrgId={project.source_org_id}
                targetOrgId={project.target_org_id}
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
                  {(executeMigration.error as any)?.details && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Step Failures:</h4>
                      {(executeMigration.error as any).details.map((detail: any, index: number) => (
                        <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                          <div className="font-medium text-red-800">{detail.stepName}</div>
                          {detail.errors?.map((error: any, errorIndex: number) => (
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
          projectId={params.id}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
} 