import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
import { z } from 'zod';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';

// Schema for creating a new migration project
const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  templateId: z.string().optional(),
  selectedRecords: z.array(z.string()).optional(),
  config: z.object({
    objectTypes: z.array(z.string()).optional(),
    useBulkApi: z.boolean().optional(),
    preserveRelationships: z.boolean().optional(),
    allowPartialSuccess: z.boolean().optional(),
  }).optional(),
});

/**
 * GET /api/migrations - List all migration projects for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const rawProjects = await prisma.migration_projects.findMany({
      where: {
        user_id: session.user.id, // Filter by current user
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

    // Transform the data to match frontend expectations
    const projects = rawProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      templateId: (project.config as Prisma.JsonValue as { templateId?: string })?.templateId || null,
      sourceOrg: {
        id: project.organisations_migration_projects_source_org_idToorganisations?.id || '',
        name: project.organisations_migration_projects_source_org_idToorganisations?.name || 'Unknown',
        instanceUrl: project.organisations_migration_projects_source_org_idToorganisations?.instance_url || '',
      },
      targetOrg: {
        id: project.organisations_migration_projects_target_org_idToorganisations?.id || '',
        name: project.organisations_migration_projects_target_org_idToorganisations?.name || 'Unknown',
        instanceUrl: project.organisations_migration_projects_target_org_idToorganisations?.instance_url || '',
      },
      sessions: project.migration_sessions.map(session => ({
        id: session.id,
        objectType: session.object_type,
        status: session.status,
        totalRecords: session.total_records || 0,
        successfulRecords: session.successful_records || 0,
        failedRecords: session.failed_records || 0,
        createdAt: session.created_at.toISOString(),
      })),
      createdAt: project.created_at.toISOString(),
      updatedAt: project.updated_at.toISOString(),
    }));

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
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const body = await request.json();
    const validation = CreateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { name, description, sourceOrgId, targetOrgId, templateId, selectedRecords, config } = validation.data;

    // Verify organisations exist and belong to the current user
    const [sourceOrg, targetOrg] = await Promise.all([
      prisma.organisations.findFirst({ 
        where: { 
          id: sourceOrgId,
          user_id: session.user.id // Ensure org belongs to current user
        } 
      }),
      prisma.organisations.findFirst({ 
        where: { 
          id: targetOrgId,
          user_id: session.user.id // Ensure org belongs to current user
        } 
      }),
    ]);

    if (!sourceOrg || !targetOrg) {
      return NextResponse.json(
        { error: 'One or more organisations not found or do not belong to you' },
        { status: 404 }
      );
    }

    if (!sourceOrg.access_token_encrypted || !targetOrg.access_token_encrypted) {
      return NextResponse.json(
        { error: 'One or more organisations not connected' },
        { status: 400 }
      );
    }

    // Create the migration project
    const projectId = crypto.randomUUID();
    
    // Build the config object with selected records and template
    const projectConfig: Record<string, unknown> = {
      ...(config || {}),
      selectedRecords: selectedRecords || [],
    };
    
    if (templateId) {
      projectConfig.templateId = templateId;
    }

    const project = await prisma.migration_projects.create({
      data: {
        id: projectId,
        name,
        description: description || null,
        source_org_id: sourceOrgId,
        target_org_id: targetOrgId,
        config: projectConfig as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        user_id: session.user.id, // Use authenticated user
        updated_at: new Date(),
      },
      include: {
        organisations_migration_projects_source_org_idToorganisations: true,
        organisations_migration_projects_target_org_idToorganisations: true,
      }
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating migration project:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create migration project' },
      { status: 500 }
    );
  }
} 