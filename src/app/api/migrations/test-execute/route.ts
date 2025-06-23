import { NextRequest, NextResponse } from 'next/server';
import { ExecutionEngine, DEFAULT_EXECUTION_CONFIG } from '@/lib/migration/templates/core/execution-engine';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { registerAllTemplates } from '@/lib/migration/templates/registry';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import { prisma } from '@/lib/database/prisma';
import { sessionManager } from '@/lib/salesforce/session-manager';
import type { SalesforceOrg } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Ensure templates are registered
    registerAllTemplates();
    
    const body = await request.json();
    const { migrationId } = body;

    if (!migrationId) {
      return NextResponse.json(
        { error: 'Migration ID is required' },
        { status: 400 }
      );
    }

    // Get migration project without auth check
    const migration = await prisma.migration_projects.findFirst({
      where: { id: migrationId }
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    const config = migration.config as any;
    const sourceOrgId = config.sourceOrgId;
    const targetOrgId = config.targetOrgId;

    // Get orgs without auth check
    const [sourceOrg, targetOrg] = await Promise.all([
      prisma.organisations.findUnique({ where: { id: sourceOrgId } }),
      prisma.organisations.findUnique({ where: { id: targetOrgId } })
    ]);

    if (!sourceOrg || !targetOrg) {
      return NextResponse.json(
        { error: 'Source or target org not found' },
        { status: 404 }
      );
    }

    const sourceOrgData: SalesforceOrg = {
      id: sourceOrg.id,
      name: sourceOrg.name,
      instanceUrl: sourceOrg.instance_url,
      accessToken: await sessionManager.getAccessToken(sourceOrg.id),
      refreshToken: sourceOrg.refresh_token_encrypted!,
      organizationId: sourceOrg.salesforce_org_id!,
      organizationName: sourceOrg.name
    };

    const targetOrgData: SalesforceOrg = {
      id: targetOrg.id,
      name: targetOrg.name,
      instanceUrl: targetOrg.instance_url,
      accessToken: await sessionManager.getAccessToken(targetOrg.id),
      refreshToken: targetOrg.refresh_token_encrypted!,
      organizationId: targetOrg.salesforce_org_id!,
      organizationName: targetOrg.name
    };

    // Get template
    console.log('Template ID from config:', config.templateId);
    const template = templateRegistry.getTemplate(config.templateId);
    if (!template) {
      console.error('Available templates:', templateRegistry.getAllTemplates().map(t => t.id));
      return NextResponse.json(
        { error: `Template not found: ${config.templateId}` },
        { status: 404 }
      );
    }

    // Get selected records
    const selectedRecordIds = config.selectedRecords || [];
    console.log('Selected records:', selectedRecordIds.length);

    // Initialize execution engine
    const engine = new ExecutionEngine(sourceOrgData, targetOrgData);
    
    // Detect external ID configuration
    const detectedConfig = await ExternalIdUtils.detectAndValidateExternalIds(
      template,
      sourceOrgData,
      targetOrgData
    );
    
    console.log('Source external ID info:', detectedConfig.sourceEnvironment);
    console.log('Target external ID info:', detectedConfig.targetEnvironment);

    // Execute template
    const executionContext = {
      sourceOrg: sourceOrgData,
      targetOrg: targetOrgData,
      selectedRecordIds,
      externalIdField: detectedConfig.targetEnvironment.externalIdField,
      externalIdConfig: {
        strategy: 'auto-detect' as const,
        sourceField: detectedConfig.sourceEnvironment.externalIdField,
        targetField: detectedConfig.targetEnvironment.externalIdField,
        crossEnvironment: detectedConfig.crossEnvironmentDetected ? {
          sourcePackageType: detectedConfig.sourceEnvironment.packageType,
          targetPackageType: detectedConfig.targetEnvironment.packageType
        } : undefined
      },
      config: DEFAULT_EXECUTION_CONFIG
    };

    console.log('Using external ID configuration:', executionContext.externalIdConfig);
    
    const result = await engine.execute(template, executionContext);

    // Update migration status
    await prisma.migration_projects.update({
      where: { id: migrationId },
      data: {
        status: result.status === 'success' ? 'completed' : 'failed',
        last_run_at: new Date(),
        execution_results: result as any,
        updated_at: new Date()
      }
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Migration execution error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute migration', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}