import { SalesforceClient } from '@/lib/salesforce/client';
import type { SalesforceOrg } from '@/types';
import { 
  ETLStep, 
  MigrationTemplate, 
  ExecutionResult, 
  ExecutionProgress,
  LookupMapping,
  RecordTypeMapping
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
  externalIdField: string;
  config: ExecutionConfig;
}

export interface StepExecutionResult {
  stepName: string;
  status: 'success' | 'partial' | 'failed';
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

        // Stop execution if step failed completely
        if (stepResult.status === 'failed') {
          break;
        }
      }

      const executionTime = Date.now() - startTime;
      const finalStatus = failedRecords === 0 ? 'success' : 
                         successfulRecords > 0 ? 'partial' : 'failed';

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

      const status = failureCount === 0 ? 'success' : 
                    successCount > 0 ? 'partial' : 'failed';

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
    const selectedIds = context.selectedRecords[objectType] || [];
    
    if (selectedIds.length === 0) {
      return [];
    }

    // Replace external ID field placeholder in query
    let query = step.extractConfig.soqlQuery.replace(/{externalIdField}/g, context.externalIdField);
    
    // Add WHERE clause for selected records
    if (query.toLowerCase().includes('where')) {
      query += ` AND Id IN ('${selectedIds.join("','")}')`;
    } else {
      query += ` WHERE Id IN ('${selectedIds.join("','")}')`;
    }

    const result = await this.sourceClient.query(query);
    if (!result.success) {
      throw new Error(result.error || 'Query failed');
    }
    return result.data || [];
  }

  /**
   * Transform records according to step configuration
   */
  private async transformRecords(records: any[], step: ETLStep, context: ExecutionContext): Promise<any[]> {
    const transformed = [];

    for (const record of records) {
      const transformedRecord: any = {};

      // Apply field mappings
      for (const fieldMapping of step.transformConfig.fieldMappings) {
        const targetField = fieldMapping.targetField;
        const sourceField = fieldMapping.sourceField;

        if (sourceField.startsWith('lookup:')) {
          // Handle lookup field
          const lookupConfig = sourceField.replace('lookup:', '');
          const lookupValue = await this.resolveLookup(record[lookupConfig], step.transformConfig.lookupMappings || [], context);
          transformedRecord[targetField] = lookupValue;
        } else if (sourceField.startsWith('recordType:')) {
          // Handle record type mapping
          const recordTypeName = sourceField.replace('recordType:', '');
          const recordTypeId = await this.resolveRecordType(recordTypeName, step.extractConfig.objectApiName, context);
          transformedRecord[targetField] = recordTypeId;
        } else {
          // Direct field mapping
          transformedRecord[targetField] = record[sourceField];
        }
      }

      // Set external ID field
      transformedRecord[context.externalIdField] = record.Id;

      transformed.push(transformedRecord);
    }

    return transformed;
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

    const errors: Array<{ recordId: string; error: string; retryable: boolean }> = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      const operation = step.loadConfig.operation;
      const objectType = step.loadConfig.targetObject;

      let result;
      if (operation === 'upsert' || operation === 'insert') {
        result = await this.targetClient.bulkInsert(objectType, records);
      } else if (operation === 'update') {
        result = await this.targetClient.bulkUpdate(objectType, records);
      } else {
        throw new Error(`Unsupported operation: ${operation}`);
      }

      if (result.success) {
        successCount = records.length;
        // Set IDs for successful records
        records.forEach((record, index) => {
          record.Id = `generated-id-${batchNumber}-${index}`;
        });
      } else {
        failureCount = records.length;
        records.forEach((record, index) => {
          errors.push({
            recordId: record[context.externalIdField] || `batch-${batchNumber}-${index}`,
            error: result.error || 'Unknown error',
            retryable: false
          });
        });
      }

    } catch (error) {
      failureCount = records.length;
      records.forEach((record, index) => {
        errors.push({
          recordId: record[context.externalIdField] || `batch-${batchNumber}-${index}`,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: false
        });
      });
    }

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
        const query = `SELECT Id FROM ${mapping.lookupObject} WHERE ${mapping.lookupKeyField} = '${sourceValue}' LIMIT 1`;
        const result = await this.targetClient.query(query);
        
        if (result.success && result.data && result.data.length > 0) {
          const targetId = result.data[0].Id;
          
          if (targetId) {
            // Cache the result
            if (!this.lookupCache.has(mapping.lookupObject)) {
              this.lookupCache.set(mapping.lookupObject, new Map());
            }
            this.lookupCache.get(mapping.lookupObject)!.set(cacheKey, targetId);
            
            return targetId;
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
      const query = `SELECT Id FROM RecordType WHERE SObjectType = '${objectType}' AND DeveloperName = '${recordTypeName}' LIMIT 1`;
      const result = await this.targetClient.query(query);
      
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
      step.transformConfig.fieldMappings.forEach(mapping => {
        if (mapping.sourceField.startsWith('recordType:')) {
          objectTypes.add(step.loadConfig.targetObject);
        }
      });
    });

    // Pre-load record types for each object
    for (const objectType of Array.from(objectTypes)) {
      try {
        const query = `SELECT Id, DeveloperName FROM RecordType WHERE SObjectType = '${objectType}'`;
        const result = await this.targetClient.query(query);
        
        if (result.success && result.data) {
          const cache = new Map<string, string>();
          result.data.forEach((rt: any) => {
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
}

// Default execution configuration
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  batchSize: 200,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableProgressTracking: true,
  enableLookupCaching: true
}; 