'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Plus } from 'lucide-react';
import Link from "next/link"
import { useRunningMigrations } from '@/hooks/useRunningMigrations';

interface Organisation {
  id: string;
  name: string;
  org_type: string;
  salesforce_org_id: string | null;
  instance_url: string;
  access_token_encrypted: string | null;
  created_at: string;
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

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface HomeData {
  organisations: Organisation[];
  projects: MigrationProject[];
  templates: Template[];
  isLoading: boolean;
  error: string | null;
}

export default function HomePage() {
  const { hasRunningMigration } = useRunningMigrations();
  const [data, setData] = useState<HomeData>({
    organisations: [],
    projects: [],
    templates: [],
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        // Fetch organisations, migrations, and templates in parallel
        const [orgsResponse, migrationsResponse, templatesResponse] = await Promise.all([
          fetch('/api/organisations'),
          fetch('/api/migrations'),
          fetch('/api/templates')
        ]);

        let organisations: Organisation[] = [];
        let projects: MigrationProject[] = [];
        let templates: Template[] = [];

        // Handle organisations response
        if (orgsResponse.ok) {
          const orgsData = await orgsResponse.json();
          organisations = orgsData.organisations || [];
        } else if (orgsResponse.status !== 401) {
          console.error('Failed to fetch organisations:', orgsResponse.status);
        }

        // Handle migrations response
        if (migrationsResponse.ok) {
          const migrationsData = await migrationsResponse.json();
          projects = migrationsData.projects || [];
        } else {
          console.error('Failed to fetch migrations:', migrationsResponse.status);
        }

        // Handle templates response
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          templates = templatesData.templates || [];
        } else {
          console.error('Failed to fetch templates:', templatesResponse.status);
        }

        setData({
          organisations,
          projects,
          templates,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching home data:', error);
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load home data'
        }));
      }
    };

    fetchData();
  }, []);

  // Create a mapping from template ID to template name
  const templateNameMap = data.templates.reduce((acc, template) => {
    acc[template.id] = template.name;
    return acc;
  }, {} as Record<string, string>);

  // Calculate home statistics
  const stats = {
    orgConnections: {
      total: data.organisations.length,
      active: data.organisations.filter(org => org.access_token_encrypted).length,
      issues: data.organisations.filter(org => !org.access_token_encrypted).length
    },
    migrations: {
      totalRecordsMigrated: data.projects.reduce((total, project) => {
        return total + project.sessions.reduce((sessionTotal, session) => {
          return sessionTotal + (session.successfulRecords || 0);
        }, 0);
      }, 0),
      recent: data.projects
        .filter(project => project.sessions.length > 0)
        .map(project => {
          const latestSession = project.sessions[0]; // Already ordered by created_at desc
          return {
            id: project.id,
            name: project.name,
            templateName: project.templateId ? templateNameMap[project.templateId] || project.templateId : undefined,
            status: latestSession.status.toUpperCase() as 'COMPLETED' | 'RUNNING' | 'FAILED',
            objectType: latestSession.objectType,
            processedRecords: latestSession.successfulRecords + latestSession.failedRecords,
            totalRecords: latestSession.totalRecords,
            successfulRecords: latestSession.successfulRecords,
            failedRecords: latestSession.failedRecords,
            completedAt: undefined, // completedAt is not available in the transformed structure
            startedAt: new Date(latestSession.createdAt)
          };
        })
        .slice(0, 5), // Show only 5 most recent
      activeCount: data.projects.filter(project => 
        project.sessions.some(session => session.status === 'RUNNING')
      ).length
    }
  };

  if (data.isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-heading-xl text-foreground mb-2">Home</h1>
          <p className="text-body-lg text-muted-foreground">
            Monitor your 2cloudnine migrations and org connections
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-c9-blue-500"></div>
          <span className="ml-2 text-muted-foreground">Loading home data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-heading-xl text-foreground mb-2">Home</h1>
            <p className="text-body-lg text-muted-foreground">
              Monitor your 2cloudnine migrations and org connections
            </p>
          </div>
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
        </div>

        {/* Error State */}
        {data.error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{data.error}</p>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orgConnections.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.orgConnections.active} active, {stats.orgConnections.issues} with issues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Records Migrated</CardTitle>
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.migrations.totalRecordsMigrated.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across all migrations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Migrations</CardTitle>
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.migrations.activeCount}</div>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>
        </div>



        {/* Recent Migrations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Migrations</CardTitle>
              <CardDescription>
                Latest migration sessions and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.migrations.recent.length > 0 ? (
                  stats.migrations.recent.map((migration) => (
                    <Link key={migration.id} href={`/migrations/${migration.id}`} className="block">
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium">{migration.name}</p>
                          <p className="text-sm text-muted-foreground">{migration.templateName || migration.objectType}</p>
                          {migration.status === 'RUNNING' && (
                            <div className="space-y-2">
                              <Progress value={(migration.processedRecords / migration.totalRecords) * 100} />
                              <p className="text-xs text-muted-foreground">
                                {migration.processedRecords} of {migration.totalRecords} records
                              </p>
                            </div>
                          )}
                          {(migration.status === 'COMPLETED' || migration.status === 'FAILED') && (
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span className="text-c9-green-600">
                                ✓ {migration.successfulRecords.toLocaleString()} successful
                              </span>
                              {migration.failedRecords > 0 && (
                                <span className="text-red-600">
                                  ✗ {migration.failedRecords.toLocaleString()} failed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            migration.status === 'COMPLETED' 
                              ? 'bg-c9-green-500/10 text-c9-green-600'
                              : migration.status === 'RUNNING'
                              ? 'bg-c9-blue-500/10 text-c9-blue-500'
                              : migration.status === 'FAILED'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {migration.status.toLowerCase()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recent migrations found</p>
                    <p className="text-sm mt-1">Create your first migration project to get started</p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Link href="/migrations">
                  <Button variant="outline" className="w-full">
                    View All Migrations
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Get started with common migration tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Link href="/orgs?connect=true" className="block">
                  <Button className="w-full justify-start h-12 text-left" variant="outline">
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Connect New Organisation
                  </Button>
                </Link>
                {hasRunningMigration ? (
                  <Button 
                    className="w-full justify-start h-12 text-left" 
                    variant="outline"
                    disabled={true}
                    title="Cannot start new migration while another is in progress"
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Create Migration Project
                  </Button>
                ) : (
                  <Link href="/migrations/new" className="block">
                    <Button 
                      className="w-full justify-start h-12 text-left" 
                      variant="outline"
                    >
                      <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Create Migration Project
                    </Button>
                  </Link>
                )}
                <Link href="/templates" className="block">
                  <Button className="w-full justify-start h-12 text-left" variant="outline">
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Browse Migration Templates
                  </Button>
                </Link>
                <Link href="/analytics" className="block">
                  <Button className="w-full justify-start h-12 text-left" variant="outline">
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    View Migration Analytics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  )
} 