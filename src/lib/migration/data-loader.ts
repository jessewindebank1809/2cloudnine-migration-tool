import { SalesforceClient } from '@/lib/salesforce/client';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { FieldMappingEngine, ObjectMapping } from './field-mapping-engine';
import { ObjectDiscoveryEngine } from '@/lib/salesforce/object-discovery';

export interface LoadOptions {
  useBulkApi?: boolean;
  batchSize?: number;
  allowPartialSuccess?: boolean;
  skipDuplicates?: boolean;
}

export interface LoadResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: LoadError[];
  idMapping: Map<string, string>; // sourceId -> targetId
}

export interface LoadError {
  index: number;
  sourceId?: string;
  error: string;
  fields?: string[];
}

export class DataLoader {
  private readonly DEFAULT_BATCH_SIZE = 200;
  private readonly BULK_API_THRESHOLD = 1000;
  private fieldMappingEngine = new FieldMappingEngine();

  /**
   * Load records into target org
   */
  async loadRecords(
    sourceOrgId: string,
    targetOrgId: string,
    objectName: string,
    records: any[],
    options?: LoadOptions
  ): Promise<LoadResult> {
    // Get field mappings
    const mapping = await this.getFieldMapping(sourceOrgId, targetOrgId, objectName);
    
    // Transform records based on mappings
    const idMapping = new Map<string, string>();
    const transformedRecords = await this.transformRecords(records, mapping, idMapping);

    // Determine load strategy
    const useBulkApi = options?.useBulkApi ?? records.length >= this.BULK_API_THRESHOLD;
    
    if (useBulkApi) {
      return await this.bulkLoad(targetOrgId, objectName, transformedRecords, idMapping, options);
    } else {
      return await this.standardLoad(targetOrgId, objectName, transformedRecords, idMapping, options);
    }
  }

  /**
   * Load records with relationship preservation
   */
  async loadWithRelationships(
    sourceOrgId: string,
    targetOrgId: string,
    objectName: string,
    records: any[],
    parentIdMappings: Map<string, Map<string, string>>,
    options?: LoadOptions
  ): Promise<LoadResult> {
    // Get field mappings
    const mapping = await this.getFieldMapping(sourceOrgId, targetOrgId, objectName);
    
    // Transform records with relationship remapping
    const idMapping = new Map<string, string>();
    const transformedRecords = await this.transformRecords(
      records, 
      mapping, 
      idMapping,
      parentIdMappings
    );

    // Load records
    const useBulkApi = options?.useBulkApi ?? records.length >= this.BULK_API_THRESHOLD;
    
    if (useBulkApi) {
      return await this.bulkLoad(targetOrgId, objectName, transformedRecords, idMapping, options);
    } else {
      return await this.standardLoad(targetOrgId, objectName, transformedRecords, idMapping, options);
    }
  }

  /**
   * Standard API load (for smaller datasets)
   */
  private async standardLoad(
    orgId: string,
    objectName: string,
    records: any[],
    idMapping: Map<string, string>,
    options?: LoadOptions
  ): Promise<LoadResult> {
    const client = await sessionManager.getClient(orgId);
    const batchSize = options?.batchSize || this.DEFAULT_BATCH_SIZE;
    
    const result: LoadResult = {
      success: true,
      successCount: 0,
      errorCount: 0,
      errors: [],
      idMapping: new Map()
    };

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const insertResult = await sessionManager.executeWithRateLimit(orgId, async () => {
          // Use composite API for better performance
          return await this.compositeInsert(client, objectName, batch);
        });

        // Process results
        insertResult.forEach((res: any, index: number) => {
          const recordIndex = i + index;
          const sourceId = this.getSourceId(records[recordIndex]);
          
          if (res.success) {
            result.successCount++;
            if (sourceId) {
              result.idMapping.set(sourceId, res.id);
            }
          } else {
            result.errorCount++;
            result.errors.push({
              index: recordIndex,
              sourceId,
              error: this.formatError(res.errors),
              fields: res.errors?.map((e: any) => e.fields).flat()
            });
          }
        });

      } catch (error) {
        // Batch failed completely
        result.success = false;
        batch.forEach((record, index) => {
          result.errorCount++;
          result.errors.push({
            index: i + index,
            sourceId: this.getSourceId(record),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });

        if (!options?.allowPartialSuccess) {
          break;
        }
      }
    }

    return result;
  }

