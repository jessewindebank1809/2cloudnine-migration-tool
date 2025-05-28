import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
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

    const issues: ValidationIssue[] = [];

    // Validation 1: Check source organisation connectivity
    try {
      const sourceClient = await sessionManager.getClient(sourceOrgId);
      await sourceClient.query('SELECT Id FROM User LIMIT 1');
    } catch (error) {
      issues.push({
        id: 'source-connectivity',
        severity: 'error',
        title: 'Source Organisation Connection Failed',
        description: 'Unable to connect to the source organisation. The authentication token may have expired.',
        suggestion: 'Please reconnect the source organisation and try again.'
      });
    }

    // Validation 2: Check target organisation connectivity
    try {
      const targetClient = await sessionManager.getClient(targetOrgId);
      await targetClient.query('SELECT Id FROM User LIMIT 1');
    } catch (error) {
      issues.push({
        id: 'target-connectivity',
        severity: 'error',
        title: 'Target Organisation Connection Failed',
        description: 'Unable to connect to the target organisation. The authentication token may have expired.',
        suggestion: 'Please reconnect the target organisation and try again.'
      });
    }

    // Validation 3: Check if selected records still exist
    if (issues.length === 0) { // Only if connectivity is OK
      try {
        const sourceClient = await sessionManager.getClient(sourceOrgId);
        const primaryObject = template.etlSteps[0]?.extractConfig?.objectApiName;
        
        if (primaryObject) {
          const recordIds = selectedRecords.map((id: string) => `'${id}'`).join(',');
          const query = `SELECT Id, Name FROM ${primaryObject} WHERE Id IN (${recordIds})`;
          const result = await sourceClient.query(query);
          
          const foundIds = new Set(result.data?.map((record: any) => record.Id) || []);
          const missingRecords = selectedRecords.filter((id: string) => !foundIds.has(id));
          
          if (missingRecords.length > 0) {
            issues.push({
              id: 'missing-records',
              severity: 'error',
              title: `${missingRecords.length} Selected Records Not Found`,
              description: `Some of the selected records no longer exist in the source organisation.`,
              suggestion: 'Please go back and reselect your records.'
            });
          }
        }
      } catch (error) {
        issues.push({
          id: 'record-validation',
          severity: 'warning',
          title: 'Unable to Validate Selected Records',
          description: 'Could not verify that all selected records still exist.',
          suggestion: 'Consider reselecting records to ensure they are current.'
        });
      }
    }

    // Validation 4: Check target organisation object permissions
    if (issues.filter(i => i.severity === 'error').length === 0) {
      try {
        const targetClient = await sessionManager.getClient(targetOrgId);
        const primaryObject = template.etlSteps[0]?.extractConfig?.objectApiName;
        
        if (primaryObject) {
          // Try to get object metadata to check if it exists and we have access
          const metadataResult = await targetClient.getObjectMetadata(primaryObject);
          
          if (!metadataResult.success) {
            issues.push({
              id: 'target-object-access',
              severity: 'error',
              title: `Cannot Access ${primaryObject} in Target Organisation`,
              description: 'The target organisation does not have the required object or you lack permissions.',
              suggestion: 'Ensure the target organisation has the required objects and permissions.'
            });
          } else {
            // For now, we'll assume createable if we can access the object
            // In a future enhancement, we could check specific field permissions
            issues.push({
              id: 'target-object-verified',
              severity: 'info',
              title: `${primaryObject} Object Verified`,
              description: 'Successfully verified access to the target object.',
              suggestion: ''
            });
          }
        }
      } catch (error) {
        issues.push({
          id: 'target-permissions',
          severity: 'warning',
          title: 'Unable to Verify Target Permissions',
          description: 'Could not verify permissions in the target organisation.',
          suggestion: 'Ensure you have the necessary permissions before proceeding.'
        });
      }
    }

    // Validation 5: Check for potential data issues
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