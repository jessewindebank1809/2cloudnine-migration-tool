import { SalesforceClient } from '@/lib/salesforce/client';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { ObjectDiscoveryEngine } from '@/lib/salesforce/object-discovery';

export interface ExtractionOptions {
  objectName: string;
  fields?: string[];
  where?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
  batchSize?: number;
}

export interface ExtractionResult {
  records: any[];
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
}

export interface RelationshipInfo {
  field: string;
  referencedObject: string;
  records: Set<string>;
}

export class DataExtractor {
  private readonly DEFAULT_BATCH_SIZE = 200;
  private readonly MAX_BATCH_SIZE = 2000;

  /**
   * Extract all records for an object type
   */
  async extractAllRecords(
    orgId: string,
    objectName: string,
    options?: Partial<ExtractionOptions>
  ): Promise<any[]> {
    const client = await sessionManager.getClient(orgId);
    const allRecords: any[] = [];
    let done = false;
    let nextRecordsUrl: string | undefined;

    // Get object metadata to determine fields
    const fields = options?.fields || await this.getExtractableFields(orgId, objectName);
    
    // Build initial query
    const query = this.buildQuery(objectName, fields, options);

    while (!done) {
      const result = await sessionManager.executeWithRateLimit(orgId, async () => {
        if (nextRecordsUrl) {
          return await this.queryMore(client, nextRecordsUrl);
        } else {
          return await this.query(client, query);
        }
      });

      allRecords.push(...result.records);
      done = result.done;
      nextRecordsUrl = result.nextRecordsUrl;
    }

    return allRecords;
  }

  /**
   * Extract records in batches for large datasets
   */
  async *extractRecordsBatched(
    orgId: string,
    objectName: string,
    options?: Partial<ExtractionOptions>
  ): AsyncGenerator<any[], void, unknown> {
    const client = await sessionManager.getClient(orgId);
    const batchSize = Math.min(
      options?.batchSize || this.DEFAULT_BATCH_SIZE,
      this.MAX_BATCH_SIZE
    );

    // Get total count first
    const countQuery = `SELECT COUNT() FROM ${objectName}${options?.where ? ' WHERE ' + options.where : ''}`;
    const countResult = await this.query(client, countQuery);
    const totalRecords = countResult.totalSize;

    // Get fields to extract
    const fields = options?.fields || await this.getExtractableFields(orgId, objectName);

    // Extract in batches using OFFSET
    let offset = 0;
    while (offset < totalRecords) {
      const batchQuery = this.buildQuery(objectName, fields, {
        ...options,
        limit: batchSize,
        offset
      });

      const result = await sessionManager.executeWithRateLimit(orgId, async () => {
        return await this.query(client, batchQuery);
      });

      yield result.records;
      offset += batchSize;

      // If we got fewer records than expected, we're done
      if (result.records.length < batchSize) {
        break;
      }
    }
  }

  /**
   * Extract records with their relationships
   */
  async extractWithRelationships(
    orgId: string,
    objectName: string,
    records: any[]
  ): Promise<{
    records: any[];
    relationships: Map<string, RelationshipInfo>;
  }> {
    const client = await sessionManager.getClient(orgId);
    const discoveryEngine = new ObjectDiscoveryEngine(client);
    
    // Get object metadata
    const objectMetadata = await discoveryEngine.getObjectDetails(objectName);
    if (!objectMetadata) {
      throw new Error(`Cannot get metadata for object ${objectName}`);
    }

    // Find relationship fields
    const relationships = new Map<string, RelationshipInfo>();
    
    for (const field of objectMetadata.fields) {
      if (field.type === 'reference' && field.referenceTo && field.referenceTo.length > 0) {
        const relInfo: RelationshipInfo = {
          field: field.name,
          referencedObject: field.referenceTo[0],
          records: new Set<string>()
        };

        // Collect all referenced IDs
        for (const record of records) {
          const refId = record[field.name];
          if (refId) {
            relInfo.records.add(refId);
          }
        }

        if (relInfo.records.size > 0) {
          relationships.set(field.name, relInfo);
        }
      }
    }

    return { records, relationships };
  }

