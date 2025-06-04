import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause with user filtering
    const whereClause: any = {
      migration_projects: {
        user_id: session.user.id // Only show scheduled migrations for user's projects
      }
    };
    if (status) {
      whereClause.status = status.toUpperCase();
    }

    // Get scheduled migrations
    const scheduledMigrations = await prisma.scheduled_migrations.findMany({
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
        next_run_at: 'asc'
      },
      take: limit,
      skip: offset
    });

    // Get total count
    const totalCount = await prisma.scheduled_migrations.count({
      where: whereClause
    });

    // Format response
    const formattedMigrations = scheduledMigrations.map(scheduled => ({
      id: scheduled.id,
      name: scheduled.name,
      description: scheduled.description,
      cronExpression: scheduled.cron_expression,
      timezone: scheduled.timezone,
      status: scheduled.status,
      isActive: scheduled.is_active,
      nextRunAt: scheduled.next_run_at,
      lastRunAt: scheduled.last_run_at,
      lastRunStatus: scheduled.last_run_status,
      totalRuns: scheduled.total_runs,
      successfulRuns: scheduled.successful_runs,
      failedRuns: scheduled.failed_runs,
      createdAt: scheduled.created_at,
      project: {
        id: scheduled.migration_projects.id,
        name: scheduled.migration_projects.name,
        sourceOrg: scheduled.migration_projects.organisations_migration_projects_source_org_idToorganisations.name,
        targetOrg: scheduled.migration_projects.organisations_migration_projects_target_org_idToorganisations.name
      },
      config: scheduled.execution_config
    }));

    return NextResponse.json({
      success: true,
      scheduledMigrations: formattedMigrations,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching scheduled migrations:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch scheduled migrations', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const body = await request.json();
    const {
      name,
      description,
      projectId,
      cronExpression,
      timezone = 'UTC',
      isActive = true,
      executionConfig = {}
    } = body;

    // Validate required fields
    if (!name || !projectId || !cronExpression) {
      return NextResponse.json(
        { error: 'Missing required fields: name, projectId, cronExpression' },
        { status: 400 }
      );
    }

    // Validate cron expression (basic validation)
    const cronParts = cronExpression.split(' ');
    if (cronParts.length !== 5) {
      return NextResponse.json(
        { error: 'Invalid cron expression. Must have 5 parts: minute hour day month weekday' },
        { status: 400 }
      );
    }

    // Verify project exists and belongs to current user
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: projectId,
        user_id: session.user.id // Ensure project belongs to current user
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or does not belong to you' },
        { status: 404 }
      );
    }

    // Calculate next run time (simplified - in production would use a proper cron parser)
    const nextRunAt = calculateNextRun(cronExpression, timezone);

    // Create scheduled migration
    const scheduledMigration = await prisma.scheduled_migrations.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description,
        project_id: projectId,
        cron_expression: cronExpression,
        timezone,
        is_active: isActive,
        status: 'ACTIVE',
        next_run_at: nextRunAt,
        execution_config: executionConfig,
        created_at: new Date(),
        updated_at: new Date()
      },
      include: {
        migration_projects: {
          include: {
            organisations_migration_projects_source_org_idToorganisations: true,
            organisations_migration_projects_target_org_idToorganisations: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      scheduledMigration: {
        id: scheduledMigration.id,
        name: scheduledMigration.name,
        description: scheduledMigration.description,
        cronExpression: scheduledMigration.cron_expression,
        timezone: scheduledMigration.timezone,
        status: scheduledMigration.status,
        isActive: scheduledMigration.is_active,
        nextRunAt: scheduledMigration.next_run_at,
        project: {
          id: scheduledMigration.migration_projects.id,
          name: scheduledMigration.migration_projects.name,
          sourceOrg: scheduledMigration.migration_projects.organisations_migration_projects_source_org_idToorganisations.name,
          targetOrg: scheduledMigration.migration_projects.organisations_migration_projects_target_org_idToorganisations.name
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating scheduled migration:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create scheduled migration', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Simplified next run calculation - in production would use a proper cron library
function calculateNextRun(cronExpression: string, timezone: string): Date {
  // For now, just schedule for next hour as a placeholder
  // In production, would use libraries like 'node-cron' or 'cron-parser'
  const nextRun = new Date();
  nextRun.setHours(nextRun.getHours() + 1);
  nextRun.setMinutes(0);
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);
  return nextRun;
} 