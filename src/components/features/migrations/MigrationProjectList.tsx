'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Trash2, Edit, MoreVertical, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRunningMigrations } from '@/hooks/useRunningMigrations';

interface MigrationProject {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  templateId?: string;
  sourceOrg: {
    id: string;
    name: string;
    instanceUrl: string;
  };
  targetOrg: {
    id: string;
    name: string;
    instanceUrl: string;
  };
  sessions: Array<{
    id: string;
    objectType: string;
    status: string;
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, 'draft' | 'info' | 'running' | 'completed' | 'failed'> = {
  DRAFT: 'draft',
  READY: 'info',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export function MigrationProjectList() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { hasRunningMigration } = useRunningMigrations();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['migration-projects'],
    queryFn: async () => {
      const response = await fetch('/api/migrations');
      if (!response.ok) {
        throw new Error('Failed to fetch migration projects');
      }
      return response.json();
    },
    refetchInterval: (query) => {
      // Only poll frequently if there's a running migration
      const hasRunning = query.state.data?.projects?.some((p: any) => p.status === 'RUNNING');
      return hasRunning ? 15000 : 60000; // 15s if running, 60s if not
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/migrations/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete project');
      }
      return response.json();
    },
    onSuccess: () => {
      // Refetch the projects list
      queryClient.invalidateQueries({ queryKey: ['migration-projects'] });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/migrations/${projectId}/reprocess`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reprocess project');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Navigate to the execute page with reprocess flag
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      }
    },
  });

  const handleDelete = async (project: MigrationProject) => {
    if (project.status === 'RUNNING') {
      alert('Cannot delete a running migration');
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      try {
        await deleteMutation.mutateAsync(project.id);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete project');
      }
    }
  };

  const handleReprocess = async (project: MigrationProject) => {
    if (hasRunningMigration) {
      alert('Cannot reprocess while another migration is running');
      return;
    }

    if (project.status !== 'COMPLETED' && project.status !== 'FAILED') {
      alert('Can only reprocess completed or failed migrations');
      return;
    }

    try {
      await reprocessMutation.mutateAsync(project.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reprocess migration');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </TableCell>
                  <TableCell>
                    <div className="h-6 bg-gray-200 rounded w-16" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded w-32" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded w-32" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </TableCell>
                  <TableCell>
                    <div className="h-8 bg-gray-200 rounded w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">
            Failed to load migration projects
          </p>
        </CardContent>
      </Card>
    );
  }

  const projects = data?.projects || [];

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-sm text-muted-foreground">
            No migration projects yet
          </p>
          {hasRunningMigration ? (
            <Button 
              disabled={true}
              variant="secondary"
              className="opacity-50 cursor-not-allowed"
              title="Cannot start new migration while another is in progress"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migration in Progress
            </Button>
          ) : (
            <Link href="/migrations/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Migration Project
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project: MigrationProject) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div>
                    <Link href={`/migrations/${project.id}`} className="font-medium text-primary hover:underline">
                      {project.name}
                    </Link>
                    {project.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {project.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusColors[project.status]}>
                    {statusLabels[project.status]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {project.sourceOrg?.name || 'Unknown'}
                </TableCell>
                <TableCell className="font-medium">
                  {project.targetOrg?.name || 'Unknown'}
                </TableCell>
                <TableCell>
                  {project.templateId ? (
                    <span className="font-medium">
                      {project.templateId
                        .replace(/^payroll-/, '')
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/migrations/${project.id}`}>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                      </Link>
                      {project.status === 'DRAFT' && (
                        <Link href={`/migrations/${project.id}/execute`}>
                          <DropdownMenuItem>
                            <Play className="mr-2 h-4 w-4" />
                            Execute Migration
                          </DropdownMenuItem>
                        </Link>
                      )}
                      {(project.status === 'COMPLETED' || project.status === 'FAILED') && (
                        <DropdownMenuItem 
                          onClick={() => handleReprocess(project)}
                          disabled={reprocessMutation.isPending || hasRunningMigration}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {reprocessMutation.isPending ? 'Processing...' : 'Rerun'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(project)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 