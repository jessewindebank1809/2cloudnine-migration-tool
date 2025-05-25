import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { z } from 'zod';

// Schema for creating a new migration project
const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  config: z.object({
    objectTypes: z.array(z.string()).min(1),
    useBulkApi: z.boolean().optional(),
    preserveRelationships: z.boolean().optional(),
    allowPartialSuccess: z.boolean().optional(),
  }).optional(),
});

/**
 * GET /api/migrations - List all migration projects
 */
export async function GET(request: NextRequest) {
  try {
    const projects = await prisma.migration_projects.findMany({
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
          take: 5,
          select: {
            id: true,
            object_type: true,
            status: true,
            total_records: true,
            successful_records: true,
            failed_records: true,
            created_at: true,
            completed_at: true,
          }
        }
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      projects,
      total: projects.length,
    });
  } catch (error) {
    console.error('Error fetching migration projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch migration projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/migrations - Create a new migration project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = CreateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { name, description, sourceOrgId, targetOrgId, config } = validation.data;

    // Verify organizations exist and are connected
    const [sourceOrg, targetOrg] = await Promise.all([
      prisma.organisations.findUnique({ where: { id: sourceOrgId } }),
      prisma.organisations.findUnique({ where: { id: targetOrgId } }),
    ]);

    if (!sourceOrg || !targetOrg) {
      return NextResponse.json(
        { error: 'One or more organizations not found' },
        { status: 404 }
      );
    }

    if (!sourceOrg.access_token_encrypted || !targetOrg.access_token_encrypted) {
      return NextResponse.json(
        { error: 'One or more organizations not connected' },
        { status: 400 }
      );
    }

    // TODO: Get userId from session when auth is implemented
    // For now, we'll use the first user in the database or create a placeholder
    const userId = sourceOrg.user_id; // Use the source org's user as the project creator

    // Create the migration project
    const project = await prisma.migration_projects.create({
      data: {
        name,
        description: description || null,
        source_org_id: sourceOrgId,
        target_org_id: targetOrgId,
        config: config || {},
        status: 'DRAFT',
        user_id: userId,
      },
      include: {
        organisations_migration_projects_source_org_idToorganisations: true,
        organisations_migration_projects_target_org_idToorganisations: true,
      }
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating migration project:', error);
    return NextResponse.json(
      { error: 'Failed to create migration project' },
      { status: 500 }
    );
  }
} 