import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { z } from 'zod';

// Schema for updating a migration project
const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  config: z.object({
    objectTypes: z.array(z.string()).min(1),
    useBulkApi: z.boolean().optional(),
    preserveRelationships: z.boolean().optional(),
    allowPartialSuccess: z.boolean().optional(),
  }).optional(),
  status: z.enum(['DRAFT', 'READY', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/migrations/[id] - Get a specific migration project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const project = await prisma.migration_projects.findUnique({
      where: { id: params.id },
      include: {
        organisations_migration_projects_source_org_idToorganisations: {
          select: {
            id: true,
            name: true,
            instance_url: true,
            salesforce_org_id: true,
          }
        },
        organisations_migration_projects_target_org_idToorganisations: {
          select: {
            id: true,
            name: true,
            instance_url: true,
            salesforce_org_id: true,
          }
        },
        migration_sessions: {
          orderBy: { created_at: 'desc' },
          include: {
            _count: {
              select: {
                migration_records: true
              }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching migration project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch migration project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/migrations/[id] - Update a migration project
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const validation = UpdateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Check if project exists
    const existing = await prisma.migration_projects.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    // Don't allow updates to running projects
    if (existing.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Cannot update a running migration' },
        { status: 400 }
      );
    }

    // Update the project
    const updated = await prisma.migration_projects.update({
      where: { id: params.id },
      data: {
        ...validation.data,
        updated_at: new Date(),
      },
      include: {
        organisations_migration_projects_source_org_idToorganisations: {
          select: {
            id: true,
            name: true,
            instance_url: true,
            salesforce_org_id: true,
          }
        },
        organisations_migration_projects_target_org_idToorganisations: {
          select: {
            id: true,
            name: true,
            instance_url: true,
            salesforce_org_id: true,
          }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating migration project:', error);
    return NextResponse.json(
      { error: 'Failed to update migration project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/migrations/[id] - Delete a migration project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check if project exists and is not running
    const existing = await prisma.migration_projects.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    if (existing.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Cannot delete a running migration' },
        { status: 400 }
      );
    }

    // Delete the project (cascade will handle sessions and records)
    await prisma.migration_projects.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting migration project:', error);
    return NextResponse.json(
      { error: 'Failed to delete migration project' },
      { status: 500 }
    );
  }
} 