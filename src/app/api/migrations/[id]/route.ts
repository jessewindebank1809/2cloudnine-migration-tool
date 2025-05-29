import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
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
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: params.id,
        user_id: session.user.id // Ensure project belongs to current user
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

    // Transform the response to use friendly field names
    const transformedProject = {
      ...project,
      templateId: (project.config as any)?.templateId || null,
      sourceOrg: project.organisations_migration_projects_source_org_idToorganisations,
      targetOrg: project.organisations_migration_projects_target_org_idToorganisations,
      // Remove the long field names
      organisations_migration_projects_source_org_idToorganisations: undefined,
      organisations_migration_projects_target_org_idToorganisations: undefined,
    };

    return NextResponse.json(transformedProject);
  } catch (error) {
    console.error('Error fetching migration project:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const body = await request.json();
    const validation = UpdateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Check if project exists and belongs to current user
    const existing = await prisma.migration_projects.findFirst({
      where: { 
        id: params.id,
        user_id: session.user.id // Ensure project belongs to current user
      },
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

    // Transform the response to use friendly field names
    const transformedUpdated = {
      ...updated,
      templateId: (updated.config as any)?.templateId || null,
      sourceOrg: updated.organisations_migration_projects_source_org_idToorganisations,
      targetOrg: updated.organisations_migration_projects_target_org_idToorganisations,
      // Remove the long field names
      organisations_migration_projects_source_org_idToorganisations: undefined,
      organisations_migration_projects_target_org_idToorganisations: undefined,
    };

    return NextResponse.json(transformedUpdated);
  } catch (error) {
    console.error('Error updating migration project:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    // Check if project exists and belongs to current user
    const existing = await prisma.migration_projects.findFirst({
      where: { 
        id: params.id,
        user_id: session.user.id // Ensure project belongs to current user
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    // Don't allow deletion of running projects
    if (existing.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Cannot delete a running migration' },
        { status: 400 }
      );
    }

    // Delete the project (cascade will handle related records)
    await prisma.migration_projects.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting migration project:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete migration project' },
      { status: 500 }
    );
  }
} 