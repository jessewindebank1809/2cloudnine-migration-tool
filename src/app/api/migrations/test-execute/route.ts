import { NextRequest, NextResponse } from 'next/server';
import { ExecutionEngine, DEFAULT_EXECUTION_CONFIG, ExecutionContext } from '@/lib/migration/templates/core/execution-engine';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { registerAllTemplates } from '@/lib/migration/templates/registry';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import { prisma } from '@/lib/database/prisma';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { TokenManager } from '@/lib/salesforce/token-manager';
import type { SalesforceOrg } from '@/types';
import type { Prisma } from '@prisma/client';
import { validateSelectedRecords } from '@/lib/migration/utils/record-validation';

export async function POST(request: NextRequest) {
  try {
    // Ensure templates are registered
    registerAllTemplates();
    
    const body = await request.json();
    const { migrationId, sourceOrgId, targetOrgId, templateId, selectedRecords } = body;

    let config: {
      sourceOrgId: string;
      targetOrgId: string;
      templateId: string;
      selectedRecords: Record<string, string[]>;
    };
    let testMigrationId: string;

    if (migrationId) {
      // Use existing migration
      const migration = await prisma.migration_projects.findFirst({
        where: { id: migrationId }
      });

      if (!migration) {
        return NextResponse.json(
          { error: 'Migration not found' },
          { status: 404 }
        );
      }

      config = migration.config as Prisma.JsonValue as {
        sourceOrgId: string;
        targetOrgId: string;
        templateId: string;
        selectedRecords: Record<string, string[]>;
      };
      testMigrationId = migrationId;
    } else if (sourceOrgId && targetOrgId && templateId && selectedRecords) {
      // Create temporary test configuration
      config = {
        sourceOrgId,
        targetOrgId,
        templateId,
        selectedRecords: Array.isArray(selectedRecords) 
          ? { 'tc9_et__Interpretation_Rule__c': selectedRecords }
          : selectedRecords
      };
      testMigrationId = `test-${Date.now()}`;
      
      console.log('Test execution with config:', config);
    } else {
      return NextResponse.json(
        { error: 'Either migrationId or complete configuration (sourceOrgId, targetOrgId, templateId, selectedRecords) is required' },
        { status: 400 }
      );
    }

    // Get orgs without auth check
    const [sourceOrg, targetOrg] = await Promise.all([
      prisma.organisations.findUnique({ where: { id: config.sourceOrgId } }),
      prisma.organisations.findUnique({ where: { id: config.targetOrgId } })
    ]);

    if (!sourceOrg || !targetOrg) {
      return NextResponse.json(
        { error: 'Source or target org not found' },
        { status: 404 }
      );
    }

    // Get valid tokens using TokenManager
    const tokenManager = TokenManager.getInstance();
    const sourceTokens = await tokenManager.getValidToken(sourceOrg.id);
    const targetTokens = await tokenManager.getValidToken(targetOrg.id);

    if (!sourceTokens || !targetTokens) {
      return NextResponse.json(
        { error: 'Failed to get valid tokens for source or target org' },
        { status: 401 }
      );
    }

    const sourceOrgData: SalesforceOrg = {
      id: sourceOrg.id,
      instanceUrl: sourceOrg.instance_url,
      accessToken: sourceTokens.accessToken,
      refreshToken: sourceOrg.refresh_token_encrypted!,
      organisationId: sourceOrg.salesforce_org_id!,
      organisationName: sourceOrg.name
    };

    const targetOrgData: SalesforceOrg = {
      id: targetOrg.id,
      instanceUrl: targetOrg.instance_url,
      accessToken: targetTokens.accessToken,
      refreshToken: targetOrg.refresh_token_encrypted!,
      organisationId: targetOrg.salesforce_org_id!,
      organisationName: targetOrg.name
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

    // Get selected records - handle both array and object formats
    let selectedRecordIds: string[] = [];
    if (Array.isArray(config.selectedRecords)) {
      selectedRecordIds = config.selectedRecords;
    } else if (config.selectedRecords && typeof config.selectedRecords === 'object') {
      // Extract all record IDs from the object
      selectedRecordIds = Object.values(config.selectedRecords).flat();
    }
    console.log('Selected records:', selectedRecordIds.length);

    // Validate selected records exist and are of correct type
    const recordValidation = await validateSelectedRecords(
      config.sourceOrgId,
      selectedRecordIds,
      template.etlSteps[0]?.extractConfig?.objectApiName || 'tc9_et__Interpretation_Rule__c'
    );

    if (!recordValidation.valid) {
      return NextResponse.json({
        status: 'failed',
        errors: recordValidation.errors,
        summary: {
          total: selectedRecordIds.length,
          success: 0,
          failed: recordValidation.invalidRecords.length,
          errors: recordValidation.errors
        }
      });
    }

    // Initialize execution engine
    const engine = new ExecutionEngine();
    
    // Get the primary object type from template
    const primaryObjectType = template.etlSteps[0]?.extractConfig?.objectApiName || 'tc9_et__Interpretation_Rule__c';
    
    // Detect external ID configuration
    const sourceClient = await sessionManager.getClient(sourceOrg.id);
    const targetClient = await sessionManager.getClient(targetOrg.id);
    
    const sourceExternalIdInfo = await ExternalIdUtils.detectEnvironmentExternalIdInfo(primaryObjectType, sourceClient);
    const targetExternalIdInfo = await ExternalIdUtils.detectEnvironmentExternalIdInfo(primaryObjectType, targetClient);
    
    console.log('Source external ID info:', sourceExternalIdInfo);
    console.log('Target external ID info:', targetExternalIdInfo);
    
    // Create cross-environment configuration
    const externalIdConfig = await ExternalIdUtils.detectCrossEnvironmentMapping(sourceExternalIdInfo, targetExternalIdInfo);

    // Execute template
    const executionContext: ExecutionContext = {
      template,
      sourceOrg: sourceOrgData,
      targetOrg: targetOrgData,
      selectedRecords: { [primaryObjectType]: selectedRecordIds },
      externalIdField: externalIdConfig.targetField,
      externalIdConfig: externalIdConfig,
      config: DEFAULT_EXECUTION_CONFIG
    };

    console.log('Using external ID configuration:', executionContext.externalIdConfig);
    
    const result = await engine.executeTemplate(executionContext);

    // Update migration status only if it's not a test migration
    if (migrationId && !testMigrationId.startsWith('test-')) {
      await prisma.migration_projects.update({
        where: { id: migrationId },
        data: {
          status: result.status === 'success' ? 'COMPLETED' : 'FAILED',
          updated_at: new Date()
        }
      });
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Migration execution error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute migration', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}