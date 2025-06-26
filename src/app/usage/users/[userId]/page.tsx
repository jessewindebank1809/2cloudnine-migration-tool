'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Activity, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserDetails {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    created_at: string;
    last_active_at: string | null;
  };
  stats: {
    totalProjects: number;
    totalMigrations: number;
    successfulMigrations: number;
    failedMigrations: number;
    totalRecordsProcessed: number;
    recentErrors: number;
  };
  projects: Array<{
    id: string;
    name: string;
    templateId: string;
    sourceOrg: { name: string };
    targetOrg: { name: string };
    status: string;
    createdAt: string;
    recentSessions: Array<{
      id: string;
      status: string;
      totalRecords: number;
      successfulRecords: number;
      failedRecords: number;
      startedAt: string;
      completedAt: string | null;
      duration: number | null;
      errors: any[];
    }>;
  }>;
  recentErrors: Array<{
    migrationId: string;
    timestamp: string;
    error: string;
    errorCode?: string;
    templateId?: string;
    failedAtStep?: string;
    technicalDetails: any[];
  }>;
  errorPatterns: Record<string, {
    count: number;
    examples: any[];
    templates: string[];
    lastOccurred: string;
  }>;
}

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      const response = await fetch(`/api/usage/users/${userId}`);
      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required');
        } else {
          throw new Error('Failed to fetch user details');
        }
        return;
      }
      
      const data = await response.json();
      setUserDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userDetails) {
    return null;
  }

  const { user, stats, projects, recentErrors, errorPatterns } = userDetails;
  const successRate = stats.totalMigrations > 0 
    ? ((stats.successfulMigrations / stats.totalMigrations) * 100).toFixed(1)
    : '0';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/usage')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Usage
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{user.name || user.email}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
            {user.role}
          </Badge>
        </div>
        
        <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
          </div>
          {user.last_active_at && (
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Last active {formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })}
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Migrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMigrations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalProjects} projects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.successfulMigrations} successful
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecordsProcessed.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentErrors}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Patterns */}
      {Object.keys(errorPatterns).length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Error Patterns</CardTitle>
            <CardDescription>Common errors experienced by this user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(errorPatterns).map(([code, pattern]) => (
                <div key={code} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{code}</Badge>
                      <span className="text-sm font-medium">{pattern.count} occurrences</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Last: {formatDistanceToNow(new Date(pattern.lastOccurred), { addSuffix: true })}
                    </span>
                  </div>
                  {pattern.templates.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Templates: {pattern.templates.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Projects */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Migration projects and their execution history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {projects.map((project) => (
              <div key={project.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{project.name}</h3>
                  <Badge>{project.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {project.sourceOrg.name} → {project.targetOrg.name}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Template: {project.templateId}
                </p>
                
                {project.recentSessions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recent Executions:</p>
                    {project.recentSessions.map((session) => (
                      <div key={session.id} className="bg-muted rounded p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={session.status === 'COMPLETED' && session.failedRecords === 0 ? 'success' : 'destructive'}>
                              {session.status}
                            </Badge>
                            <span>{formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}</span>
                          </div>
                          {session.duration && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {(session.duration / 1000).toFixed(1)}s
                            </div>
                          )}
                        </div>
                        <p>
                          Records: {session.successfulRecords}/{session.totalRecords} successful
                          {session.failedRecords > 0 && (
                            <span className="text-red-600 ml-2">
                              ({session.failedRecords} failed)
                            </span>
                          )}
                        </p>
                        {session.errors.length > 0 && (
                          <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                            <p className="font-medium text-red-800 mb-1">Errors:</p>
                            {session.errors.slice(0, 3).map((error, idx) => (
                              <p key={idx} className="text-red-700">
                                • {error.error || error.stepName}: {error.recordId}
                              </p>
                            ))}
                            {session.errors.length > 3 && (
                              <p className="text-red-600 mt-1">
                                ...and {session.errors.length - 3} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors Detail */}
      {recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Error Details</CardTitle>
            <CardDescription>Technical details of recent migration failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentErrors.map((error, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {error.errorCode && <Badge variant="destructive">{error.errorCode}</Badge>}
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    {error.templateId && (
                      <span className="text-sm font-medium">{error.templateId}</span>
                    )}
                  </div>
                  <p className="text-sm mb-2">{error.error}</p>
                  {error.failedAtStep && (
                    <p className="text-sm text-muted-foreground">
                      Failed at: {error.failedAtStep}
                    </p>
                  )}
                  {error.technicalDetails.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        Technical Details ({error.technicalDetails.length})
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(error.technicalDetails, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}