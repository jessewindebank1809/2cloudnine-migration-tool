import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { ValidationEngine } from '@/lib/migration/templates/core/validation-engine';
import '@/lib/migration/templates/registry';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceOrgId, targetOrgId, templateId, selectedRecords } = body;

    if (!sourceOrgId || !targetOrgId || !templateId || !selectedRecords?.length) {
      return NextResponse.json(
        { error: 'Missing required validation parameters' },
        { status: 400 }
      );
    }

    // Get organisations
    const [sourceOrg, targetOrg] = await Promise.all([
      prisma.organisations.findUnique({ where: { id: sourceOrgId } }),
      prisma.organisations.findUnique({ where: { id: targetOrgId } })
    ]);

    if (!sourceOrg || !targetOrg) {
      return NextResponse.json(
        { error: 'Source or target organisation not found' },
        { status: 404 }
      );
    }

    // Get template
    const template = templateRegistry.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Use the ValidationEngine to run all validations including picklist validation
    const validationEngine = new ValidationEngine();
    const validationResult = await validationEngine.validateTemplate(
      template,
      sourceOrgId,
      targetOrgId,
      selectedRecords
    );

    // Transform the ValidationResult to match the expected format for the UI
    // The UI expects a different structure with issues array
    const issues = [
      ...validationResult.errors.map(error => ({
        id: error.checkName,
        severity: 'error' as const,
        title: error.checkName,
        description: error.message,
        recordId: error.recordId,
        field: error.field,
        suggestion: error.suggestedAction || ''
      })),
      ...validationResult.warnings.map(warning => ({
        id: warning.checkName,
        severity: 'warning' as const,
        title: warning.checkName,
        description: warning.message,
        recordId: warning.recordId,
        field: warning.field,
        suggestion: warning.suggestedAction || ''
      })),
      ...validationResult.info.map(info => ({
        id: info.checkName,
        severity: 'info' as const,
        title: info.checkName,
        description: info.message,
        recordId: info.recordId,
        field: info.field,
        suggestion: info.suggestedAction || ''
      }))
    ];

    const transformedResult = {
      isValid: validationResult.isValid,
      hasErrors: validationResult.errors.length > 0,
      hasWarnings: validationResult.warnings.length > 0,
      issues,
      summary: {
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
        info: validationResult.info.length,
      }
    };

    return NextResponse.json({
      success: true,
      validation: transformedResult
    });

  } catch (error) {
    console.error('Validation error:', error);
    
    // Check if it's a token-related error
    if (error instanceof Error && (
      error.message.includes('invalid_grant') || 
      error.message.includes('expired') ||
      error.message.includes('INVALID_SESSION_ID') ||
      error.message.includes('Authentication token has expired') ||
      error.message.includes('not connected')
    )) {
      return NextResponse.json(
        { 
          error: 'Authentication token has expired. Please reconnect the organisation.',
          code: 'TOKEN_EXPIRED',
          reconnectUrl: '/orgs'
        },
        { status: 401 }
      );
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