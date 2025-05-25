import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { migrationEngine } from '@/lib/migration/migration-engine';
import { z } from 'zod';

// Schema for execution options
const ExecuteOptionsSchema = z.object({
  objectTypes: z.array(z.string()).min(1),
  batchSize: z.number().min(1).max(2000).optional(),
  useBulkApi: z.boolean().optional(),
  preserveRelationships: z.boolean().optional(),
  allowPartialSuccess: z.boolean().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/migrations/[id]/execute - Execute a migration project
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const validation = ExecuteOptionsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid execution options', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Get project with orgs
    const project = await prisma.migration_projects.findUnique({
      where: { id: params.id },
      include: {
        organisations_migration_projects_source_org_idToorganisations: true,
        organisations_migration_projects_target_org_idToorganisations: true,
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    // Check project status
    if (project.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Migration is already running' },
        { status: 400 }
      );
    }

    if (project.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Migration has already been completed' },
        { status: 400 }
      );
    }

    // Update project status to RUNNING
    await prisma.migration_projects.update({
      where: { id: params.id },
      data: { status: 'RUNNING' }
    });

    // Execute migration asynchronously
    // In a production environment, this would be queued to a background job processor
    setImmediate(async () => {
      try {
        const result = await migrationEngine.executeMigration(
          project,
          validation.data
        );

        // Update project status based on result
        await prisma.migration_projects.update({
          where: { id: params.id },
          data: {
            status: result.success ? 'COMPLETED' : 'FAILED',
            updated_at: new Date(),
          }
        });
      } catch (error) {
        console.error('Migration execution error:', error);
        
        // Update project status to FAILED
        await prisma.migration_projects.update({
          where: { id: params.id },
          data: {
            status: 'FAILED',
            updated_at: new Date(),
          }
        });
      }
    });

    // Return immediate response
    return NextResponse.json({
      message: 'Migration started',
      projectId: project.id,
      status: 'RUNNING',
    });

  } catch (error) {
    console.error('Error starting migration:', error);
    return NextResponse.json(
      { error: 'Failed to start migration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/migrations/[id]/execute - Cancel a running migration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Get project
    const project = await prisma.migration_projects.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    if (project.status !== 'RUNNING') {
      return NextResponse.json(
        { error: 'Migration is not running' },
        { status: 400 }
      );
    }

    // Cancel the migration
    migrationEngine.cancelMigration();

    // Update project status
    await prisma.migration_projects.update({
      where: { id: params.id },
      data: {
        status: 'DRAFT',
        updated_at: new Date(),
      }
    });

    return NextResponse.json({
      message: 'Migration cancelled',
      projectId: project.id,
      status: 'DRAFT',
    });

  } catch (error) {
    console.error('Error cancelling migration:', error);
    return NextResponse.json(
      { error: 'Failed to cancel migration' },
      { status: 500 }
    );
  }
} 