import { sessionManager } from '@/lib/salesforce/session-manager';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
// import { Connection } from 'jsforce';
import { SalesforceClient } from '@/lib/salesforce/client';

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
      const sourceExternalIdField = await ExternalIdUtils.detectExternalIdField(objectApiName, sourceClient as any);
      const targetExternalIdField = await ExternalIdUtils.detectExternalIdField(objectApiName, targetClient as any);
      
      // console.log(`Source external ID field: ${sourceExternalIdField}, Target external ID field: ${targetExternalIdField}`);
      
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
      
      // Log the source record fields for debugging
      // console.log(`Source record fields: ${Object.keys(sourceRecord).join(', ')}`);
      // console.log(`Mapped ${Object.keys(targetRecord).length} fields to target record`);
      
      // Ensure external ID is set in target record with the source record's ID
      targetRecord[targetExternalIdField] = sourceRecord.Id;
      
      // console.log(`Creating record in target org with external ID: ${targetRecord[targetExternalIdField]}`);
      
      // Create record in target org
      const createResult = await targetClient.create(objectApiName, targetRecord);
      const result = createResult.success ? { success: true, id: createResult.data?.id } : { success: false };
      
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
  private static async fetchSourceRecord(client: SalesforceClient, objectApiName: string, recordId: string, externalIdField: string): Promise<any> {
    // Get all fields for the object
    const describeResult = await client.getObjectMetadata(objectApiName);
    if (!describeResult.success) {
      throw new Error(`Failed to describe object ${objectApiName}`);
    }
    const describe = describeResult.data;
    
    // Filter out compound fields and non-queryable fields
    const queryableFields = (describe?.fields || [])
      .filter((field: any) => {
        // Exclude compound fields (like Name for Person Accounts)
        if (field.type === 'address' || field.type === 'location') {
          return false;
        }
        // Exclude non-queryable fields
        if (!field.createable && !field.updateable && field.name !== 'Id' && field.name !== 'Name' && !field.name.includes('__c')) {
          return false;
        }
        // Exclude relationship fields that end with __r
        if (field.name.endsWith('__r')) {
          return false;
        }
        return true;
      })
      .map((f: any) => f.name);
    
    // Ensure we always include essential fields
    const essentialFields = new Set(['Id', 'Name']);
    if (externalIdField && !queryableFields.includes(externalIdField)) {
      queryableFields.push(externalIdField);
    }
    
    // Remove duplicates and ensure essential fields are included
    const fieldsToQuery = Array.from(new Set([...queryableFields]));
    
    // console.log(`Fetching ${fieldsToQuery.length} fields for ${objectApiName}`);
    
    // Build query - check if recordId is actually an external ID or a Salesforce ID
    let query: string;
    if (recordId.match(/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/)) {
      // This looks like a Salesforce ID (15 or 18 characters)
      query = `SELECT ${fieldsToQuery.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
    } else {
      // This is likely an external ID - try external ID field first
      query = `SELECT ${fieldsToQuery.join(', ')} FROM ${objectApiName} WHERE ${externalIdField} = '${recordId}' LIMIT 1`;
    }
    
    // console.log(`Fetching source record with query: ${query}`);
    const queryResult = await client.query(query);
    if (!queryResult.success) {
      throw new Error(`Failed to query: ${queryResult.error}`);
    }
    const result = { records: queryResult.data };
    
    // If no record found with external ID, try ID as fallback
    if (!result.records[0] && !recordId.match(/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/)) {
      console.log(`No record found with external ID, trying with Id field`);
      query = `SELECT ${fieldsToQuery.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
      const fallbackQueryResult = await client.query(query);
      if (!fallbackQueryResult.success) {
        return null;
      }
      return fallbackQueryResult.data?.[0];
    }
    
    return result.records[0];
  }
  
  /**
   * Check if record already exists in target org
   */
  private static async checkExistingRecord(client: SalesforceClient, objectApiName: string, externalIdValue: string, externalIdField: string): Promise<any> {
    if (!externalIdValue) return null;
    
    try {
      const query = `SELECT Id, ${externalIdField} FROM ${objectApiName} WHERE ${externalIdField} = '${externalIdValue}' LIMIT 1`;
      const queryResult = await client.query(query);
    if (!queryResult.success) {
      throw new Error(`Failed to query: ${queryResult.error}`);
    }
    const result = { records: queryResult.data };
      return result.records[0] || null;
    } catch (error) {
      console.log('Record does not exist in target org');
      return null;
    }
  }
  
  /**
   * Get field mapping between source and target orgs
   */
  private static async getFieldMapping(sourceClient: SalesforceClient, targetClient: SalesforceClient, objectApiName: string): Promise<Map<string, string>> {
    const fieldMap = new Map<string, string>();
    
    // Get field metadata from both orgs
    const [sourceDescribeResult, targetDescribeResult] = await Promise.all([
      sourceClient.getObjectMetadata(objectApiName),
      targetClient.getObjectMetadata(objectApiName)
    ]);
    
    if (!sourceDescribeResult.success || !targetDescribeResult.success) {
      throw new Error(`Failed to get field metadata for ${objectApiName}`);
    }
    
    const sourceDescribe = sourceDescribeResult.data;
    const targetDescribe = targetDescribeResult.data;
    
    const targetFieldNames = new Set((targetDescribe?.fields || []).map((f: any) => f.name));
    
    // Map each source field to target field
    for (const sourceField of (sourceDescribe?.fields || [])) {
      // Skip system fields
      if (this.isSystemField(sourceField.name)) {
        continue;
      }
      
      // Skip relationship fields
      if (sourceField.name.endsWith('__r')) {
        continue;
      }
      
      // Skip fields that are references/lookups (detected by type)
      if (sourceField.type === 'reference' && sourceField.name !== 'OwnerId' && sourceField.name !== 'RecordTypeId') {
        // Skip most reference fields except standard ones like OwnerId
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
  private static async mapFields(sourceRecord: any, fieldMap: Map<string, string>, targetClient: SalesforceClient): Promise<any> {
    const targetRecord: any = {};
    
    // First, process all fields from the source record
    for (const sourceField of Object.keys(sourceRecord)) {
      const value = sourceRecord[sourceField];
      
      // Skip null/undefined values
      if (value === null || value === undefined) {
        continue;
      }
      
      // Skip relationship fields (they end with __r)
      if (sourceField.endsWith('__r')) {
        continue;
      }
      
      // Skip system fields
      if (this.isSystemField(sourceField)) {
        continue;
      }
      
      // Handle lookup fields - they need special treatment
      if (sourceField.endsWith('__c') && typeof value === 'string' && value.match(/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/)) {
        // This is likely a custom object reference (Salesforce ID format)
        // Custom objects in Salesforce start with 'a' followed by alphanumeric characters
        if (value.toLowerCase().startsWith('a')) {
          // This is a custom object reference
          // Skip it as it would need to be mapped to the target org's ID
          continue;
        }
      }
      
      // Check if we have a mapping for this field
      if (fieldMap.has(sourceField)) {
        const targetField = fieldMap.get(sourceField)!;
        targetRecord[targetField] = value;
      }
      // If no mapping exists but the field name exists in the source, we've already skipped it in the field mapping
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
      'LastReferencedDate', 'OwnerId'
    ];
    
    // Note: RecordTypeId is removed from system fields as it might need to be copied
    // in some scenarios, but we'll handle it separately if needed
    
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
    const prefixMatch = fieldName.match(/^[a-zA-Z0-9]+_[a-zA-Z0-9]+__/);
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
    // Remove namespace prefix if present (e.g., tc9_pr__Field__c -> Field__c)
    const prefixMatch = fieldName.match(/^[a-zA-Z0-9]+_[a-zA-Z0-9]+__(.+)$/);
    if (prefixMatch) {
      return prefixMatch[1];
    }
    return fieldName;
  }
}