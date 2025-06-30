import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and get current user
    const authSession = await requireAuth(request);
    
    // Await params as required by Next.js 15
    const { id: migrationId } = await params;

    // Get migration project and ensure it belongs to current user
    const migration = await prisma.migration_projects.findFirst({
      where: { 
        id: migrationId,
        user_id: authSession.user.id
      }
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    // Check if migration is in a reprocessable state
    if (migration.status !== 'COMPLETED' && migration.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Migration can only be reprocessed when in COMPLETED or FAILED status' },
        { status: 400 }
      );
    }

    // Check if there's already a running migration
    const runningMigrations = await prisma.migration_projects.count({
      where: {
        user_id: authSession.user.id,
        status: 'RUNNING'
      }
    });

    if (runningMigrations > 0) {
      return NextResponse.json(
        { error: 'Cannot reprocess while another migration is running' },
        { status: 409 }
      );
    }

    // Update migration status to RUNNING
    await prisma.migration_projects.update({
      where: { id: migrationId },
      data: {
        status: 'RUNNING',
        updated_at: new Date()
      }
    });

    // Return success response with redirect URL
    // The actual execution will happen on the execute page
    return NextResponse.json({
      success: true,
      message: 'Migration reprocessing initiated',
      redirectUrl: `/migrations/${migrationId}/execute?reprocess=true`
    });

  } catch (error: unknown) {
    console.error('Reprocess migration error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to reprocess migration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}