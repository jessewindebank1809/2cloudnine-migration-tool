import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';

// Force dynamic rendering with optimizations
export const dynamic = 'force-dynamic';
// Keep nodejs for Prisma compatibility, but with optimizations
export const runtime = 'nodejs';
export const maxDuration = 60; // Increase timeout for complex analytics
export const revalidate = 300; // Cache for 5 minutes when possible

export async function GET(request: NextRequest) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d'; // 7d, 30d, 90d, 1y
    const orgId = searchParams.get('orgId');

    // Calculate date range
    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    // Build where clause with user filtering
    const whereClause: any = {
      created_at: {
        gte: startDate
      },
      migration_projects: {
        user_id: session.user.id // Only show analytics for user's projects
      }
    };

    if (orgId) {
      // Verify the org belongs to the current user before filtering by it
      const org = await prisma.organisations.findFirst({
        where: { 
          id: orgId,
          user_id: session.user.id 
        }
      });
      
      if (org) {
        whereClause.OR = [
          { 
            migration_projects: { 
              source_org_id: orgId,
              user_id: session.user.id 
            } 
          },
          { 
            migration_projects: { 
              target_org_id: orgId,
              user_id: session.user.id 
            } 
          }
        ];
        // Remove the general user_id filter since it's now in the OR clause
        delete whereClause.migration_projects;
      }
    }

    // Get migration sessions with project data
    const sessions = await prisma.migration_sessions.findMany({
      where: whereClause,
      include: {
        migration_projects: {
          include: {
            organisations_migration_projects_source_org_idToorganisations: true,
            organisations_migration_projects_target_org_idToorganisations: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Calculate analytics
    const totalMigrations = sessions.length;
    const completedMigrations = sessions.filter((s: any) => s.status === 'COMPLETED').length;
    const failedMigrations = sessions.filter((s: any) => s.status === 'FAILED').length;
    const successRate = totalMigrations > 0 ? (completedMigrations / totalMigrations) * 100 : 0;

    const totalRecordsProcessed = sessions.reduce((sum, s) => sum + (s.processed_records || 0), 0);
    const totalRecordsSuccessful = sessions.reduce((sum, s) => sum + (s.successful_records || 0), 0);
    const recordSuccessRate = totalRecordsProcessed > 0 ? (totalRecordsSuccessful / totalRecordsProcessed) * 100 : 0;

    // Calculate average duration for completed migrations
    const completedSessions = sessions.filter((s: any) => s.status === 'COMPLETED' && s.started_at && s.completed_at);
    const averageDuration = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => {
          const duration = new Date(s.completed_at!).getTime() - new Date(s.started_at!).getTime();
          return sum + duration;
        }, 0) / completedSessions.length
      : 0;

    // Group by date for trend analysis
    const dailyStats = sessions.reduce((acc, session) => {
      const date = session.created_at.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          total: 0,
          completed: 0,
          failed: 0,
          recordsProcessed: 0,
          recordsSuccessful: 0
        };
      }
      acc[date].total++;
      if (session.status === 'COMPLETED') acc[date].completed++;
      if (session.status === 'FAILED') acc[date].failed++;
      acc[date].recordsProcessed += session.processed_records || 0;
      acc[date].recordsSuccessful += session.successful_records || 0;
      return acc;
    }, {} as Record<string, any>);

    // Group by object type
    const objectTypeStats = sessions.reduce((acc, session) => {
      const objectType = session.object_type || 'Unknown';
      if (!acc[objectType]) {
        acc[objectType] = {
          objectType,
          total: 0,
          completed: 0,
          failed: 0,
          recordsProcessed: 0,
          recordsSuccessful: 0
        };
      }
      acc[objectType].total++;
      if (session.status === 'COMPLETED') acc[objectType].completed++;
      if (session.status === 'FAILED') acc[objectType].failed++;
      acc[objectType].recordsProcessed += session.processed_records || 0;
      acc[objectType].recordsSuccessful += session.successful_records || 0;
      return acc;
    }, {} as Record<string, any>);

    // Recent migrations for activity feed
    const recentMigrations = sessions.slice(0, 10).map(session => ({
      id: session.id,
      projectName: session.migration_projects?.name || 'Unknown Project',
      objectType: session.object_type,
      status: session.status,
      recordsProcessed: session.processed_records,
      recordsSuccessful: session.successful_records,
      sourceOrg: session.migration_projects?.organisations_migration_projects_source_org_idToorganisations?.name,
      targetOrg: session.migration_projects?.organisations_migration_projects_target_org_idToorganisations?.name,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      duration: session.started_at && session.completed_at 
        ? new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()
        : null
    }));

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          totalMigrations,
          completedMigrations,
          failedMigrations,
          successRate: Math.round(successRate * 100) / 100,
          totalRecordsProcessed,
          totalRecordsSuccessful,
          recordSuccessRate: Math.round(recordSuccessRate * 100) / 100,
          averageDuration: Math.round(averageDuration / 1000), // Convert to seconds
        },
        trends: {
          daily: Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date)),
          objectTypes: Object.values(objectTypeStats).sort((a: any, b: any) => b.total - a.total)
        },
        recentActivity: recentMigrations
      },
      timeRange,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching migration analytics:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch migration analytics', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 