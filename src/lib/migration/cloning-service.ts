import { sessionManager } from '@/lib/salesforce/session-manager';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import { Connection } from 'jsforce';

export interface CloneResult {
  success: boolean;
  recordId?: string;
  externalId?: string;
  error?: string;
}

export interface CloneOptions {
  sourceOrgId: string;
  targetOrgId: string;
  sourceRecordId: string;
  objectApiName: string;
}

/**
 * Service for cloning records between Salesforce orgs
 */
export class CloningService {
  /**
   * Clone a single record from source org to target org
   * Handles both managed and unmanaged package fields
   */
  static async cloneRecord(options: CloneOptions): Promise<CloneResult> {
    const { sourceOrgId, targetOrgId, sourceRecordId, objectApiName } = options;
    
    try {
      // Get connections
      const sourceClient = await sessionManager.getClient(sourceOrgId);
      const targetClient = await sessionManager.getClient(targetOrgId);
      
      // Detect external ID fields for both source and target
      const sourceExternalIdField = await ExternalIdUtils.detectExternalIdField(objectApiName, sourceClient);
      const targetExternalIdField = await ExternalIdUtils.detectExternalIdField(objectApiName, targetClient);
      
      console.log(`Source external ID field: ${sourceExternalIdField}, Target external ID field: ${targetExternalIdField}`);
      
      // Fetch source record
      const sourceRecord = await this.fetchSourceRecord(sourceClient, objectApiName, sourceRecordId, sourceExternalIdField);
      
      if (!sourceRecord) {
        return {
          success: false,
          error: `Source record ${sourceRecordId} not found`
        };
      }
      
      // Get the external ID value from source record
      const externalIdValue = sourceRecord[sourceExternalIdField] || sourceRecord.Id;
      
      // Check if record already exists in target
      const existingRecord = await this.checkExistingRecord(targetClient, objectApiName, externalIdValue, targetExternalIdField);
      
      if (existingRecord) {
        return {
          success: true,
          recordId: existingRecord.Id,
          externalId: existingRecord[targetExternalIdField],
          error: 'Record already exists in target org'
        };
      }
      
      // Get field metadata for mapping
      const fieldMap = await this.getFieldMapping(sourceClient, targetClient, objectApiName);
      
      // Map fields from source to target
      const targetRecord = await this.mapFields(sourceRecord, fieldMap, targetClient);
      
      // Ensure external ID is set in target record with the source record's ID
      targetRecord[targetExternalIdField] = sourceRecord.Id;
      
      console.log(`Creating record in target org with external ID: ${targetRecord[targetExternalIdField]}`);
      
      // Create record in target org
      const result = await targetClient.sobject(objectApiName).create(targetRecord);
      
      if (result.success) {
        return {
          success: true,
          recordId: result.id,
          externalId: sourceRecord.Id
        };
      } else {
        return {
          success: false,
          error: 'Failed to create record in target org'
        };
      }
      
    } catch (error) {
      console.error('Error cloning record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Fetch source record with all fields
   */
  private static async fetchSourceRecord(client: Connection, objectApiName: string, recordId: string, externalIdField: string): Promise<any> {
    // Get all fields for the object
    const describe = await client.describe(objectApiName);
    const fields = describe.fields.map(f => f.name);
    
    // Build query - check if recordId is actually an external ID or a Salesforce ID
    let query: string;
    if (recordId.match(/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/)) {
      // This looks like a Salesforce ID (15 or 18 characters)
      query = `SELECT ${fields.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
    } else {
      // This is likely an external ID - try external ID field first
      query = `SELECT ${fields.join(', ')} FROM ${objectApiName} WHERE ${externalIdField} = '${recordId}' LIMIT 1`;
    }
    
    console.log(`Fetching source record with query: ${query}`);
    const result = await client.query(query);
    
    // If no record found with external ID, try ID as fallback
    if (!result.records[0] && !recordId.match(/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/)) {
      console.log(`No record found with external ID, trying with Id field`);
      query = `SELECT ${fields.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
      const fallbackResult = await client.query(query);
      return fallbackResult.records[0];
    }
    
    return result.records[0];
  }
  
  /**
   * Check if record already exists in target org
   */
  private static async checkExistingRecord(client: Connection, objectApiName: string, externalIdValue: string, externalIdField: string): Promise<any> {
    if (!externalIdValue) return null;
    
    try {
      const query = `SELECT Id, ${externalIdField} FROM ${objectApiName} WHERE ${externalIdField} = '${externalIdValue}' LIMIT 1`;
      const result = await client.query(query);
      return result.records[0] || null;
    } catch (error) {
      console.log('Record does not exist in target org');
      return null;
    }
  }
  
  /**
   * Get field mapping between source and target orgs
   */
  private static async getFieldMapping(sourceClient: Connection, targetClient: Connection, objectApiName: string): Promise<Map<string, string>> {
    const fieldMap = new Map<string, string>();
    
    // Get field metadata from both orgs
    const [sourceDescribe, targetDescribe] = await Promise.all([
      sourceClient.describe(objectApiName),
      targetClient.describe(objectApiName)
    ]);
    
    const targetFieldNames = new Set(targetDescribe.fields.map(f => f.name));
    
    // Map each source field to target field
    for (const sourceField of sourceDescribe.fields) {
      // Skip system fields
      if (this.isSystemField(sourceField.name)) {
        continue;
      }
      
      // Try exact match first
      if (targetFieldNames.has(sourceField.name)) {
        fieldMap.set(sourceField.name, sourceField.name);
        continue;
      }
      
      // Try managed to unmanaged mapping
      const unmanagedFieldName = this.getUnmanagedFieldName(sourceField.name);
      if (unmanagedFieldName !== sourceField.name && targetFieldNames.has(unmanagedFieldName)) {
        fieldMap.set(sourceField.name, unmanagedFieldName);
        continue;
      }
      
      // Try unmanaged to managed mapping
      const managedFieldName = this.getManagedFieldName(sourceField.name);
      if (managedFieldName && targetFieldNames.has(managedFieldName)) {
        fieldMap.set(sourceField.name, managedFieldName);
        continue;
      }
    }
    
    return fieldMap;
  }
  
  /**
   * Map source record fields to target record format
   */
  private static async mapFields(sourceRecord: any, fieldMap: Map<string, string>, targetClient: Connection): Promise<any> {
    const targetRecord: any = {};
    
    for (const [sourceField, targetField] of fieldMap) {
      const value = sourceRecord[sourceField];
      
      // Skip null/undefined values
      if (value === null || value === undefined) {
        continue;
      }
      
      // Skip relationship fields (they end with __r)
      if (sourceField.endsWith('__r')) {
        continue;
      }
      
      // Handle lookup fields - they need special treatment
      if (sourceField.endsWith('__c') && typeof value === 'string' && value.startsWith('a')) {
        // This is likely a custom object reference
        // For now, we'll skip it as it would need to be mapped to the target org's ID
        // In a full implementation, we'd need to look up the target record by external ID
        continue;
      }
      
      targetRecord[targetField] = value;
    }
    
    return targetRecord;
  }
  
  /**
   * Check if field is a system field that should not be copied
   */
  private static isSystemField(fieldName: string): boolean {
    const systemFields = [
      'Id', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById',
      'SystemModstamp', 'IsDeleted', 'LastActivityDate', 'LastViewedDate',
      'LastReferencedDate', 'OwnerId', 'RecordTypeId'
    ];
    
    return systemFields.includes(fieldName);
  }
  
  /**
   * Get managed package field name from unmanaged field name
   */
  private static getManagedFieldName(fieldName: string): string | null {
    // Handle standard fields
    if (!fieldName.includes('__')) {
      return null;
    }
    
    // If it already has a namespace prefix, return as is
    const prefixMatch = fieldName.match(/^([a-zA-Z0-9]+)__/);
    if (prefixMatch) {
      return fieldName;
    }
    
    // Add appropriate tc9 prefix for managed fields
    if (fieldName.endsWith('__c')) {
      // Common field patterns that need specific prefixes
      if (fieldName === 'External_ID_Data_Creation__c') {
        return 'tc9_edc__External_ID_Data_Creation__c';
      }
      
      // For most custom fields on pay codes and leave rules, use tc9_pr prefix
      return `tc9_pr__${fieldName}`;
    }
    
    return null;
  }
  
  /**
   * Get unmanaged field name from managed field name
   */
  private static getUnmanagedFieldName(fieldName: string): string {
    // Remove namespace prefix if present
    const prefixMatch = fieldName.match(/^[a-zA-Z0-9]+__(.+)$/);
    if (prefixMatch) {
      return prefixMatch[1];
    }
    return fieldName;
  }
}