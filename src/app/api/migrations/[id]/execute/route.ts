import { NextRequest, NextResponse } from 'next/server';
import { ExecutionEngine, DEFAULT_EXECUTION_CONFIG, ExecutionContext } from '@/lib/migration/templates/core/execution-engine';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { prisma } from '@/lib/database/prisma';
import type { SalesforceOrg } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const migrationId = params.id;
    const body = await request.json();
    
    const {
      templateId,
      selectedRecords,
      externalIdField = 'External_Id__c',
      config = DEFAULT_EXECUTION_CONFIG
    } = body;

    // Validate required fields
    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    if (!selectedRecords || Object.keys(selectedRecords).length === 0) {
      return NextResponse.json(
        { error: 'Selected records are required' },
        { status: 400 }
      );
    }

    // Get migration project
    const migration = await prisma.migration_projects.findUnique({
      where: { id: migrationId },
      include: {
        organisations_migration_projects_source_org_idToorganisations: true,
        organisations_migration_projects_target_org_idToorganisations: true
      }
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    const sourceOrg = migration.organisations_migration_projects_source_org_idToorganisations;
    const targetOrg = migration.organisations_migration_projects_target_org_idToorganisations;

    if (!sourceOrg || !targetOrg) {
      return NextResponse.json(
        { error: 'Migration must have both source and target organisations configured' },
        { status: 400 }
      );
    }

    // Get template from registry
    const template = templateRegistry.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Create execution context
    const executionContext: ExecutionContext = {
      sourceOrg: {
        id: sourceOrg.id,
        name: sourceOrg.name,
        instanceUrl: sourceOrg.instance_url,
        accessToken: '', // Will be decrypted from access_token_encrypted
        refreshToken: '', // Will be decrypted from refresh_token_encrypted
        organizationId: sourceOrg.salesforce_org_id || '',
        organizationName: sourceOrg.name
      } as SalesforceOrg,
      targetOrg: {
        id: targetOrg.id,
        name: targetOrg.name,
        instanceUrl: targetOrg.instance_url,
        accessToken: '', // Will be decrypted from access_token_encrypted
        refreshToken: '', // Will be decrypted from refresh_token_encrypted
        organizationId: targetOrg.salesforce_org_id || '',
        organizationName: targetOrg.name
      } as SalesforceOrg,
      template,
      selectedRecords,
      externalIdField,
      config
    };

    // Create execution engine
    const executionEngine = new ExecutionEngine();

    // Set up progress tracking
    const progressUpdates: any[] = [];
    executionEngine.onProgress((progress) => {
      progressUpdates.push({
        timestamp: new Date(),
        ...progress
      });
    });

    // Execute the template
    const result = await executionEngine.executeTemplate(executionContext);

    // Create migration session record
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = await prisma.migration_sessions.create({
      data: {
        id: sessionId,
        project_id: migrationId,
        object_type: templateId,
        status: result.status === 'success' ? 'COMPLETED' : 
                result.status === 'partial' ? 'COMPLETED' : 'FAILED',
        total_records: result.totalRecords,
        processed_records: result.successfulRecords + result.failedRecords,
        successful_records: result.successfulRecords,
        failed_records: result.failedRecords,
        error_log: result.stepResults.flatMap(step => 
          step.errors?.map((error: any) => ({
            stepName: step.stepName,
            recordId: error.recordId,
            error: error.error,
            retryable: error.retryable
          })) || []
        ),
        started_at: new Date(Date.now() - result.executionTimeMs),
        completed_at: new Date()
      }
    });

    // Store record mappings for successful records
    const recordMappings = Object.entries(result.lookupMappings).map(([sourceId, targetId], index) => ({
      id: `record_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: session.id,
      source_record_id: sourceId,
      target_record_id: targetId,
      object_type: templateId,
      status: 'SUCCESS' as const,
      record_data: {}
    }));

    if (recordMappings.length > 0) {
      await prisma.migration_records.createMany({
        data: recordMappings
      });
    }

    // Update migration project status
    await prisma.migration_projects.update({
      where: { id: migrationId },
      data: {
        status: result.status === 'success' ? 'COMPLETED' : 
                result.status === 'partial' ? 'COMPLETED' : 'FAILED',
        updated_at: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      result: {
        status: result.status,
        totalRecords: result.totalRecords,
        successfulRecords: result.successfulRecords,
        failedRecords: result.failedRecords,
        executionTimeMs: result.executionTimeMs,
        stepResults: result.stepResults.map(step => ({
          stepName: step.stepName,
          status: step.status,
          totalRecords: step.totalRecords,
          successfulRecords: step.successfulRecords,
          failedRecords: step.failedRecords,
          executionTimeMs: step.executionTimeMs,
          errorCount: step.errors?.length || 0
        })),
        lookupMappings: result.lookupMappings
      },
      progressUpdates
    });

  } catch (error) {
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const migrationId = params.id;

    // Get latest migration session for this project
    const session = await prisma.migration_sessions.findFirst({
      where: { project_id: migrationId },
      orderBy: { created_at: 'desc' },
      include: {
        migration_records: true
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'No execution session found for this migration' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        totalRecords: session.total_records,
        processedRecords: session.processed_records,
        successfulRecords: session.successful_records,
        failedRecords: session.failed_records,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        executionTimeMs: session.completed_at && session.started_at 
          ? session.completed_at.getTime() - session.started_at.getTime()
          : null,
        errorLog: session.error_log,
        recordCount: session.migration_records.length
      }
    });

  } catch (error) {
    console.error('Get execution status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get execution status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 