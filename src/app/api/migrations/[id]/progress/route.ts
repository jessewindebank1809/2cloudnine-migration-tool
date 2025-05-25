import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { migrationSessionManager } from '@/lib/migration/migration-session-manager';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/migrations/[id]/progress - Get migration progress
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get active sessions for this project
    const sessions = await prisma.migration_sessions.findMany({
      where: {
        project_id: params.id,
        status: {
          in: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']
        }
      },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: {
            migration_records: true
          }
        }
      }
    });

    if (sessions.length === 0) {
      return NextResponse.json({
        projectId: params.id,
        status: 'IDLE',
        sessions: []
      });
    }

    // Get detailed progress for active sessions
    const sessionProgress = await Promise.all(
      sessions.map(async (session) => {
        // For running sessions, get real-time progress
        if (session.status === 'RUNNING') {
          try {
            const progress = await migrationSessionManager.getProgress(session.id);
            return {
              ...session,
              progress
            };
          } catch (error) {
            // Session might have completed
            return session;
          }
        }
        
        // For completed/failed sessions, calculate from stored data
        return {
          ...session,
          progress: {
            sessionId: session.id,
            status: session.status,
            totalRecords: session.total_records,
            processedRecords: session.processed_records,
            successfulRecords: session.successful_records,
            failedRecords: session.failed_records,
            percentComplete: session.total_records > 0 
              ? Math.round((session.processed_records / session.total_records) * 100)
              : 0,
          }
        };
      })
    );

    // Calculate overall project progress
    const totalRecords = sessions.reduce((sum, s) => sum + s.total_records, 0);
    const processedRecords = sessions.reduce((sum, s) => sum + s.processed_records, 0);
    const successfulRecords = sessions.reduce((sum, s) => sum + s.successful_records, 0);
    const failedRecords = sessions.reduce((sum, s) => sum + s.failed_records, 0);
    const overallProgress = totalRecords > 0 
      ? Math.round((processedRecords / totalRecords) * 100)
      : 0;

    // Determine overall status
    const hasRunning = sessions.some(s => s.status === 'RUNNING');
    const hasFailed = sessions.some(s => s.status === 'FAILED');
    const allCompleted = sessions.every(s => s.status === 'COMPLETED');
    
    let overallStatus = 'IDLE';
    if (hasRunning) overallStatus = 'RUNNING';
    else if (allCompleted) overallStatus = 'COMPLETED';
    else if (hasFailed) overallStatus = 'PARTIAL_SUCCESS';

    return NextResponse.json({
      projectId: params.id,
      status: overallStatus,
      overall: {
        totalRecords,
        processedRecords,
        successfulRecords,
        failedRecords,
        percentComplete: overallProgress,
      },
      sessions: sessionProgress,
    });

  } catch (error) {
    console.error('Error getting migration progress:', error);
    return NextResponse.json(
      { error: 'Failed to get migration progress' },
      { status: 500 }
    );
  }
} 