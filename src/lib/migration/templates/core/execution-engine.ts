import { SalesforceClient } from '@/lib/salesforce/client';
import type { SalesforceOrg } from '@/types';
import { RollbackService, RollbackRecord } from '../../rollback-service';
import { ExternalIdUtils } from '../utils/external-id-utils';
import { 
  ETLStep, 
  MigrationTemplate, 
  ExecutionResult, 
  ExecutionProgress,
  LookupMapping,
  RecordTypeMapping,
  ExternalIdConfig
} from './interfaces';

export interface ExecutionConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  enableProgressTracking: boolean;
  enableLookupCaching: boolean;
}

export interface ExecutionContext {
  sourceOrg: SalesforceOrg;
  targetOrg: SalesforceOrg;
  template: MigrationTemplate;
  selectedRecords: Record<string, string[]>; // objectType -> recordIds
  externalIdField: string; // Deprecated: use externalIdConfig instead
  externalIdConfig: ExternalIdConfig;
  config: ExecutionConfig;
}

export interface StepExecutionResult {
  stepName: string;
  status: 'success' | 'failed';
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{
    recordId: string;
    error: string;
    retryable: boolean;
  }>;
  lookupMappings: Record<string, string>; // sourceId -> targetId
  executionTimeMs: number;
}

export interface BatchResult {
  batchNumber: number;
  records: any[];
  successCount: number;
  failureCount: number;
  errors: Array<{
    recordId: string;
    error: string;
    retryable: boolean;
  }>;
}

export class ExecutionEngine {
  private lookupCache = new Map<string, Map<string, string>>();
  private recordTypeCache = new Map<string, Map<string, string>>();
  private progressCallbacks: Array<(progress: ExecutionProgress) => void> = [];
  private sourceClient: SalesforceClient | null = null;
  private targetClient: SalesforceClient | null = null;
  private insertedRecords: RollbackRecord[] = [];

  constructor() {
    this.clearCaches();
  }

