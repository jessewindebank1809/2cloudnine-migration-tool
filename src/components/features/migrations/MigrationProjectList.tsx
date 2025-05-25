'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Play, Trash2, Edit, MoreVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface MigrationProject {
  id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED';
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

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  READY: 'default',
  RUNNING: 'blue',
  COMPLETED: 'green',
  FAILED: 'destructive',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export function MigrationProjectList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['migration-projects'],
    queryFn: async () => {
      const response = await fetch('/api/migrations');
      if (!response.ok) {
        throw new Error('Failed to fetch migration projects');
      }
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds for running migrations
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
          <Link href="/migrations/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Migration Project
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project: MigrationProject) => (
        <Card key={project.id} className="relative">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <Badge variant={statusColors[project.status] as any}>
                  {statusLabels[project.status]}
                </Badge>
              </div>
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
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Source:</span>
                  <span className="font-medium truncate max-w-[150px]">
                    {project.sourceOrg.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Target:</span>
                  <span className="font-medium truncate max-w-[150px]">
                    {project.targetOrg.name}
                  </span>
                </div>
              </div>

              {project.sessions.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Recent Activity
                  </p>
                  {project.sessions.slice(0, 2).map((session) => (
                    <div key={session.id} className="text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{session.objectType}</span>
                        <Badge variant="outline" className="text-xs">
                          {session.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {session.successfulRecords}/{session.totalRecords} records
                        {session.failedRecords > 0 && (
                          <span className="text-destructive ml-1">
                            ({session.failedRecords} failed)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2">
                Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 