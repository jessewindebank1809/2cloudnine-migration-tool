import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth(request);
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const includeErrors = searchParams.get('includeErrors') === 'true';
    
    // Get recent migration sessions
    const recentSessions = await prisma.migration_sessions.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        migration_projects: {
          include: {
            User: {
              select: {
                email: true,
                name: true
              }
            },
            organisations_migration_projects_source_org_idToorganisations: {
              select: {
                name: true
              }
            },
            organisations_migration_projects_target_org_idToorganisations: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    // Format the response
    const formattedSessions = recentSessions.map(session => {
      const startTime = session.started_at || session.created_at;
      const endTime = session.completed_at;
      const duration = endTime && startTime ? 
        Math.round((endTime.getTime() - startTime.getTime()) / 1000) : 
        null;
      
      const errors = session.error_log && Array.isArray(session.error_log) ? 
        session.error_log.filter((e: any) => e.error || e.message) : 
        [];

      return {
        id: session.id,
        status: session.status,
        user: session.migration_projects?.User?.email || 'Unknown',
        sourceOrg: session.migration_projects?.organisations_migration_projects_source_org_idToorganisations?.name || 'Unknown',
        targetOrg: session.migration_projects?.organisations_migration_projects_target_org_idToorganisations?.name || 'Unknown',
        startedAt: startTime,
        completedAt: endTime,
        durationSeconds: duration,
        totalRecords: session.total_records || 0,
        successfulRecords: session.successful_records || 0,
        failedRecords: session.failed_records || 0,
        errorCount: errors.length,
        errors: includeErrors ? errors : undefined
      };
    });

    // Get statistics for last 24 hours
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const stats = await prisma.migration_sessions.groupBy({
      by: ['status'],
      where: {
        created_at: {
          gte: last24Hours
        }
      },
      _count: true
    });

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    // Get the most recent successful migration
    const lastSuccessful = await prisma.migration_sessions.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completed_at: 'desc' },
      select: {
        completed_at: true,
        id: true
      }
    });

    // Get the most recent failed migration
    const lastFailed = await prisma.migration_sessions.findFirst({
      where: { status: 'FAILED' },
      orderBy: { created_at: 'desc' },
      select: {
        created_at: true,
        id: true
      }
    });

    return NextResponse.json({
      success: true,
      recentSessions: formattedSessions,
      statistics: {
        last24Hours: {
          total: Object.values(statsMap).reduce((a, b) => a + b, 0),
          completed: statsMap.COMPLETED || 0,
          failed: statsMap.FAILED || 0,
          inProgress: statsMap.IN_PROGRESS || 0
        },
        lastSuccessful: lastSuccessful ? {
          id: lastSuccessful.id,
          completedAt: lastSuccessful.completed_at
        } : null,
        lastFailed: lastFailed ? {
          id: lastFailed.id,
          failedAt: lastFailed.created_at
        } : null
      }
    });
    
  } catch (error) {
    console.error('Failed to retrieve recent migrations:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve recent migrations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}