  /**
   * Extract parent records needed for relationships
   */
  async extractParentRecords(
    orgId: string,
    relationships: Map<string, RelationshipInfo>
  ): Promise<Map<string, Map<string, any>>> {
    const parentRecords = new Map<string, Map<string, any>>();

    for (const [fieldName, relInfo] of Array.from(relationships.entries())) {
      if (relInfo.records.size === 0) continue;

      // Convert Set to Array and chunk if needed
      const ids = Array.from(relInfo.records);
      const chunks = this.chunkArray(ids, 200); // SOQL IN clause limit

      const objectRecords = new Map<string, any>();

      for (const chunk of chunks) {
        const query = `SELECT Id, Name FROM ${relInfo.referencedObject} WHERE Id IN ('${chunk.join("','")}')`;
        
        const result = await sessionManager.executeWithRateLimit(orgId, async () => {
          const client = await sessionManager.getClient(orgId);
          return await this.query(client, query);
        });

        for (const record of result.records) {
          objectRecords.set(record.Id, record);
        }
      }

      parentRecords.set(fieldName, objectRecords);
    }

    return parentRecords;
  }

  /**
   * Get count of records
   */
  async getRecordCount(
    orgId: string,
    objectName: string,
    where?: string
  ): Promise<number> {
    const client = await sessionManager.getClient(orgId);
    const query = `SELECT COUNT() FROM ${objectName}${where ? ' WHERE ' + where : ''}`;
    
    const result = await sessionManager.executeWithRateLimit(orgId, async () => {
      return await this.query(client, query);
    });

    return result.totalSize;
  }

  /**
   * Build SOQL query
   */
  private buildQuery(
    objectName: string,
    fields: string[],
    options?: Partial<ExtractionOptions>
  ): string {
    let query = `SELECT ${fields.join(', ')} FROM ${objectName}`;

    if (options?.where) {
      query += ` WHERE ${options.where}`;
    }

    if (options?.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return query;
  }

  /**
   * Get extractable fields for an object
   */
  private async getExtractableFields(
    orgId: string,
    objectName: string
  ): Promise<string[]> {
    const client = await sessionManager.getClient(orgId);
    const discoveryEngine = new ObjectDiscoveryEngine(client);
    
    const objectMetadata = await discoveryEngine.getObjectDetails(objectName);
    if (!objectMetadata) {
      throw new Error(`Cannot get metadata for object ${objectName}`);
    }

    // Filter out non-queryable fields
    const fields = objectMetadata.fields
      .filter(field => {
        // Skip compound fields and non-createable system fields
        const skipFields = [
          'SetupOwnerId',
          'IsDeleted',
          'SystemModstamp',
          'LastViewedDate',
          'LastReferencedDate'
        ];
        
        return !skipFields.includes(field.name) && 
               field.type !== 'address' &&
               field.type !== 'location';
      })
      .map(field => field.name);

    // Always include Id
    if (!fields.includes('Id')) {
      fields.unshift('Id');
    }

    return fields;
  }

  /**
   * Execute SOQL query
   */
  private async query(client: SalesforceClient, soql: string): Promise<ExtractionResult> {
    const result = await client.query(soql);
    
    if (!result.success) {
      throw new Error(`Query failed: ${result.error}`);
    }

    return {
      records: result.data || [],
      totalSize: result.totalSize || 0,
      done: true, // Simple query is always done
    };
  }

  /**
   * Query more records from a nextRecordsUrl
   */
  private async queryMore(_client: SalesforceClient, _nextRecordsUrl: string): Promise<ExtractionResult> {
    // This would need to be implemented in the SalesforceClient
    // For now, return empty result
    return {
      records: [],
      totalSize: 0,
      done: true,
    };
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 