  /**
   * Execute a complete migration template
   */
  async executeTemplate(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    let totalRecords = 0;
    let successfulRecords = 0;
    let failedRecords = 0;

    try {
      // Initialize Salesforce clients
      this.sourceClient = new SalesforceClient(context.sourceOrg);
      this.targetClient = new SalesforceClient(context.targetOrg);

      // Clear caches for fresh execution
      this.clearCaches();
      
      // Clear inserted records tracking
      this.insertedRecords = [];

      // Pre-populate record type mappings
      await this.preloadRecordTypeMappings(context);

      // Execute each ETL step in sequence
      for (let i = 0; i < context.template.etlSteps.length; i++) {
        const step = context.template.etlSteps[i];
        
        this.notifyProgress({
          currentStep: i + 1,
          totalSteps: context.template.etlSteps.length,
          stepName: step.stepName,
          status: 'running',
          totalRecords,
          successfulRecords,
          failedRecords,
          startTime: new Date(startTime),
          estimatedCompletion: null
        });

        const stepResult = await this.executeStep(step, context);
        stepResults.push(stepResult);

        totalRecords += stepResult.totalRecords;
        successfulRecords += stepResult.successfulRecords;
        failedRecords += stepResult.failedRecords;

        // Update lookup cache with successful mappings
        this.updateLookupCache(step.stepName, stepResult.lookupMappings);

        // Stop execution if step failed
        if (stepResult.status === 'failed') {
          console.log(`Step ${step.stepName} failed (${stepResult.failedRecords} failures vs ${stepResult.successfulRecords} successes), initiating rollback...`);
          // Perform rollback of successfully inserted records
          await this.performRollback(context);
          break;
        }
      }

      const executionTime = Date.now() - startTime;
      
      // Check if any steps failed completely
      const hasFailedSteps = stepResults.some(step => step.status === 'failed');
      const finalStatus = hasFailedSteps ? 'failed' :
                         failedRecords === 0 ? 'success' : 'failed';

      this.notifyProgress({
        currentStep: context.template.etlSteps.length,
        totalSteps: context.template.etlSteps.length,
        stepName: 'Complete',
        status: finalStatus,
        totalRecords,
        successfulRecords,
        failedRecords,
        startTime: new Date(startTime),
        estimatedCompletion: new Date()
      });

      return {
        status: finalStatus,
        totalRecords,
        successfulRecords,
        failedRecords,
        stepResults,
        executionTimeMs: executionTime,
        lookupMappings: this.getAllLookupMappings()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.notifyProgress({
        currentStep: 0,
        totalSteps: context.template.etlSteps.length,
        stepName: 'Failed',
        status: 'failed',
        totalRecords,
        successfulRecords,
        failedRecords,
        startTime: new Date(startTime),
        estimatedCompletion: new Date()
      });

      return {
        status: 'failed',
        totalRecords,
        successfulRecords,
        failedRecords,
        stepResults,
        executionTimeMs: executionTime,
        lookupMappings: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a single ETL step
   */
  private async executeStep(step: ETLStep, context: ExecutionContext): Promise<StepExecutionResult> {
    const startTime = Date.now();
    const stepName = step.stepName;
    
    try {
      // Get records for this step
      const records = await this.extractRecords(step, context);
      
      if (records.length === 0) {
        return {
          stepName,
          status: 'success',
          totalRecords: 0,
          successfulRecords: 0,
          failedRecords: 0,
          errors: [],
          lookupMappings: {},
          executionTimeMs: Date.now() - startTime
        };
      }

      // Process records in batches
      const batches = this.createBatches(records, context.config.batchSize);
      const allErrors: Array<{ recordId: string; error: string; retryable: boolean }> = [];
      const lookupMappings: Record<string, string> = {};
      let successCount = 0;
      let failureCount = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Transform records
        const transformedRecords = await this.transformRecords(batch, step, context);
        
        // Log complete transformed records with all field mappings and lookups
        console.log(`\n=== FINAL TRANSFORMED RECORDS (${step.stepName} - Batch ${batchIndex + 1}) ===`);
        console.log(`Records ready for loading to target org:`);
        transformedRecords.forEach((record, index) => {
          console.log(`\nRecord ${index + 1}:`);
          console.log(JSON.stringify(record, null, 2));
        });
        console.log(`=== END TRANSFORMED RECORDS ===\n`);
        
        // Load records to target
        const batchResult = await this.loadRecords(transformedRecords, step, context, batchIndex + 1);
        
        successCount += batchResult.successCount;
        failureCount += batchResult.failureCount;
        allErrors.push(...batchResult.errors);

        // Update lookup mappings for successful records
        batchResult.records.forEach((record, index) => {
          if (index < batchResult.successCount && record.Id) {
            const sourceId = batch[index].Id;
            lookupMappings[sourceId] = record.Id;
          }
        });
      }

      const status = failureCount === 0 ? 'success' : 'failed';

      return {
        stepName,
        status,
        totalRecords: records.length,
        successfulRecords: successCount,
        failedRecords: failureCount,
        errors: allErrors,
        lookupMappings,
        executionTimeMs: Date.now() - startTime
      };

    } catch (error) {
      return {
        stepName,
        status: 'failed',
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        errors: [{
          recordId: 'N/A',
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: false
        }],
        lookupMappings: {},
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Extract records for a step
   */
  private async extractRecords(step: ETLStep, context: ExecutionContext): Promise<any[]> {
    if (!this.sourceClient) {
      throw new Error('Source client not initialized');
    }

    const objectType = step.extractConfig.objectApiName;
    let selectedIds = context.selectedRecords[objectType] || [];
    
    console.log(`Extracting records for step ${step.stepName}:`);
    console.log(`Object type: ${objectType}`);
    console.log(`Selected IDs: ${JSON.stringify(selectedIds)}`);
    
    // Special handling for breakpoint steps - use interpretation rule IDs
    if (objectType === 'tc9_et__Interpretation_Breakpoint__c' && selectedIds.length === 0) {
      const interpretationRuleIds = context.selectedRecords['tc9_et__Interpretation_Rule__c'] || [];
      if (interpretationRuleIds.length > 0) {
        console.log(`Using interpretation rule IDs for breakpoint query: ${JSON.stringify(interpretationRuleIds)}`);
        selectedIds = interpretationRuleIds;
      }
    }
    
    if (selectedIds.length === 0) {
      console.log('No selected records found, returning empty array');
      return [];
    }

    // Use cross-environment query building if available, otherwise fallback to legacy method
    let query: string;
    if (context.externalIdConfig && context.externalIdConfig.strategy === 'cross-environment') {
      query = ExternalIdUtils.buildCrossEnvironmentQuery(
        step.extractConfig.soqlQuery,
        context.externalIdConfig.sourceField,
        context.externalIdConfig.targetField
      );
    } else {
      // Legacy method - replace external ID field placeholder in query
      query = step.extractConfig.soqlQuery.replace(/{externalIdField}/g, context.externalIdField);
    }
    
    // Replace selectedRecordIds placeholder if it exists
    if (query.includes('{selectedRecordIds}')) {
      query = query.replace(/{selectedRecordIds}/g, `'${selectedIds.join("','")}'`);
    } else {
      // Add WHERE clause for selected records (legacy behavior)
      if (query.toLowerCase().includes('where')) {
        query += ` AND Id IN ('${selectedIds.join("','")}')`;
      } else {
        query += ` WHERE Id IN ('${selectedIds.join("','")}')`;
      }
    }

    console.log(`Executing query: ${query}`);
    let result = await this.sourceClient.query(query);
    
    // If the query fails due to missing external ID field, try without it
    const externalIdFieldToCheck = context.externalIdConfig?.sourceField || context.externalIdField;
    if (!result.success && result.error?.includes('No such column') && result.error?.includes(externalIdFieldToCheck)) {
      console.warn(`External ID field ${externalIdFieldToCheck} not found, trying query without it...`);
      
      // Remove the external ID field from the query, including relationship fields
      let queryWithoutExternalId = step.extractConfig.soqlQuery
        .replace(new RegExp(`\\w+__r\\.{externalIdField}\\s*,`, 'g'), '') // Remove relationship fields with trailing comma
        .replace(new RegExp(`,\\s*\\w+__r\\.{externalIdField}`, 'g'), '') // Remove relationship fields with leading comma
        .replace(new RegExp(`,\\s*{externalIdField}`, 'g'), '') // Remove with leading comma
        .replace(new RegExp(`{externalIdField}\\s*,`, 'g'), '') // Remove with trailing comma
        .replace(new RegExp(`{externalIdField}`, 'g'), ''); // Remove standalone
      
      // Replace selectedRecordIds placeholder if it exists
      if (queryWithoutExternalId.includes('{selectedRecordIds}')) {
        queryWithoutExternalId = queryWithoutExternalId.replace(/{selectedRecordIds}/g, `'${selectedIds.join("','")}'`);
      } else {
        // Add WHERE clause for selected records (legacy behavior)
        if (queryWithoutExternalId.toLowerCase().includes('where')) {
          queryWithoutExternalId += ` AND Id IN ('${selectedIds.join("','")}')`;
        } else {
          queryWithoutExternalId += ` WHERE Id IN ('${selectedIds.join("','")}')`;
        }
      }
      
      console.log(`Executing fallback query: ${queryWithoutExternalId}`);
      result = await this.sourceClient.query(queryWithoutExternalId);
    }
    
    if (!result.success) {
      console.error('Query failed:', result.error);
      throw new Error(result.error || 'Query failed');
    }
    console.log(`Query returned ${result.data?.length || 0} records`);
    
    // Special validation for breakpoint steps - they should always have records if interpretation rules exist
    if (objectType === 'tc9_et__Interpretation_Breakpoint__c' && 
        (result.data?.length || 0) === 0 && 
        (context.selectedRecords['tc9_et__Interpretation_Rule__c']?.length || 0) > 0) {
      throw new Error(`No breakpoints found for interpretation rules. Interpretation rules must have associated breakpoints.`);
    }
    
    return result.data || [];
  }

  /**
   * Transform records according to step configuration
   */
  private async transformRecords(records: any[], step: ETLStep, context: ExecutionContext): Promise<any[]> {
    const transformed = [];
    
    // Log transformation overview
    const totalFieldMappings = step.transformConfig.fieldMappings.length + (step.transformConfig.lookupMappings?.length || 0);
    console.log(`\n=== TRANSFORMATION OVERVIEW (${step.stepName}) ===`);
    console.log(`Transforming ${records.length} records`);
    console.log(`Field mappings: ${step.transformConfig.fieldMappings.length}`);
    console.log(`Lookup mappings: ${step.transformConfig.lookupMappings?.length || 0}`);
    console.log(`Record type mapping: ${step.transformConfig.recordTypeMapping ? 'Yes' : 'No'}`);
    
    // Show all field mappings (direct + lookup) in a single list
    console.log(`\nField Mappings:`);
    let fieldIndex = 1;
    
    // Show direct field mappings
    step.transformConfig.fieldMappings.forEach((mapping) => {
      const sourceField = ExternalIdUtils.replaceExternalIdPlaceholders(mapping.sourceField, context.externalIdField);
      const targetField = ExternalIdUtils.replaceExternalIdPlaceholders(mapping.targetField, context.externalIdField);
      const transformType = mapping.transformationType ? ` (${mapping.transformationType})` : '';
      console.log(`  ${fieldIndex}. ${sourceField} -> ${targetField}${transformType}`);
      fieldIndex++;
    });
    
    // Show lookup mappings as field mappings
    if (step.transformConfig.lookupMappings && step.transformConfig.lookupMappings.length > 0) {
      step.transformConfig.lookupMappings.forEach((mapping) => {
        const sourceField = mapping.sourceField.replace(/{externalIdField}/g, context.externalIdField);
        console.log(`  ${fieldIndex}. ${sourceField} -> ${mapping.targetField} (via ${mapping.lookupObject}.${mapping.lookupKeyField})`);
        fieldIndex++;
      });
    }

    for (const record of records) {
      const transformedRecord: any = {};

      // Apply field mappings
      for (const fieldMapping of step.transformConfig.fieldMappings) {
        const targetField = ExternalIdUtils.replaceExternalIdPlaceholders(fieldMapping.targetField, context.externalIdField);
        const sourceField = ExternalIdUtils.replaceExternalIdPlaceholders(fieldMapping.sourceField, context.externalIdField);

        if (sourceField.startsWith('lookup:')) {
          // Handle lookup field
          const lookupConfig = sourceField.replace('lookup:', '');
          const lookupValue = await this.resolveLookup(record[lookupConfig], step.transformConfig.lookupMappings || [], context);
          transformedRecord[targetField] = lookupValue;
        } else if (sourceField.startsWith('recordType:')) {
          // Handle record type mapping
          const recordTypeName = sourceField.replace('recordType:', '');
          const recordTypeId = await this.resolveRecordType(recordTypeName, step.loadConfig.targetObject, context);
          transformedRecord[targetField] = recordTypeId;
        } else {
          // Get source value
          const sourceValue = record[sourceField];
          
          // Apply transformation based on type
          if (fieldMapping.transformationType === 'picklist' && fieldMapping.transformationConfig?.mappingDictionary) {
            // Handle picklist value transformation
            const mappingDict = fieldMapping.transformationConfig.mappingDictionary;
            const transformedValue = mappingDict[sourceValue] || sourceValue; // Fallback to original value if no mapping found
            transformedRecord[targetField] = transformedValue;
            
            if (mappingDict[sourceValue]) {
              console.log(`Transformed picklist value: "${sourceValue}" -> "${transformedValue}" for field ${targetField}`);
            }
          } else if (fieldMapping.transformationType === 'boolean') {
            // Handle boolean transformation
            transformedRecord[targetField] = sourceValue === true || sourceValue === 'true' || sourceValue === 1;
          } else if (fieldMapping.transformationType === 'number') {
            // Handle number transformation
            transformedRecord[targetField] = sourceValue ? parseFloat(sourceValue) : null;
          } else {
            // Direct field mapping
            transformedRecord[targetField] = sourceValue;
          }
        }
      }

      // Apply lookup mappings
      if (step.transformConfig.lookupMappings) {
        // Log lookup summary for first record only
        if (records.indexOf(record) === 0) {
          console.log(`\n=== LOOKUP TRANSFORMATIONS (${step.stepName}) ===`);
          console.log(`Processing ${step.transformConfig.lookupMappings.length} lookup mappings for ${records.length} records`);
          console.log(`\n--- Sample Record Lookup Details ---`);
        }
        
        for (const lookupMapping of step.transformConfig.lookupMappings) {
          const sourceField = lookupMapping.sourceField.replace(/{externalIdField}/g, context.externalIdField);
          const sourceValue = this.getNestedValue(record, sourceField);
          
          // Only log details for the first record to avoid spam
          const isFirstRecord = records.indexOf(record) === 0;
          
          if (isFirstRecord) {
            console.log(`Lookup ${lookupMapping.targetField}: "${sourceValue}" (from ${sourceField})`);
          }
          
          if (sourceValue) {
            const targetValue = await this.resolveLookup(sourceValue, [lookupMapping], context);
            
            if (targetValue) {
              transformedRecord[lookupMapping.targetField] = targetValue;
              if (isFirstRecord) {
                console.log(`  ✓ Resolved to: "${targetValue}"`);
              }
            } else {
              if (isFirstRecord) {
                console.warn(`  ✗ Failed to resolve: "${sourceValue}" not found in target org`);
              }
            }
          } else {
            if (isFirstRecord) {
              console.log(`  ✗ No source value found for field ${sourceField}`);
            }
          }
        }
        
        if (records.indexOf(record) === 0) {
          console.log(`--- End Sample Record ---\n`);
        }
      }

      // Apply record type mapping
      if (step.transformConfig.recordTypeMapping) {
        const recordTypeMapping = step.transformConfig.recordTypeMapping;
        const sourceRecordTypeName = this.getNestedValue(record, recordTypeMapping.sourceField);
        
        if (sourceRecordTypeName && recordTypeMapping.mappingDictionary[sourceRecordTypeName]) {
          // Get the target record type name from the mapping dictionary
          const targetRecordTypeName = recordTypeMapping.mappingDictionary[sourceRecordTypeName];
          
          // If it's a placeholder, resolve the actual record type ID
          if (targetRecordTypeName === '{targetRecordTypeId}') {
            // Use the source record type name to find the corresponding target record type
            const recordTypeId = await this.resolveRecordType(sourceRecordTypeName, step.loadConfig.targetObject, context);
            if (recordTypeId) {
              transformedRecord[recordTypeMapping.targetField] = recordTypeId;
            }
          } else {
            // Use the mapped record type name to resolve the ID
            const recordTypeId = await this.resolveRecordType(targetRecordTypeName, step.loadConfig.targetObject, context);
            if (recordTypeId) {
              transformedRecord[recordTypeMapping.targetField] = recordTypeId;
            }
          }
        }
      }

      // Only set external ID field if it exists in the source record
      // This prevents trying to insert non-existent fields in the target org
      if (record.hasOwnProperty(context.externalIdField)) {
        transformedRecord[context.externalIdField] = record[context.externalIdField];
      }

      transformed.push(transformedRecord);
    }
    
    // Log transformation completion summary
    console.log(`\n=== TRANSFORMATION COMPLETE (${step.stepName}) ===`);
    console.log(`Successfully transformed ${transformed.length} records`);
    if (transformed.length > 0) {
      console.log(`Sample transformed record fields: ${Object.keys(transformed[0]).join(', ')}`);
    }
    console.log(`=== END TRANSFORMATION ===\n`);

    return transformed;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Load records to target org
   */
  private async loadRecords(
    records: any[], 
    step: ETLStep, 
    context: ExecutionContext, 
    batchNumber: number
  ): Promise<BatchResult> {
    if (!this.targetClient) {
      throw new Error('Target client not initialized');
    }

    console.log(`Loading batch ${batchNumber} with ${records.length} records to target org`);

    const errors: Array<{ recordId: string; error: string; retryable: boolean }> = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      const operation = step.loadConfig.operation;
      const objectType = step.loadConfig.targetObject;
      const externalIdField = ExternalIdUtils.replaceExternalIdPlaceholders(step.loadConfig.externalIdField, context.externalIdField);

      console.log(`Performing ${operation} operation on ${objectType} with external ID field: ${externalIdField}`);

      let result;
      if (operation === 'upsert') {
        result = await this.targetClient.bulkUpsert(objectType, records, externalIdField);
      } else if (operation === 'insert') {
        result = await this.targetClient.bulkInsert(objectType, records);
      } else if (operation === 'update') {
        result = await this.targetClient.bulkUpdate(objectType, records);
      } else {
        throw new Error(`Unsupported operation: ${operation}`);
      }

      console.log(`Load operation result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

      if (result.success && result.data) {
        // Check individual record results
        const bulkResults = Array.isArray(result.data) ? result.data : [result.data];
        
        bulkResults.forEach((recordResult: any, index: number) => {
          if (recordResult.success) {
            successCount++;
            // Set ID for successful record
            if (records[index]) {
              const targetRecordId = recordResult.id || `generated-id-${batchNumber}-${index}`;
              records[index].Id = targetRecordId;
              
              // Track successful insertion for potential rollback
              this.insertedRecords.push({
                targetRecordId,
                objectType,
                stepName: step.stepName
              });
              console.log(`Tracked record for rollback: ${targetRecordId} (${objectType})`);
            }
          } else {
            failureCount++;
            // Add error for failed record
            const recordErrors = Array.isArray(recordResult.errors) ? recordResult.errors : [recordResult.errors];
            errors.push({
              recordId: records[index] ? (records[index][context.externalIdField] || records[index].Id || `batch-${batchNumber}-${index}`) : `batch-${batchNumber}-${index}`,
              error: recordErrors.join('; ') || 'Unknown error',
              retryable: false
            });
          }
        });
        
        console.log(`Successfully loaded ${successCount} records, ${failureCount} failed`);
      } else {
        failureCount = records.length;
        console.error(`Load operation failed: ${result.error}`);
        records.forEach((record, index) => {
          errors.push({
            recordId: record[context.externalIdField] || record.Id || `batch-${batchNumber}-${index}`,
            error: result.error || 'Unknown error',
            retryable: false
          });
        });
      }

    } catch (error) {
      failureCount = records.length;
      console.error(`Load operation threw error:`, error);
      records.forEach((record, index) => {
        errors.push({
          recordId: record[context.externalIdField] || record.Id || `batch-${batchNumber}-${index}`,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: false
        });
      });
    }

    console.log(`Batch ${batchNumber} completed: ${successCount} success, ${failureCount} failures`);

    return {
      batchNumber,
      records,
      successCount,
      failureCount,
      errors
    };
  }

  /**
   * Resolve lookup field value
   */
  private async resolveLookup(
    sourceValue: any, 
    lookupMappings: LookupMapping[], 
    context: ExecutionContext
  ): Promise<string | null> {
    if (!sourceValue || !this.targetClient) return null;

    // Check cache first
    const cacheKey = `${sourceValue}`;
    for (const mapping of lookupMappings) {
      const cache = this.lookupCache.get(mapping.lookupObject);
      if (cache?.has(cacheKey)) {
        return cache.get(cacheKey) || null;
      }
    }

    // Query target org for lookup value
    for (const mapping of lookupMappings) {
      try {
        // Determine source and target external ID fields
        const sourceExternalIdField = mapping.sourceExternalIdField || 
                                     context.externalIdConfig?.sourceField || 
                                     context.externalIdField;
        const targetExternalIdField = mapping.targetExternalIdField || 
                                     context.externalIdConfig?.targetField || 
                                     context.externalIdField;

        console.log(`    Resolving lookup for ${mapping.lookupObject}:`);
        console.log(`      Source value: ${sourceValue}`);
        console.log(`      Source external ID field: ${sourceExternalIdField}`);
        console.log(`      Target external ID field: ${targetExternalIdField}`);
        
        // First, get the external ID from the source record using the source ID
        let externalId = sourceValue;
        
        // If this is a cross-environment scenario or we have a specific source field, query for it
        if (mapping.crossEnvironmentMapping || context.externalIdConfig?.strategy === 'cross-environment') {
          // Try to get external ID from source using all possible fields
          const possibleFields = [
            sourceExternalIdField,
            ExternalIdUtils.getAllPossibleExternalIdFields()
          ].flat().filter((field, index, arr) => arr.indexOf(field) === index); // Remove duplicates

          let sourceResult = null;
          for (const field of possibleFields) {
            try {
              const sourceQuery = `SELECT ${field} FROM ${mapping.lookupObject} WHERE Id = '${sourceValue}' LIMIT 1`;
              sourceResult = await this.sourceClient!.query(sourceQuery);
              
              if (sourceResult.success && sourceResult.data && sourceResult.data.length > 0 && sourceResult.data[0][field]) {
                externalId = sourceResult.data[0][field];
                console.log(`      Found external ID using field ${field}: ${externalId}`);
                break;
              }
            } catch (error) {
              // Continue to next field if this one fails
              continue;
            }
          }
          
          // If no external ID found, use source ID directly
          if (!externalId || externalId === sourceValue) {
            console.warn(`No external ID found for ${mapping.lookupObject} record ${sourceValue}, using source ID directly`);
            externalId = sourceValue;
          }
        } else {
          // Legacy behavior - try to get external ID from source
          const sourceQuery = `SELECT ${sourceExternalIdField} FROM ${mapping.lookupObject} WHERE Id = '${sourceValue}' LIMIT 1`;
          let sourceResult = await this.sourceClient!.query(sourceQuery);
          
          if (sourceResult.success && sourceResult.data && sourceResult.data.length > 0) {
            externalId = sourceResult.data[0][sourceExternalIdField] || sourceValue;
          } else if (sourceResult.error?.includes('No such column') && sourceResult.error?.includes(sourceExternalIdField)) {
            console.warn(`External ID field ${sourceExternalIdField} not found on ${mapping.lookupObject}, using source ID directly`);
            externalId = sourceValue;
          }
        }
        
        if (externalId) {
          // Replace external ID field placeholder in lookup key field
          const lookupKeyField = ExternalIdUtils.replaceExternalIdPlaceholders(
            mapping.lookupKeyField, 
            targetExternalIdField
          );
          
          // Now query the target org using the external ID
          const targetQuery = `SELECT Id FROM ${mapping.lookupObject} WHERE ${lookupKeyField} = '${externalId}' LIMIT 1`;
          console.log(`      Target query: ${targetQuery}`);
          const targetResult = await this.targetClient.query(targetQuery);
          
          if (targetResult.success && targetResult.data && targetResult.data.length > 0) {
            const targetId = targetResult.data[0].Id;
            console.log(`      Found target ID: ${targetId}`);
            
            if (targetId) {
              // Cache the result
              if (!this.lookupCache.has(mapping.lookupObject)) {
                this.lookupCache.set(mapping.lookupObject, new Map());
              }
              this.lookupCache.get(mapping.lookupObject)!.set(cacheKey, targetId);
              
              return targetId;
            }
          } else {
            console.log(`      Target query failed or returned no results: ${targetResult.error || 'No data'}`);
          }
        }
      } catch (error) {
        console.warn(`Lookup resolution failed for ${mapping.lookupObject}:`, error);
      }
    }

    return null;
  }

  /**
   * Resolve record type ID
   */
  private async resolveRecordType(
    recordTypeName: string, 
    objectType: string, 
    context: ExecutionContext
  ): Promise<string | null> {
    if (!this.targetClient) return null;

    const cache = this.recordTypeCache.get(objectType);
    if (cache?.has(recordTypeName)) {
      return cache.get(recordTypeName) || null;
    }

    try {
      // Try both Name and DeveloperName to be flexible
      let query = `SELECT Id FROM RecordType WHERE SObjectType = '${objectType}' AND Name = '${recordTypeName}' LIMIT 1`;
      let result = await this.targetClient.query(query);
      
      // If not found by Name, try DeveloperName
      if (!result.success || !result.data || result.data.length === 0) {
        query = `SELECT Id FROM RecordType WHERE SObjectType = '${objectType}' AND DeveloperName = '${recordTypeName}' LIMIT 1`;
        result = await this.targetClient.query(query);
      }
      
      if (result.success && result.data && result.data.length > 0) {
        const recordTypeId = result.data[0].Id;
        
        if (recordTypeId) {
          // Cache the result
          if (!this.recordTypeCache.has(objectType)) {
            this.recordTypeCache.set(objectType, new Map());
          }
          this.recordTypeCache.get(objectType)!.set(recordTypeName, recordTypeId);
          
          return recordTypeId;
        }
      }
    } catch (error) {
      console.warn(`Record type resolution failed for ${objectType}.${recordTypeName}:`, error);
    }

    return null;
  }

  /**
   * Pre-load record type mappings for better performance
   */
  private async preloadRecordTypeMappings(context: ExecutionContext): Promise<void> {
    if (!this.targetClient) return;

    const objectTypes = new Set<string>();
    
    // Collect all object types that need record type mappings
    context.template.etlSteps.forEach(step => {
      if (step.transformConfig.recordTypeMapping) {
        objectTypes.add(step.loadConfig.targetObject);
      }
      step.transformConfig.fieldMappings.forEach(mapping => {
        if (mapping.sourceField.startsWith('recordType:')) {
          objectTypes.add(step.loadConfig.targetObject);
        }
      });
    });

    // Pre-load record types for each object
    for (const objectType of Array.from(objectTypes)) {
      try {
        const query = `SELECT Id, Name, DeveloperName FROM RecordType WHERE SObjectType = '${objectType}'`;
        const result = await this.targetClient.query(query);
        
        if (result.success && result.data) {
          const cache = new Map<string, string>();
          result.data.forEach((rt: any) => {
            // Cache both Name and DeveloperName for flexibility
            cache.set(rt.Name, rt.Id);
            cache.set(rt.DeveloperName, rt.Id);
          });
          this.recordTypeCache.set(objectType, cache);
        }
      } catch (error) {
        console.warn(`Failed to preload record types for ${objectType}:`, error);
      }
    }
  }

  /**
   * Create batches from records
   */
  private createBatches<T>(records: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update lookup cache with new mappings
   */
  private updateLookupCache(stepName: string, mappings: Record<string, string>): void {
    if (!this.lookupCache.has(stepName)) {
      this.lookupCache.set(stepName, new Map());
    }
    
    const cache = this.lookupCache.get(stepName)!;
    Object.entries(mappings).forEach(([sourceId, targetId]) => {
      cache.set(sourceId, targetId);
    });
  }

  /**
   * Get all lookup mappings
   */
  private getAllLookupMappings(): Record<string, string> {
    const allMappings: Record<string, string> = {};
    
    this.lookupCache.forEach((cache) => {
      cache.forEach((targetId, sourceId) => {
        allMappings[sourceId] = targetId;
      });
    });

    return allMappings;
  }

  /**
   * Clear all caches
   */
  private clearCaches(): void {
    this.lookupCache.clear();
    this.recordTypeCache.clear();
  }

  /**
   * Add progress callback
   */
  public onProgress(callback: (progress: ExecutionProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Remove progress callback
   */
  public removeProgressCallback(callback: (progress: ExecutionProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify progress to all callbacks
   */
  private notifyProgress(progress: ExecutionProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    });
  }

  /**
   * Perform rollback of successfully inserted records
   */
  private async performRollback(context: ExecutionContext): Promise<void> {
    console.log(`performRollback called with ${this.insertedRecords.length} tracked records`);
    
    if (this.insertedRecords.length === 0) {
      console.log('No records to rollback - insertedRecords array is empty');
      return;
    }

    console.log(`Performing rollback of ${this.insertedRecords.length} successfully inserted records...`);
    console.log('Records to rollback:', JSON.stringify(this.insertedRecords, null, 2));

    try {
      const rollbackService = new RollbackService(context.targetOrg);
      const rollbackResult = await rollbackService.rollbackRecords(this.insertedRecords);

      if (rollbackResult.success) {
        console.log(`Rollback completed successfully: ${rollbackResult.deletedRecords} records deleted`);
      } else {
        console.error(`Rollback partially failed: ${rollbackResult.deletedRecords} deleted, ${rollbackResult.failedDeletions} failed`);
        rollbackResult.errors.forEach(error => {
          console.error(`Failed to delete record ${error.recordId}: ${error.error}`);
        });
      }
    } catch (error) {
      console.error('Rollback operation failed:', error);
    }
  }
}

// Default execution configuration
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  batchSize: 200,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableProgressTracking: true,
  enableLookupCaching: true
}; 