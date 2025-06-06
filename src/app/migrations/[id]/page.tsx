'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Settings, Calendar, Database, Users, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useRunningMigrations } from '@/hooks/useRunningMigrations';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface MigrationProject {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  templateId?: string;
  sourceOrg: {
    id: string;
    name: string;
    instance_url: string;
    salesforce_org_id: string | null;
  };
  targetOrg: {
    id: string;
    name: string;
    instance_url: string;
    salesforce_org_id: string | null;
  };
  migration_sessions: Array<{
    id: string;
    object_type: string;
    status: string;
    total_records: number;
    successful_records: number;
    failed_records: number;
    created_at: string;
    completed_at: string | null;
    error_log: any[];
  }>;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

const statusColors = {
  DRAFT: 'draft',
  READY: 'info',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

const statusLabels = {
  DRAFT: 'Draft',
  READY: 'Ready',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
} as const;

export default function MigrationProjectPage({ params }: PageProps) {
  const router = useRouter();
  const { hasRunningMigration } = useRunningMigrations();
  
  // Unwrap the params promise
  const { id } = React.use(params);

  // Fetch project details
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['migration-project', id],
    queryFn: async () => {
      const response = await fetch(`/api/migrations/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Migration project not found');
        }
        throw new Error('Failed to fetch project');
      }
      return response.json() as Promise<MigrationProject>;
    },
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      return data.templates as Template[];
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href="/migrations">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Migrations
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'Migration project not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Create template name mapping - moved after loading and error checks
  const templateNameMap = Array.isArray(templatesData) 
    ? templatesData.reduce((acc, template) => {
        acc[template.id] = template.name;
        return acc;
      }, {} as Record<string, string>)
    : {};

  const sourceOrg = project.sourceOrg;
  const targetOrg = project.targetOrg;
  const latestSession = project.migration_sessions[0];

  // Get template name for display
  const getTemplateName = (objectType: string) => {
    if (project.templateId && templateNameMap[project.templateId]) {
      return templateNameMap[project.templateId];
    }
    // Fallback to object type if no template mapping found
    return objectType;
  };

  // Extract parent record information from session metadata
  const getParentRecordInfo = (session: any) => {
    if (!session.error_log || !Array.isArray(session.error_log)) {
      return { records: [], attempted: 0, successful: 0 };
    }
    
    const metadata = session.error_log.find((entry: any) => entry.type === 'metadata');
    if (!metadata) {
      return { records: [], attempted: 0, successful: 0 };
    }
    
    const records = metadata.successfulParentRecords
      ?.filter((record: any) => record.name && record.name.trim() !== '')
      .slice(0, 3) // Limit to first 3 records for display
      .map((record: any) => ({
        name: record.name,
        sourceId: record.sourceId,
        targetId: record.targetId,
        targetUrl: record.targetId ? `${targetOrg.instance_url}/${record.targetId}` : undefined
      })) || [];
    
    const stats = metadata.parentRecordStats || {
      attempted: metadata.successfulParentRecords?.length || 0,
      successful: metadata.successfulParentRecords?.length || 0
    };
    
    return {
      records,
      attempted: stats.attempted,
      successful: stats.successful
    };
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/migrations">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Migrations
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-2">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4">
              <Badge variant={statusColors[project.status] as any}>
                {statusLabels[project.status]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Created {formatDistanceToNow(new Date(project.created_at))} ago
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {hasRunningMigration ? (
              <Button 
                disabled={true}
                title="Cannot start new migration while another is in progress"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Migration
              </Button>
            ) : (
              <Link href="/migrations/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Migration
                </Button>
              </Link>
            )}
            {project.status === 'DRAFT' && (
              <Link href={`/migrations/${id}/execute`}>
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Migration
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Organisations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Source Organisation</h4>
              <div className="bg-muted p-3 rounded-lg">
                <div className="font-medium">{sourceOrg.name}</div>
                <div className="text-sm text-muted-foreground">{sourceOrg.instance_url}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Org ID: {sourceOrg.salesforce_org_id || 'Not connected'}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Target Organisation</h4>
              <div className="bg-muted p-3 rounded-lg">
                <div className="font-medium">{targetOrg.name}</div>
                <div className="text-sm text-muted-foreground">{targetOrg.instance_url}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Org ID: {targetOrg.salesforce_org_id || 'Not connected'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Migration History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Migration History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.migration_sessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No migration sessions yet
                </p>
                {project.status === 'DRAFT' && (
                  <Link href={`/migrations/${id}/execute`}>
                    <Button className="mt-4">
                      <Play className="mr-2 h-4 w-4" />
                      Start First Migration
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {project.migration_sessions.slice(0, 5).map((session) => {
                  const parentRecordInfo = getParentRecordInfo(session);
                  const hasParentInfo = parentRecordInfo.attempted > 0;
                  
                  return (
                    <div key={session.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{getTemplateName(session.object_type)}</div>
                        <Badge variant={session.status === 'COMPLETED' ? 'completed' : 'pending'}>
                          {session.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        {hasParentInfo && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">{parentRecordInfo.successful} of {parentRecordInfo.attempted} record{parentRecordInfo.attempted !== 1 ? 's' : ''} migrated</span>
                          </div>
                        )}
                      </div>
                      
                      {parentRecordInfo.records.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          <span className="font-medium">Records:</span>
                          <ul className="mt-1 ml-4 space-y-1">
                            {parentRecordInfo.records.map((record: any) => (
                              <li key={record.sourceId} className="list-disc">
                                {record.targetUrl ? (
                                  <a 
                                    href={record.targetUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  >
                                    {record.name}
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">{record.name}</span>
                                )}
                              </li>
                            ))}
                            {parentRecordInfo.successful > 3 && (
                              <li className="list-disc text-muted-foreground">and {parentRecordInfo.successful - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                    </div>
                  );
                })}
                {project.migration_sessions.length > 5 && (
                  <div className="text-center">
                    <Button variant="ghost" size="sm">
                      View All Sessions
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 