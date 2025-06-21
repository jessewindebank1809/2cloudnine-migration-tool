import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { ValidationEngine } from '@/lib/migration/templates/core/validation-engine';
import '@/lib/migration/templates/registry';

interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  recordId?: string;
  field?: string;
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

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

    // Use the template's validation engine
    const validationEngine = new ValidationEngine();
    const engineValidationResult = await validationEngine.validateTemplate(
      template,
      sourceOrgId,
      targetOrgId,
      selectedRecords
    );

    // Convert engine validation results to API format
    const issues: ValidationIssue[] = [];

    // Add errors
    engineValidationResult.errors.forEach((error, index) => {
      issues.push({
        id: `error-${index}`,
        severity: 'error',
        title: error.checkName,
        description: error.message,
        recordId: error.recordId || undefined,
        field: error.checkName.includes('picklist') ? error.checkName.replace('picklistValidation_', '') : undefined,
        suggestion: error.suggestedAction || undefined
      });
    });

    // Add warnings
    engineValidationResult.warnings.forEach((warning, index) => {
      issues.push({
        id: `warning-${index}`,
        severity: 'warning',
        title: warning.checkName,
        description: warning.message,
        recordId: warning.recordId || undefined,
        suggestion: warning.suggestedAction || undefined
      });
    });

    // Add info messages
    engineValidationResult.info.forEach((info, index) => {
      issues.push({
        id: `info-${index}`,
        severity: 'info',
        title: info.checkName,
        description: info.message,
        recordId: info.recordId || undefined,
        suggestion: info.suggestedAction || undefined
      });
    });

    // Add large batch warning if needed
    if (selectedRecords.length > 200) {
      issues.push({
        id: 'large-batch-warning',
        severity: 'warning',
        title: 'Large Number of Records Selected',
        description: `You have selected ${selectedRecords.length} records. Large migrations may take longer and have higher failure rates.`,
        suggestion: 'Consider breaking this into smaller batches for better reliability.'
      });
    }

    // Calculate summary
    const summary = {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    };

    const validationResult: ValidationResult = {
      isValid: summary.errors === 0,
      hasErrors: summary.errors > 0,
      hasWarnings: summary.warnings > 0,
      issues,
      summary
    };

    return NextResponse.json({
      success: true,
      validation: validationResult
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