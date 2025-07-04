import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from "@sentry/nextjs";
import { ExecutionEngine, DEFAULT_EXECUTION_CONFIG, ExecutionContext, StepExecutionResult } from '@/lib/migration/templates/core/execution-engine';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { registerAllTemplates } from '@/lib/migration/templates/registry'; // Ensure templates are registered
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import { prisma } from '@/lib/database/prisma';
import { sessionManager } from '@/lib/salesforce/session-manager';
import type { SalesforceOrg } from '@/types';
import { requireAuth } from '@/lib/auth/session-helper';
import type { ExecutionProgress, MigrationTemplate } from '@/lib/migration/templates/core/interfaces';
import type { Prisma } from '@prisma/client';
import { SalesforceClient } from '@/lib/salesforce/client';
import { usageTracker } from '@/lib/usage-tracker';
import type { 
  StepExecutionError, 
  TechnicalErrorDetails, 
  UniqueErrorSummary 
} from '@/types/migration-execution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params as required by Next.js 15
  const { id: migrationId } = await params;
  
  // Set Sentry context for this migration
  Sentry.setTag("migration.id", migrationId);
  Sentry.setTag("operation", "migration.execute");
  
  return Sentry.startSpan(
    { 
      name: "Migration Execution", 
      op: "migration.execute",
      attributes: { migrationId }
    },
    async () => {
      try {
        // Require authentication and get current user
        const authSession = await requireAuth(request);
        
        // Ensure templates are registered
        registerAllTemplates();
        
        const body = await request.json();

        const {
          externalIdField: providedExternalIdField,
          config = DEFAULT_EXECUTION_CONFIG
        } = body;

        // Get migration project and ensure it belongs to current user
        const migration = await prisma.migration_projects.findFirst({
          where: { 
            id: migrationId,
            user_id: authSession.user.id // Ensure project belongs to current user
          },
          include: {
            organisations_migration_projects_source_org_idToorganisations: true,
            organisations_migration_projects_target_org_idToorganisations: true
          }
        });

        if (!migration) {
          Sentry.setContext("migration", { id: migrationId, found: false });
          return NextResponse.json(
            { error: 'Migration not found' },
            { status: 404 }
          );
        }

        // Extract templateId and selectedRecords from project config
        const projectConfig = migration.config as Prisma.JsonValue as { templateId: string; selectedRecords: string[] };
        const templateId = projectConfig.templateId;
        const selectedRecords = projectConfig.selectedRecords || [];

        // Set additional Sentry context
        Sentry.setContext("migration", {
          id: migrationId,
          templateId,
          recordCount: selectedRecords.length,
          sourceOrgId: migration.source_org_id,
          targetOrgId: migration.target_org_id
        });

        // Debug logging
        console.log('Template ID from config:', templateId);
        console.log('Selected records:', selectedRecords.length);

        // Validate required fields
        if (!templateId) {
          Sentry.captureMessage("Template ID not found in project configuration", "error");
          return NextResponse.json(
            { error: 'Template ID not found in project configuration' },
            { status: 400 }
          );
        }

        if (!selectedRecords || selectedRecords.length === 0) {
          Sentry.captureMessage("No records selected for migration", "error");
          return NextResponse.json(
            { error: 'No records selected for migration' },
            { status: 400 }
          );
        }

        const sourceOrg = migration.organisations_migration_projects_source_org_idToorganisations;
        const targetOrg = migration.organisations_migration_projects_target_org_idToorganisations;

        if (!sourceOrg || !targetOrg) {
          Sentry.captureMessage("Migration missing source or target organisation", "error");
          return NextResponse.json(
            { error: 'Migration must have both source and target organisations configured' },
            { status: 400 }
          );
        }

        // Set org context for Sentry
        Sentry.setTag("org.source", sourceOrg.name);
        Sentry.setTag("org.target", targetOrg.name);

        // Get template from registry
        const template = templateRegistry.getTemplate(templateId);
        if (!template) {
          console.error(`Template not found: ${templateId}`);
          console.error('Available template IDs:', templateRegistry.getTemplateIds());
          console.error('Template registry has template:', templateRegistry.hasTemplate(templateId));
          
          Sentry.captureMessage(`Template not found: ${templateId}`, "error");
          return NextResponse.json(
            { 
              error: 'Template not found',
              templateId,
              availableTemplates: templateRegistry.getTemplateIds()
            },
            { status: 404 }
          );
        }

        // Create session ID early for tracking
        const sessionId = crypto.randomUUID();
        
        // Create migration session record immediately to satisfy foreign key constraints
        await prisma.migration_sessions.create({
          data: {
            id: sessionId,
            project_id: migrationId,
            object_type: templateId,
            status: 'PENDING',
            total_records: selectedRecords.length,
            processed_records: 0,
            successful_records: 0,
            failed_records: 0,
            error_log: []
          }
        });
        
        // Track migration start with full context
        await usageTracker.trackMigrationStart(
          migrationId,
          sessionId,
          authSession.user.id,
          { source: sourceOrg.id, target: targetOrg.id }
        );

        // Get authenticated clients from session manager
        let sourceClient, targetClient;
        try {
          sourceClient = await sessionManager.getClient(sourceOrg.id);
          targetClient = await sessionManager.getClient(targetOrg.id);
        } catch (error: unknown) {
          console.error('Failed to get authenticated clients:', error);
          
          // Update session status back to FAILED since authentication failed
          await prisma.migration_sessions.update({
            where: { id: sessionId },
            data: {
              status: 'FAILED',
              error_log: [{
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error),
                type: 'authentication_failure'
              }]
            }
          });
          
          // Enhanced error context for Sentry
          Sentry.setContext("authentication", {
            sourceOrgId: sourceOrg.id,
            targetOrgId: targetOrg.id,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Check if it's a token-related error
          if (error instanceof Error && (
            error.message.includes('not connected') ||
            error.message.includes('not found')
          )) {
            // Track authentication failure with detailed context
            await usageTracker.trackMigrationFailure(
              migrationId,
              sessionId,
              authSession.user.id,
              error.message,
              {
                templateId,
                sourceOrgId: sourceOrg.id,
                targetOrgId: targetOrg.id,
                selectedRecords,
                failedAtStep: 'authentication',
                errorCode: 'RECONNECT_REQUIRED',
              }
            );
            
            Sentry.captureException(error);
            return NextResponse.json(
              { 
                error: 'One or more organisations need to be reconnected. Please reconnect your Salesforce organisations.',
                code: 'RECONNECT_REQUIRED',
                reconnectUrl: `/orgs?reconnect=${sourceOrg?.id || targetOrg?.id}&returnUrl=/migrations/${migrationId}/execute`
              },
              { status: 401 }
            );
          }
          
          throw error;
        }

        // Convert selectedRecords array to the expected format for ExecutionContext
        // The execution engine expects selectedRecords as Record<objectType, recordIds[]>
        const primaryObjectType = template.etlSteps[0]?.extractConfig?.objectApiName || 'tc9_et__Interpretation_Rule__c';
        const formattedSelectedRecords: Record<string, string[]> = {
          [primaryObjectType]: selectedRecords
        };

        // Detect external ID fields for both source and target environments
        let externalIdField = providedExternalIdField;
        let externalIdConfig;
        
        try {
          // Detect external ID information for both environments
          const sourceExternalIdInfo = await ExternalIdUtils.detectEnvironmentExternalIdInfo(primaryObjectType, sourceClient);
          const targetExternalIdInfo = await ExternalIdUtils.detectEnvironmentExternalIdInfo(primaryObjectType, targetClient);
          
          console.log('Source external ID info:', sourceExternalIdInfo);
          console.log('Target external ID info:', targetExternalIdInfo);
          
          // Create cross-environment configuration
          externalIdConfig = await ExternalIdUtils.detectCrossEnvironmentMapping(sourceExternalIdInfo, targetExternalIdInfo);
          
          // Validate compatibility and log any issues
          const validationResult = ExternalIdUtils.validateCrossEnvironmentCompatibility(sourceExternalIdInfo, targetExternalIdInfo);
          
          if (validationResult.potentialIssues.length > 0) {
            console.warn('External ID compatibility issues detected:');
            validationResult.potentialIssues.forEach(issue => {
              console.warn(`${issue.severity.toUpperCase()}: ${issue.message}`);
              if (issue.suggestedAction) {
                console.warn(`Suggested action: ${issue.suggestedAction}`);
              }
            });
          }
          
          if (validationResult.recommendations.length > 0) {
            console.log('External ID recommendations:');
            validationResult.recommendations.forEach(rec => console.log(`- ${rec}`));
          }
          
          // Use the source field for backward compatibility
          externalIdField = externalIdField || externalIdConfig.sourceField;
          
          console.log(`Using external ID configuration:`, {
            strategy: externalIdConfig.strategy,
            sourceField: externalIdConfig.sourceField,
            targetField: externalIdConfig.targetField,
            crossEnvironment: externalIdConfig.crossEnvironmentMapping
          });
          
        } catch (error: unknown) {
          console.warn(`Failed to detect cross-environment external ID configuration:`, error);
          
          // Fallback to legacy detection
          if (!externalIdField) {
            try {
              externalIdField = await ExternalIdUtils.detectExternalIdField(primaryObjectType, sourceClient);
              console.log(`Auto-detected external ID field: ${externalIdField} for object ${primaryObjectType}`);
            } catch (legacyError) {
              console.warn(`Failed to auto-detect external ID field, using managed default:`, legacyError);
              externalIdField = ExternalIdUtils.createDefaultConfig().sourceField;
            }
          }
          
          // Create default configuration
          externalIdConfig = ExternalIdUtils.createDefaultConfig();
          externalIdConfig.sourceField = externalIdField;
          externalIdConfig.targetField = externalIdField;
        }

        // Update session status to RUNNING now that authentication is successful
        await prisma.migration_sessions.update({
          where: { id: sessionId },
          data: {
            status: 'RUNNING',
            started_at: new Date()
          }
        });

        // Create execution context with properly authenticated org data
        const executionContext: ExecutionContext = {
          sourceOrg: {
            id: sourceOrg.id,
            name: sourceOrg.name,
            instanceUrl: sourceOrg.instance_url,
            accessToken: sourceClient.accessToken || '',
            refreshToken: sourceClient.refreshToken || '',
            organisationId: sourceOrg.salesforce_org_id || '',
            organisationName: sourceOrg.name
          } as SalesforceOrg,
          targetOrg: {
            id: targetOrg.id,
            name: targetOrg.name,
            instanceUrl: targetOrg.instance_url,
            accessToken: targetClient.accessToken || '',
            refreshToken: targetClient.refreshToken || '',
            organisationId: targetOrg.salesforce_org_id || '',
            organisationName: targetOrg.name
          } as SalesforceOrg,
          template,
          selectedRecords: formattedSelectedRecords,
          externalIdField, // Keep for backward compatibility
          externalIdConfig, // New cross-environment configuration
          config
        };

        // Create execution engine
        const executionEngine = new ExecutionEngine();

        // Set up progress tracking
        const progressUpdates: ExecutionProgress[] = [];
        executionEngine.onProgress((progress) => {
          progressUpdates.push(progress);
        });

        // Execute the template
        console.log('Starting template execution...');
        let result;
        try {
          result = await executionEngine.executeTemplate(executionContext);
        } catch (executionError: unknown) {
          console.error('Template execution failed:', executionError);
          
          // Update session status to FAILED since execution failed
          await prisma.migration_sessions.update({
            where: { id: sessionId },
            data: {
              status: 'FAILED',
              completed_at: new Date(),
              error_log: [{
                timestamp: new Date().toISOString(),
                error: executionError instanceof Error ? executionError.message : String(executionError),
                type: 'execution_failure'
              }]
            }
          });
          
          throw executionError;
        }
        
        // Log execution summary first
        console.log('Template execution completed with summary:', {
          status: result.status,
          totalRecords: result.totalRecords,
          successfulRecords: result.successfulRecords,
          failedRecords: result.failedRecords,
          executionTimeMs: result.executionTimeMs,
          stepCount: result.stepResults.length,
          lookupMappingsCount: Object.keys(result.lookupMappings).length
        });
        
        // Track detailed execution results
        if (result.status === 'failed' || result.failedRecords > 0) {
          // Collect all error details for comprehensive tracking
          const allErrors: TechnicalErrorDetails[] = [];
          
          result.stepResults.forEach(step => {
            if (step.errors && step.errors.length > 0) {
              step.errors.forEach((error: StepExecutionError) => {
                // Extract technical error details
                const errorDetails: TechnicalErrorDetails = {
                  stepName: step.stepName,
                  recordId: error.recordId,
                  error: error.error,
                  retryable: error.retryable
                };
                
                // Parse Salesforce error codes and details
                if (error.error.includes('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST')) {
                  errorDetails.errorCode = 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST';
                  const fieldMatch = error.error.match(/\[([^\]]+)\]/);
                  if (fieldMatch) {
                    errorDetails.field = fieldMatch[1];
                  }
                  const valueMatch = error.error.match(/Picklist value: ([^:]+):/);
                  if (valueMatch) {
                    errorDetails.invalidValue = valueMatch[1].trim();
                  }
                } else if (error.error.includes('REQUIRED_FIELD_MISSING')) {
                  errorDetails.errorCode = 'REQUIRED_FIELD_MISSING';
                  const fieldsMatch = error.error.match(/Required fields are missing: \[([^\]]+)\]/);
                  if (fieldsMatch) {
                    errorDetails.missingFields = fieldsMatch[1].split(',').map((f: string) => f.trim());
                  }
                } else if (error.error.includes('DUPLICATE_VALUE')) {
                  errorDetails.errorCode = 'DUPLICATE_VALUE';
                } else if (error.error.includes('FIELD_CUSTOM_VALIDATION_EXCEPTION')) {
                  errorDetails.errorCode = 'FIELD_CUSTOM_VALIDATION_EXCEPTION';
                  errorDetails.validationRule = error.error.split(':')[1]?.trim();
                } else if (error.error.includes('INSUFFICIENT_ACCESS')) {
                  errorDetails.errorCode = 'INSUFFICIENT_ACCESS';
                } else if (error.error.includes('INVALID_SESSION_ID')) {
                  errorDetails.errorCode = 'INVALID_SESSION_ID';
                } else if (error.error.includes('Breakpoint:')) {
                  errorDetails.errorCode = 'BREAKPOINT_ERROR';
                  const breakpointMatch = error.error.match(/Breakpoint: ([^:]+):/);
                  if (breakpointMatch) {
                    errorDetails.breakpointName = breakpointMatch[1];
                  }
                }
                
                allErrors.push(errorDetails);
              });
            }
          });
          
          // Track migration failure with comprehensive error details
          await usageTracker.trackMigrationFailure(
            migrationId,
            sessionId,
            authSession.user.id,
            result.failedRecords > 0 ? `Migration failed with ${result.failedRecords} errors` : 'Migration execution failed',
            {
              templateId,
              sourceOrgId: sourceOrg.id,
              targetOrgId: targetOrg.id,
              selectedRecords,
              failedAtStep: 'execution',
              errorCode: result.status === 'failed' ? 'EXECUTION_FAILED' : 'PARTIAL_FAILURE',
              validationErrors: allErrors,
            }
          );
        } else {
          // Track successful migration
          await usageTracker.trackMigrationComplete(
            migrationId,
            sessionId,
            authSession.user.id,
            {
              success: true,
              recordsProcessed: result.totalRecords,
              duration: result.executionTimeMs
            }
          );
        }
        
        // Log each step result separately to avoid truncation
        result.stepResults.forEach((step, index) => {
          console.log(`Step ${index + 1} (${step.stepName}):`, {
            status: step.status,
            totalRecords: step.totalRecords,
            successfulRecords: step.successfulRecords,
            failedRecords: step.failedRecords,
            executionTimeMs: step.executionTimeMs,
            errorCount: step.errors?.length || 0
          });
          
          // Log errors separately if they exist
          if (step.errors && step.errors.length > 0) {
            console.log(`Step ${index + 1} errors (${step.errors.length} total):`);
            step.errors.forEach((error: StepExecutionError, errorIndex: number) => {
              console.log(`  Error ${errorIndex + 1}:`, {
                recordId: error.recordId,
                error: error.error,
                retryable: error.retryable
              });
            });
          }
        });
        
        // Log lookup mappings separately
        console.log('Lookup mappings:', Object.keys(result.lookupMappings).length, 'total mappings');
        if (Object.keys(result.lookupMappings).length > 0) {
          console.log('Sample lookup mappings (first 10):');
          Object.entries(result.lookupMappings).slice(0, 10).forEach(([source, target]) => {
            console.log(`  ${source} -> ${target}`);
          });
        }

        // Fetch parent record names for session metadata
        const recordNames = new Map<string, string>();
        if (selectedRecords.length > 0 && sourceClient && template) {
          try {
            const primaryObjectType = template.etlSteps[0]?.extractConfig?.objectApiName;
            if (primaryObjectType && selectedRecords.length > 0) {
              const nameQuery = `SELECT Id, Name FROM ${primaryObjectType} WHERE Id IN ('${selectedRecords.join("','")}')`;
              const nameResult = await sourceClient.query(nameQuery);
              if (nameResult.success && nameResult.data) {
                nameResult.data.forEach((record: { Id: string; Name?: string }) => {
                  if (record.Id && record.Name) {
                    recordNames.set(record.Id, record.Name);
                  }
                });
              }
            }
          } catch (error: unknown) {
            console.warn('Failed to fetch record names for session:', error);
          }
        }

        // Wrap all final result operations in a transaction
        const session = await prisma.$transaction(async (tx) => {
          // Update migration session record with final results
          const updatedSession = await tx.migration_sessions.update({
            where: { id: sessionId },
            data: {
              status: result.status === 'success' ? 'COMPLETED' : 'FAILED',
              total_records: result.totalRecords,
              processed_records: result.successfulRecords + result.failedRecords,
              successful_records: result.successfulRecords,
              failed_records: result.failedRecords,
              error_log: [
                // Store parent record names as metadata
                {
                  type: 'metadata',
                  parentRecordNames: Object.fromEntries(recordNames),
                  successfulParentRecords: Object.entries(result.lookupMappings)
                    .filter(([sourceId]) => recordNames.has(sourceId))
                    .map(([sourceId, targetId]) => ({
                      sourceId,
                      targetId,
                      name: recordNames.get(sourceId)
                    })),
                  parentRecordStats: {
                    attempted: selectedRecords.length,
                    successful: Object.entries(result.lookupMappings)
                      .filter(([sourceId]) => recordNames.has(sourceId)).length
                  }
                },
                // Include step errors
                ...result.stepResults.flatMap(step => 
                  step.errors?.map((error: StepExecutionError) => ({
                    stepName: step.stepName,
                    recordId: error.recordId,
                    error: error.error,
                    retryable: error.retryable
                  })) || []
                )
              ],
              started_at: new Date(Date.now() - result.executionTimeMs),
              completed_at: new Date()
            }
          });

          // Store record mappings for successful records
          const recordMappings = Object.entries(result.lookupMappings).map(([sourceId, targetId], index) => ({
            id: `record_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            session_id: updatedSession.id,
            source_record_id: sourceId,
            target_record_id: targetId,
            object_type: templateId,
            status: 'SUCCESS' as const,
            record_data: {}
          }));

          if (recordMappings.length > 0) {
            await tx.migration_records.createMany({
              data: recordMappings
            });
          }

          // Update migration project status
          await tx.migration_projects.update({
            where: { id: migrationId },
            data: {
              status: result.status === 'success' ? 'COMPLETED' : 'FAILED',
              updated_at: new Date()
            }
          });

          return updatedSession;
        });

        // Helper function to get detailed record results grouped by parent records
        const getDetailedRecordResults = async (
          stepResults: StepExecutionResult[], 
          lookupMappings: Record<string, string>, 
          selectedRecords: string[], 
          targetOrg: SalesforceOrg, 
          sourceClient: SalesforceClient, 
          template: MigrationTemplate
        ) => {
          console.log('getDetailedRecordResults called with targetOrg:', {
            id: targetOrg.id,
            organisationName: targetOrg.organisationName,
            instanceUrl: targetOrg.instanceUrl,
            keys: Object.keys(targetOrg)
          });
          
          // Fetch record names from source org based on the template's primary object
          const recordNames = new Map<string, string>();
          if (selectedRecords.length > 0 && sourceClient && template) {
            try {
              const primaryObjectType = template.etlSteps[0]?.extractConfig?.objectApiName;
              if (primaryObjectType && selectedRecords.length > 0) {
                const nameQuery = `SELECT Id, Name FROM ${primaryObjectType} WHERE Id IN ('${selectedRecords.join("','")}')`;
                const nameResult = await sourceClient.query(nameQuery);
                if (nameResult.success && nameResult.data) {
                  nameResult.data.forEach((record: { Id: string; Name?: string }) => {
                    if (record.Id && record.Name) {
                      recordNames.set(record.Id, record.Name);
                    }
                  });
                }
              }
            } catch (error) {
              console.warn('Failed to fetch record names:', error);
            }
          }
          
          const recordResults = new Map<string, {
            sourceId: string;
            sourceName: string;
            recordName?: string;
            targetId?: string;
            targetUrl?: string;
            status: 'success' | 'failed';
            successfulChildRecords: number;
            failedChildRecords: number;
            totalChildRecords: number;
            errors: Array<{
              recordId: string;
              error: string;
              retryable: boolean;
              sourceRecordId?: string;
            }>;
            childRecordDetails: {
              stepName: string;
              successCount: number;
              failCount: number;
              errors: Array<{
                recordId: string;
                error: string;
                retryable: boolean;
                sourceRecordId?: string;
              }>;
            }[];
          }>();

          // Initialize results for each selected record
          selectedRecords.forEach(recordId => {
            const recordName = recordNames.get(recordId) || recordId;
            recordResults.set(recordId, {
              sourceId: recordId,
              sourceName: recordName,
              recordName: recordName,
              status: 'success',
              successfulChildRecords: 0,
              failedChildRecords: 0,
              totalChildRecords: 0,
              errors: [],
              childRecordDetails: []
            });
          });

          // Get the number of successful parent records
          const parentStep = stepResults.find(step => step.stepName === 'interpretationRuleMaster');
          const successfulParentCount = parentStep ? parentStep.successfulRecords : 0;
          // Only use selected records that were actually successful in the migration
          const successfulParentIds = selectedRecords.filter(recordId => lookupMappings[recordId]);

          // Get actual child record counts from target org for all migrated records
          const actualChildCounts = new Map<string, Map<string, number>>(); // sourceParentId -> stepName -> count
          
          // Only query for child records if this template has child steps
          const hasChildSteps = stepResults.length > 1 && stepResults.some(step => step.stepName !== 'interpretationRuleMaster' && step.stepName !== 'payCodeMaster' && step.stepName !== 'leaveRuleMaster');
          
          if (successfulParentIds.length > 0 && targetClient && sourceClient && hasChildSteps) {
            try {
              // Get target IDs for selected parents from lookup mappings
              const selectedTargetIds = successfulParentIds.map(sourceId => lookupMappings[sourceId]).filter(Boolean);
              const selectedTargetIdsStr = selectedTargetIds.map(id => `'${id}'`).join(',');
              const selectedSourceIdsStr = successfulParentIds.map(id => `'${id}'`).join(',');
              
              console.log('🔍 DEBUGGING: Querying child records in both SOURCE and TARGET orgs for selected parents:');
              console.log('Source IDs:', successfulParentIds);
              console.log('Target IDs:', selectedTargetIds);
              
              // Query each child object type separately in SOURCE org first for comparison
              const sourceChildCounts = new Map<string, Map<string, number>>(); // sourceParentId -> stepName -> count
              
              // Define child object queries based on template type
              let childObjectQueries: Array<{stepName: string, objectType: string, parentField: string, whereClause: string}> = [];
              
              // Only define queries for templates that have child records
              if (templateId === 'payroll-interpretation-rules') {
                childObjectQueries = [
                  {
                    stepName: 'interpretationBreakpointLeaveHeader',
                    objectType: 'tc9_et__Interpretation_Breakpoint__c',
                    parentField: 'tc9_et__Interpretation_Rule__c',
                    whereClause: `RecordType.Name = 'Leave Breakpoint' AND tc9_et__Breakpoint_Type__c = 'Leave Header'`
                  },
                  {
                    stepName: 'interpretationBreakpointPayCodeCap',
                    objectType: 'tc9_et__Interpretation_Breakpoint__c',
                    parentField: 'tc9_et__Interpretation_Rule__c',
                    whereClause: `(RecordType.Name = 'Pay Code Cap' OR RecordType.Name = 'Leave Breakpoint') AND tc9_et__Breakpoint_Type__c != 'Leave Header'`
                  },
                  {
                    stepName: 'interpretationBreakpointOther',
                    objectType: 'tc9_et__Interpretation_Breakpoint__c',
                    parentField: 'tc9_et__Interpretation_Rule__c',
                    whereClause: `RecordType.Name != 'Pay Code Cap' AND RecordType.Name != 'Leave Breakpoint'`
                  }
                ];
              }
              // Pay Codes and Leave Rules don't have child records in the current templates
              
              if (childObjectQueries.length === 0) {
                console.log('🔍 DEBUGGING: No child queries needed for this template type');
              } else {

              // First, query SOURCE org for baseline comparison
              console.log('🔍 DEBUGGING: === QUERYING SOURCE ORG ===');
              for (const queryConfig of childObjectQueries) {
                const sourceQuery = `
                  SELECT ${queryConfig.parentField}, COUNT(Id) 
                  FROM ${queryConfig.objectType} 
                  WHERE ${queryConfig.parentField} IN (${selectedSourceIdsStr}) 
                  AND ${queryConfig.whereClause}
                  GROUP BY ${queryConfig.parentField}
                `;
                
                console.log(`🔍 DEBUGGING: SOURCE ${queryConfig.stepName}: ${sourceQuery}`);
                
                try {
                  const result = await sourceClient.query(sourceQuery);
                  
                  if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
                    result.data.forEach((record) => {
                      const sourceParentId = record[queryConfig.parentField];
                      const count = record.expr0 || 0;
                      
                      if (!sourceParentId || count === undefined) {
                        console.warn(`Unexpected record structure for SOURCE ${queryConfig.stepName}:`, record);
                        return;
                      }
                      
                      if (!sourceChildCounts.has(sourceParentId)) {
                        sourceChildCounts.set(sourceParentId, new Map());
                      }
                      sourceChildCounts.get(sourceParentId)!.set(queryConfig.stepName, count);
                      
                      console.log(`🔍 DEBUGGING: SOURCE - Found ${count} ${queryConfig.stepName} records for parent ${sourceParentId}`);
                    });
                  } else {
                    console.log(`🔍 DEBUGGING: SOURCE - No results for ${queryConfig.stepName} query`);
                  }
                } catch (error: unknown) {
                  console.error(`Error querying SOURCE ${queryConfig.stepName}:`, error);
                  if (error instanceof Error && (error.message?.includes('No such column') || error.message?.includes('Invalid field'))) {
                    console.error('SOURCE field name issue detected. Query:', sourceQuery);
                    console.error('SOURCE error details:', error.message);
                  }
                }
              }
              
              console.log('🔍 DEBUGGING: SOURCE child counts map:', Object.fromEntries(
                Array.from(sourceChildCounts.entries()).map(([sourceId, stepCounts]) => [
                  sourceId, 
                  Object.fromEntries(stepCounts.entries())
                ])
              ));

              // Now query TARGET org and compare
              console.log('🔍 DEBUGGING: === QUERYING TARGET ORG ===');
              for (const queryConfig of childObjectQueries) {
                const query = `
                  SELECT ${queryConfig.parentField}, COUNT(Id) 
                  FROM ${queryConfig.objectType} 
                  WHERE ${queryConfig.parentField} IN (${selectedTargetIdsStr}) 
                  AND ${queryConfig.whereClause}
                  GROUP BY ${queryConfig.parentField}
                `;
                
                console.log(`🔍 DEBUGGING: TARGET ${queryConfig.stepName}: ${query}`);
                
                try {
                  const result = await targetClient.query(query);
                  
                  if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
                    result.data.forEach((record) => {
                      const targetParentId = record[queryConfig.parentField];
                      const count = record.expr0 || 0;
                      
                      // Validate the record structure
                      if (!targetParentId || count === undefined) {
                        console.warn(`Unexpected record structure for ${queryConfig.stepName}:`, record);
                        return;
                      }
                      
                      // Find the source parent ID that maps to this target parent ID
                      const sourceParentId = Object.keys(lookupMappings).find(sourceId => 
                        lookupMappings[sourceId] === targetParentId
                      );
                      
                      if (sourceParentId) {
                        if (!actualChildCounts.has(sourceParentId)) {
                          actualChildCounts.set(sourceParentId, new Map());
                        }
                        actualChildCounts.get(sourceParentId)!.set(queryConfig.stepName, count);
                        
                        console.log(`🔍 DEBUGGING: TARGET - Found ${count} ${queryConfig.stepName} records for source parent ${sourceParentId} (target: ${targetParentId})`);
                      }
                    });
                  } else {
                    console.log(`🔍 DEBUGGING: TARGET - No results for ${queryConfig.stepName} query`);
                  }
                } catch (error: unknown) {
                  console.error(`Error querying TARGET ${queryConfig.stepName}:`, error);
                  // Log the specific error message which might indicate field name issues
                  if (error instanceof Error && (error.message?.includes('No such column') || error.message?.includes('Invalid field'))) {
                    console.error('TARGET field name issue detected. Query:', query);
                    console.error('TARGET error details:', error.message);
                  }
                }
              }
              
              console.log('🔍 DEBUGGING: TARGET child counts map:', Object.fromEntries(
                Array.from(actualChildCounts.entries()).map(([sourceId, stepCounts]) => [
                  sourceId, 
                  Object.fromEntries(stepCounts.entries())
                ])
              ));

              // Compare SOURCE vs TARGET counts
              console.log('🔍 DEBUGGING: === MIGRATION COMPARISON ===');
              successfulParentIds.forEach(sourceParentId => {
                const sourceStepCounts = sourceChildCounts.get(sourceParentId);
                const targetStepCounts = actualChildCounts.get(sourceParentId);
                
                if (sourceStepCounts && targetStepCounts) {
                  console.log(`🔍 DEBUGGING: Parent ${sourceParentId} comparison:`);
                  childObjectQueries.forEach(queryConfig => {
                    const sourceCount = sourceStepCounts.get(queryConfig.stepName) || 0;
                    const targetCount = targetStepCounts.get(queryConfig.stepName) || 0;
                    const match = sourceCount === targetCount ? '✅' : '❌';
                    console.log(`🔍   ${queryConfig.stepName}: SOURCE=${sourceCount} → TARGET=${targetCount} ${match}`);
                  });
                } else {
                  console.log(`🔍 DEBUGGING: Missing counts for parent ${sourceParentId} - SOURCE:${!!sourceStepCounts} TARGET:${!!targetStepCounts}`);
                }
              });
              } // End of else block for childObjectQueries.length check
            } catch (error: unknown) {
              console.error('Error querying child record counts:', error);
            }
          }

          // Calculate total child records for each selected parent
          successfulParentIds.forEach(parentId => {
            if (recordResults.has(parentId)) {
              const record = recordResults.get(parentId)!;
              const stepCounts = actualChildCounts.get(parentId);
              if (stepCounts) {
                record.totalChildRecords = Array.from(stepCounts.values()).reduce((sum, count) => sum + count, 0);
              }
            }
          });

          // Process each step result
          for (const step of stepResults) {
            // Update record results based on step outcomes
            const parentStepNames = ['interpretationRuleMaster', 'payCodeMaster', 'leaveRuleMaster'];
            if (parentStepNames.includes(step.stepName)) {
              // This is the parent record step
              step.errors?.forEach((error) => {
                const sourceId = (error as any).sourceRecordId || error.recordId;
                if (recordResults.has(sourceId)) {
                  const record = recordResults.get(sourceId)!;
                  record.status = 'failed';
                  record.errors.push(error);
                }
              });

              // Update successful parent records with target IDs and URLs
              Object.entries(lookupMappings).forEach(([sourceId, targetId]) => {
                if (recordResults.has(sourceId)) {
                  const record = recordResults.get(sourceId)!;
                  record.targetId = targetId;
                  // Ensure we have a valid instance URL and construct the full Salesforce record URL
                  // Prefer camelCase property (from ExecutionContext) over snake_case (from database)
                  const instanceUrl = targetOrg.instanceUrl;
                  if (instanceUrl && instanceUrl !== 'undefined') {
                    record.targetUrl = `${instanceUrl}/${targetId}`;
                  } else {
                    console.warn('Target organisation instanceUrl is undefined or invalid:', {
                      instanceUrl: targetOrg.instanceUrl,
                      targetOrgKeys: Object.keys(targetOrg)
                    });
                    record.targetUrl = undefined;
                  }
                }
              });
            } else {
              // This is a child record step
              if (successfulParentCount > 0 && step.totalRecords > 0) {
                // Distribute step results based on actual child record counts for this specific step
                successfulParentIds.forEach((parentId) => {
                  if (recordResults.has(parentId)) {
                    const record = recordResults.get(parentId)!;
                    
                    // Check if we already have details for this step
                    const existingStepDetail = record.childRecordDetails.find(d => d.stepName === step.stepName);
                    
                    if (!existingStepDetail) {
                      const stepCounts = actualChildCounts.get(parentId);
                      const actualChildCountForStep = stepCounts?.get(step.stepName) || 0;
                      
                      // Calculate this parent's proportion of the step results
                      const totalChildrenForStep = Array.from(actualChildCounts.values())
                        .reduce((sum, stepMap) => sum + (stepMap.get(step.stepName) || 0), 0);
                      
                      const proportion = totalChildrenForStep > 0 ? actualChildCountForStep / totalChildrenForStep : 0;
                      const thisParentSuccess = Math.round(step.successfulRecords * proportion);
                      const thisParentFail = Math.round(step.failedRecords * proportion);
                      
                      // Add step details with proportional counts
                      const stepDetail = {
                        stepName: step.stepName,
                        successCount: thisParentSuccess,
                        failCount: thisParentFail,
                        errors: step.errors?.filter((error) => 
                          (error as any).sourceRecordId === parentId || error.recordId === parentId
                        ) || []
                      };
                      
                      record.childRecordDetails.push(stepDetail);
                      
                      // Update totals for this specific parent
                      record.successfulChildRecords += thisParentSuccess;
                      record.failedChildRecords += thisParentFail;
                    }
                  }
                });
              }
            }
          }

          return Array.from(recordResults.values());
        };

        // Helper function to get unique errors with improved pattern matching and parent record grouping
        const getUniqueErrors = (stepResults: StepExecutionResult[]) => {
          const errorMap = new Map<string, { 
            count: number; 
            examples: string[]; 
            originalMessage: string;
            parentRecords: Set<string>;
            interpretationRules: Set<string>;
          }>();
          
          // Function to normalize error messages and extract parent record information
          const normalizeErrorMessage = (message: string) => {
            // Extract interpretation rule name from breakpoint error messages
            const breakpointMatch = message.match(/please check Breakpoint: ([^:]+):/);
            const interpretationRule = breakpointMatch ? breakpointMatch[1] : null;
            
            // Normalize the error message by replacing specific breakpoint names with placeholder
            const normalized = message
              .replace(/please check Breakpoint: [^:]+:/g, 'please check Breakpoint: [BREAKPOINT_NAME]:')
              .replace(/Breakpoint: [^:]+:/g, 'Breakpoint: [BREAKPOINT_NAME]:');
            
            return { normalized, interpretationRule };
          };
          
          stepResults.forEach(step => {
            step.errors?.forEach((error) => {
              const { normalized, interpretationRule } = normalizeErrorMessage(error.error);
              
              if (errorMap.has(normalized)) {
                const existing = errorMap.get(normalized)!;
                existing.count++;
                if (existing.examples.length < 3) {
                  existing.examples.push(error.recordId);
                }
                if (interpretationRule) {
                  existing.interpretationRules.add(interpretationRule);
                }
              } else {
                const interpretationRules = new Set<string>();
                if (interpretationRule) {
                  interpretationRules.add(interpretationRule);
                }
                
                errorMap.set(normalized, {
                  count: 1,
                  examples: [error.recordId],
                  originalMessage: error.error,
                  parentRecords: new Set(),
                  interpretationRules
                });
              }
            });
          });

          return Array.from(errorMap.entries()).map(([normalizedMessage, data]) => {
            // Create a more descriptive message that includes parent record context
            let enhancedMessage = normalizedMessage;
            
            if (data.interpretationRules.size > 0) {
              const ruleNames = Array.from(data.interpretationRules);
              if (ruleNames.length === 1) {
                enhancedMessage = enhancedMessage.replace(
                  '[BREAKPOINT_NAME]', 
                  ruleNames[0]
                );
              } else {
                enhancedMessage = `${enhancedMessage} (Affects ${ruleNames.length} interpretation rules: ${ruleNames.slice(0, 3).join(', ')}${ruleNames.length > 3 ? '...' : ''})`;
              }
            }
            
            return {
              message: enhancedMessage,
              originalMessage: data.originalMessage,
              count: data.count,
              examples: data.examples,
              interpretationRules: Array.from(data.interpretationRules)
            };
          });
        };

        // If the migration failed completely, return an error response
        if (result.status === 'failed') {
          const errorDetails = result.stepResults
            .filter(step => step.errors.length > 0)
            .map(step => ({
              stepName: step.stepName,
              errors: step.errors
            }));

          const detailedRecordResults = await getDetailedRecordResults(
            result.stepResults, 
            result.lookupMappings, 
            selectedRecords, 
            executionContext.targetOrg,
            sourceClient,
            template
          );

          return NextResponse.json({
            success: false,
            error: 'Migration execution failed. Any successfully inserted records have been automatically rolled back.',
            details: errorDetails,
            uniqueErrors: getUniqueErrors(result.stepResults),
            recordResults: detailedRecordResults,
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
                errorCount: step.errors?.length || 0,
                errors: step.errors
              })),
              lookupMappings: result.lookupMappings
            },
            progressUpdates
          }, { status: 400 });
        }

        // If the migration has any errors, treat as failure
        const hasSignificantErrors = result.failedRecords > 0;

        const detailedRecordResults = await getDetailedRecordResults(
          result.stepResults, 
          result.lookupMappings, 
          selectedRecords, 
          executionContext.targetOrg,
          sourceClient,
          template
        );

        return NextResponse.json({
          success: true,
          warning: hasSignificantErrors ? `Migration completed with ${result.failedRecords} errors out of ${result.totalRecords} records` : undefined,
          sessionId: session.id,
          recordResults: detailedRecordResults,
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
              errorCount: step.errors?.length || 0,
              errors: hasSignificantErrors ? step.errors : undefined // Include errors only if significant
            })),
            lookupMappings: result.lookupMappings
          },
          uniqueErrors: hasSignificantErrors ? getUniqueErrors(result.stepResults) : undefined,
          progressUpdates
        });

        // Log success metrics to Sentry
        Sentry.setContext("migration_metrics", {
          recordsProcessed: result.totalRecords,
          successRate: result.totalRecords > 0 ? result.successfulRecords / result.totalRecords : 0,
          executionTimeMs: result.executionTimeMs,
          failedRecords: result.failedRecords
        });

      } catch (error: unknown) {
        console.error('Migration execution error:', error);
        
        // Enhanced error context for Sentry
        Sentry.setContext("migration_error", {
          migrationId,
          phase: "execution",
          error: error instanceof Error ? error.message : String(error)
        });
        
        Sentry.captureException(error);
        
        // Track unexpected execution errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorCode = 'UNKNOWN_ERROR';
        let errorType = 'unknown';
        
        // Categorize the error
        if (error instanceof Error) {
          if (error.message.includes('invalid_grant') || 
              error.message.includes('expired') ||
              error.message.includes('INVALID_SESSION_ID') ||
              error.message.includes('Authentication token has expired') ||
              error.message.includes('not connected')) {
            errorCode = 'TOKEN_EXPIRED';
            errorType = 'authentication';
          } else if (error.message.includes('ECONNRESET') || 
                     error.message.includes('ETIMEDOUT') ||
                     error.message.includes('network')) {
            errorCode = 'NETWORK_ERROR';
            errorType = 'network';
          } else if (error.message.includes('permission') ||
                     error.message.includes('access')) {
            errorCode = 'PERMISSION_ERROR';
            errorType = 'permission';
          }
        }
        
        // Track the failure if we're authenticated
        try {
          const authSession = await requireAuth(request);
          const sessionId = crypto.randomUUID();
          await usageTracker.trackMigrationFailure(
            migrationId,
            sessionId,
            authSession.user.id,
            errorMessage,
            {
              failedAtStep: 'execution_error',
              errorCode,
              stackTrace: error instanceof Error ? error.stack : undefined
            }
          );
        } catch (trackErr) {
          console.error('Failed to track error:', trackErr);
        }
        
        // Check if it's a token-related error
        if (errorCode === 'TOKEN_EXPIRED') {
          return NextResponse.json(
            { 
              error: 'Authentication token has expired. Please reconnect the organisation.',
              code: 'TOKEN_EXPIRED',
              reconnectUrl: `/orgs?returnUrl=/migrations/${migrationId}/execute`
            },
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to execute migration',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and get current user
    const authSession = await requireAuth(request);
    
    // Await params as required by Next.js 15
    const { id: migrationId } = await params;

    // First verify the migration project belongs to current user
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: migrationId,
        user_id: authSession.user.id // Ensure project belongs to current user
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

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

  } catch (error: unknown) {
    console.error('Get execution status error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get execution status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 