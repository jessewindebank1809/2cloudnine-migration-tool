import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-check';
import { prisma } from '@/lib/database/prisma';
import { usageTracker } from '@/lib/usage-tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Check admin access
    await requireAdmin(request);
    
    const { userId } = await params;
    
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get user's migration projects with detailed information
    const projects = await prisma.migration_projects.findMany({
      where: { user_id: userId },
      include: {
        organisations_migration_projects_source_org_idToorganisations: {
          select: {
            id: true,
            name: true,
            salesforce_org_id: true
          }
        },
        organisations_migration_projects_target_org_idToorganisations: {
          select: {
            id: true,
            name: true,
            salesforce_org_id: true
          }
        },
        migration_sessions: {
          orderBy: { created_at: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            total_records: true,
            successful_records: true,
            failed_records: true,
            started_at: true,
            completed_at: true,
            error_log: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    
    // Get usage events for this user
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usageEvents = await prisma.usage_events.findMany({
      where: {
        user_id: userId,
        created_at: { gte: thirtyDaysAgo }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });
    
    // Get migration error analysis for this user
    const migrationErrors = usageEvents
      .filter(event => event.event_type === 'migration_failed')
      .map(event => ({
        migrationId: event.migration_id,
        timestamp: event.created_at,
        error: (event.metadata as any)?.error || 'Unknown error',
        errorCode: (event.metadata as any)?.errorCode,
        templateId: (event.metadata as any)?.templateId,
        sourceOrgId: (event.metadata as any)?.sourceOrgId,
        targetOrgId: (event.metadata as any)?.targetOrgId,
        failedAtStep: (event.metadata as any)?.failedAtStep,
        technicalDetails: (event.metadata as any)?.validationErrors || []
      }));
    
    // Calculate user statistics
    const stats = {
      totalProjects: projects.length,
      totalMigrations: projects.reduce((sum, p) => sum + p.migration_sessions.length, 0),
      successfulMigrations: projects.reduce((sum, p) => 
        sum + p.migration_sessions.filter((s: any) => s.status === 'COMPLETED' && s.failed_records === 0).length, 0
      ),
      failedMigrations: projects.reduce((sum, p) => 
        sum + p.migration_sessions.filter((s: any) => s.status === 'FAILED' || s.failed_records > 0).length, 0
      ),
      totalRecordsProcessed: projects.reduce((sum, p) => 
        sum + p.migration_sessions.reduce((s: number, session: any) => s + (session.total_records || 0), 0), 0
      ),
      recentErrors: migrationErrors.length
    };
    
    // Get error patterns
    const errorPatterns = migrationErrors.reduce((acc, error) => {
      const code = error.errorCode || 'UNKNOWN';
      if (!acc[code]) {
        acc[code] = {
          count: 0,
          examples: [],
          templates: new Set<string>(),
          lastOccurred: error.timestamp
        };
      }
      acc[code].count++;
      if (acc[code].examples.length < 3) {
        acc[code].examples.push({
          migrationId: error.migrationId,
          error: error.error,
          timestamp: error.timestamp
        });
      }
      if (error.templateId) {
        acc[code].templates.add(error.templateId);
      }
      return acc;
    }, {} as Record<string, any>);
    
    // Convert sets to arrays for JSON serialization
    Object.keys(errorPatterns).forEach(key => {
      errorPatterns[key].templates = Array.from(errorPatterns[key].templates);
    });
    
    return NextResponse.json({
      success: true,
      user,
      stats,
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        templateId: (project.config as any)?.templateId,
        sourceOrg: (project as any).organisations_migration_projects_source_org_idToorganisations,
        targetOrg: (project as any).organisations_migration_projects_target_org_idToorganisations,
        status: project.status,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        recentSessions: project.migration_sessions.map((session: any) => ({
          id: session.id,
          status: session.status,
          totalRecords: session.total_records,
          successfulRecords: session.successful_records,
          failedRecords: session.failed_records,
          startedAt: session.started_at,
          completedAt: session.completed_at,
          duration: session.completed_at && session.started_at
            ? session.completed_at.getTime() - session.started_at.getTime()
            : null,
          errors: (session.error_log as any[] || [])
            .filter(log => log.error || log.stepName)
            .slice(0, 5)
        }))
      })),
      recentErrors: migrationErrors.slice(0, 20),
      errorPatterns
    });
    
  } catch (error) {
    console.error('Error fetching user details:', error);
    
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}