  /**
   * Bulk API load (for larger datasets)
   */
  private async bulkLoad(
    orgId: string,
    objectName: string,
    records: any[],
    idMapping: Map<string, string>,
    options?: LoadOptions
  ): Promise<LoadResult> {
    const client = await sessionManager.getClient(orgId);
    
    try {
      const bulkResult = await client.bulkInsert(objectName, records);
      
      if (!bulkResult.success) {
        throw new Error(bulkResult.error || 'Bulk insert failed');
      }

      // Process bulk results
      return this.processBulkResults(bulkResult.data, records, idMapping);
      
    } catch (error) {
      return {
        success: false,
        successCount: 0,
        errorCount: records.length,
        errors: [{
          index: 0,
          error: error instanceof Error ? error.message : 'Bulk load failed'
        }],
        idMapping: new Map()
      };
    }
  }

  /**
   * Get field mapping between orgs
   */
  private async getFieldMapping(
    sourceOrgId: string,
    targetOrgId: string,
    objectName: string
  ): Promise<ObjectMapping> {
    // Get object metadata from both orgs
    const [sourceClient, targetClient] = await Promise.all([
      sessionManager.getClient(sourceOrgId),
      sessionManager.getClient(targetOrgId)
    ]);

    const sourceDiscovery = new ObjectDiscoveryEngine(sourceClient);
    const targetDiscovery = new ObjectDiscoveryEngine(targetClient);

    const [sourceObject, targetObject] = await Promise.all([
      sourceDiscovery.getObjectDetails(objectName),
      targetDiscovery.getObjectDetails(objectName)
    ]);

    if (!sourceObject || !targetObject) {
      throw new Error(`Object ${objectName} not found in source or target org`);
    }

    // Generate mappings
    return await this.fieldMappingEngine.generateMappings(sourceObject, targetObject);
  }

  /**
   * Transform records based on field mappings
   */
  private async transformRecords(
    records: any[],
    mapping: ObjectMapping,
    idMapping: Map<string, string>,
    parentIdMappings?: Map<string, Map<string, string>>
  ): Promise<any[]> {
    const transformedRecords: any[] = [];

    for (const record of records) {
      // Store original ID for mapping
      const sourceId = record.Id;
      
      // Transform record
      const transformed = await this.fieldMappingEngine.transformRecord(
        record,
        mapping,
        parentIdMappings?.get(mapping.sourceObject) || new Map()
      );

      // Remove source ID from transformed record
      delete transformed.Id;
      
      // Store mapping for later reference
      if (sourceId) {
        idMapping.set(sourceId, ''); // Will be updated after insert
      }

      transformedRecords.push(transformed);
    }

    return transformedRecords;
  }

  /**
   * Composite API insert
   */
  private async compositeInsert(
    client: SalesforceClient,
    objectName: string,
    records: any[]
  ): Promise<any[]> {
    // This would need to be implemented in SalesforceClient
    // For now, insert one by one
    const results: any[] = [];
    
    for (const record of records) {
      try {
        const connection = (client as any).connection;
        const result = await connection.sobject(objectName).create(record);
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          errors: [{
            message: error.message || 'Insert failed',
            fields: []
          }]
        });
      }
    }

    return results;
  }

  /**
   * Process bulk API results
   */
  private processBulkResults(
    bulkResults: any,
    records: any[],
    idMapping: Map<string, string>
  ): LoadResult {
    const result: LoadResult = {
      success: true,
      successCount: 0,
      errorCount: 0,
      errors: [],
      idMapping: new Map()
    };

    // Process each result
    bulkResults.forEach((res: any, index: number) => {
      const sourceId = this.getSourceId(records[index]);
      
      if (res.success || res.created) {
        result.successCount++;
        if (sourceId && res.id) {
          result.idMapping.set(sourceId, res.id);
        }
      } else {
        result.errorCount++;
        result.errors.push({
          index,
          sourceId,
          error: res.errors ? this.formatError(res.errors) : 'Unknown error'
        });
      }
    });

    result.success = result.errorCount === 0;
    return result;
  }

  /**
   * Get source ID from record
   */
  private getSourceId(record: any): string | undefined {
    return record.__sourceId || record.Id;
  }

  /**
   * Format error message from Salesforce errors
   */
  private formatError(errors: any[]): string {
    if (!errors || errors.length === 0) {
      return 'Unknown error';
    }

    return errors
      .map(e => e.message || e.statusCode || 'Unknown error')
      .join('; ');
  }
} 