import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
import { ValidationEngine } from '@/lib/migration/templates/core/validation-engine';
import { TemplateRegistry } from '@/lib/migration/templates/core/template-registry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const { id: projectId } = await params;
    const body = await request.json();
    const { selectedRecords } = body;

    // Get migration project and ensure it belongs to current user
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: projectId,
        user_id: session.user.id // Ensure project belongs to current user
      },
      include: {
        migration_template_usage: {
          include: {
            migration_templates: true
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

    // Check if project has a template
    const templateUsage = project.migration_template_usage?.[0];
    if (!templateUsage) {
      return NextResponse.json(
        { error: 'No template associated with this project' },
        { status: 400 }
      );
    }

    // Get template from registry
    const templateRegistry = new TemplateRegistry();
    const template = templateRegistry.getTemplate(templateUsage.migration_templates.id);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found in registry' },
        { status: 404 }
      );
    }

    // Run validation
    const validationEngine = new ValidationEngine();
    const validationResult = await validationEngine.validateTemplate(
      template,
      project.source_org_id,
      project.target_org_id,
      selectedRecords
    );

    // Store validation results
    await prisma.migration_template_usage.update({
      where: { id: templateUsage.id },
      data: {
        validation_results: validationResult as any,
        selected_records: selectedRecords || [],
      }
    });

    return NextResponse.json({
      success: true,
      validationResult,
      summary: {
        totalChecks: validationResult.summary.totalChecks,
        passedChecks: validationResult.summary.passedChecks,
        failedChecks: validationResult.summary.failedChecks,
        warningChecks: validationResult.summary.warningChecks,
        isValid: validationResult.isValid,
        canProceed: validationResult.errors.length === 0
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Validation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const { id: projectId } = await params;

    // First verify the migration project belongs to current user
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: projectId,
        user_id: session.user.id // Ensure project belongs to current user
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    // Get stored validation results
    const templateUsage = await prisma.migration_template_usage.findFirst({
      where: { 
        project_id: projectId 
      },
      include: {
        migration_templates: true
      }
    });

    if (!templateUsage) {
      return NextResponse.json(
        { error: 'No template usage found for this project' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      validationResult: templateUsage.validation_results,
      selectedRecords: templateUsage.selected_records,
      template: {
        id: templateUsage.migration_templates.id,
        name: templateUsage.migration_templates.name,
        category: templateUsage.migration_templates.category
      }
    });

  } catch (error) {
    console.error('Error retrieving validation results:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve validation results', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 