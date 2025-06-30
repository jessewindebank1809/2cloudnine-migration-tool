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
          error: `Source record ${sourceRecordId} not found in ${objectApiName}. Tried external ID fields: ${ExternalIdUtils.getAllPossibleExternalIdFields().join(', ')}`
        };
      }
      
      // Get the external ID value from source record
      // For cloning, we should use the source's external ID, not its Salesforce ID
      const sourceExternalIdValue = sourceRecord[sourceExternalIdField];
      
      if (!sourceExternalIdValue) {
        return {
          success: false,
          error: `Source record ${sourceRecordId} does not have an external ID (${sourceExternalIdField})`
        };
      }
      
      // Check if record already exists in target using the source's external ID
      const existingRecord = await this.checkExistingRecord(targetClient, objectApiName, sourceExternalIdValue, targetExternalIdField);
      
      if (existingRecord) {
        console.log(`Record with external ID ${sourceExternalIdValue} already exists in target org:`, existingRecord.Id);
        return {
          success: true,
          recordId: existingRecord.Id,
          externalId: sourceExternalIdValue,
          error: `Record already exists in target org (ID: ${existingRecord.Id})`
        };
      }
      
      // Get field metadata for mapping
      const fieldMap = await this.getFieldMapping(sourceClient, targetClient, objectApiName);
      
      console.log(`Field mapping for ${objectApiName}:`, {
        mappedFieldsCount: fieldMap.size,
        sourceFieldsCount: Object.keys(sourceRecord).length,
        mappedFields: Array.from(fieldMap.entries()).slice(0, 10) // Show first 10 mappings
      });
      
      // Log source record for Leave Rules
      if (objectApiName === 'tc9_pr__Leave_Rule__c') {
        console.log('Leave Rule source record fields:', Object.keys(sourceRecord));
        console.log('Leave Rule source values:', {
          Name: sourceRecord.Name,
          Effective_Date: sourceRecord.tc9_pr__Effective_Date__c || sourceRecord.Effective_Date__c,
          Status: sourceRecord.tc9_pr__Status__c || sourceRecord.Status__c,
          Pay_Code: sourceRecord.tc9_pr__Pay_Code__c || sourceRecord.Pay_Code__c,
          Unpaid_Pay_Code: sourceRecord.tc9_pr__Unpaid_Pay_Code__c || sourceRecord.Unpaid_Pay_Code__c
        });
        
        // Log relationship fields
        const relationshipFields = Object.keys(sourceRecord).filter(key => key.endsWith('__r'));
        if (relationshipFields.length > 0) {
          console.log('Leave Rule relationship fields:');
          relationshipFields.forEach(field => {
            console.log(`  ${field}:`, sourceRecord[field]);
          });
        }
      }
      
      // Map fields from source to target
      const targetRecord = await this.mapFields(sourceRecord, fieldMap, targetClient, sourceClient, objectApiName);
      
      // Log the source record fields for debugging
      console.log(`Source record fields: ${Object.keys(sourceRecord).join(', ')}`);
      console.log(`Target record fields BEFORE external ID: ${Object.keys(targetRecord).join(', ')}`);
      console.log(`Mapped ${Object.keys(targetRecord).length} fields to target record`);
      
      // Log relationship fields specifically
      const relationshipFields = Object.keys(targetRecord).filter(key => key.endsWith('__r'));
      if (relationshipFields.length > 0) {
        console.log('Relationship fields in target record:', relationshipFields);
        relationshipFields.forEach(field => {
          console.log(`  ${field}:`, targetRecord[field]);
        });
      }
      
      // Ensure external ID is set in target record with the source record's external ID value
      targetRecord[targetExternalIdField] = sourceExternalIdValue;
      
      console.log('Clone operation details:', {
        sourceRecordId,
        sourceExternalIdField,
        sourceExternalIdValue,
        targetExternalIdField,
        targetExternalIdValue: targetRecord[targetExternalIdField],
        targetRecordFields: Object.keys(targetRecord),
        targetRecordFieldCount: Object.keys(targetRecord).length
      });
      
      // Log the actual values being sent for Leave Rules
      if (objectApiName === 'tc9_pr__Leave_Rule__c') {
        console.log('Leave Rule target record:', JSON.stringify(targetRecord, null, 2));
        console.log('Required fields check:', {
          Name: targetRecord.Name || targetRecord.tc9_pr__Name__c || 'MISSING',
          Effective_Date: targetRecord.tc9_pr__Effective_Date__c || targetRecord.Effective_Date__c || 'MISSING',
          Status: targetRecord.tc9_pr__Status__c || targetRecord.Status__c || 'MISSING',
          Pay_Code: targetRecord.tc9_pr__Pay_Code__c || targetRecord.Pay_Code__c || targetRecord.tc9_pr__Pay_Code__r || targetRecord.Pay_Code__r || 'MISSING',
          Unpaid_Pay_Code: targetRecord.tc9_pr__Unpaid_Pay_Code__c || targetRecord.Unpaid_Pay_Code__c || targetRecord.tc9_pr__Unpaid_Pay_Code__r || targetRecord.Unpaid_Pay_Code__r || 'MISSING',
          Available_Pay_Rates: targetRecord.tc9_pr__Available_Pay_Rates__c || targetRecord.Available_Pay_Rates__c || 'MISSING',
          Allow_Pay_in_Advance: targetRecord.tc9_pr__Allow_Pay_in_Advance__c || targetRecord.Allow_Pay_in_Advance__c || 'MISSING',
          Skip_Manager_Approval: targetRecord.tc9_pr__Skip_Manager_Approval__c || targetRecord.Skip_Manager_Approval__c || 'MISSING'
        });
      }
      
      // Create record in target org
      const createResult = await targetClient.create(objectApiName, targetRecord);
      
      if (createResult.success) {
        return {
          success: true,
          recordId: createResult.data?.id,
          externalId: sourceExternalIdValue
        };
      } else {
        // Extract detailed error message from the create result
        let errorMessage = 'Failed to create record in target org';
        if (createResult.error) {
          errorMessage = createResult.error;
        } else if (createResult.data && typeof createResult.data === 'object') {
          // Check for Salesforce error structure
          const errorData = createResult.data as any;
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            errorMessage = errorData.errors.map((e: any) => e.message || e.statusCode).join(', ');
          }
          
          // Check for specific error types
          if (errorMessage.includes('duplicate value found') && errorMessage.includes(targetExternalIdField)) {
            // Extract the existing record ID from the error message
            const existingIdMatch = errorMessage.match(/record with id: ([a-zA-Z0-9]{15,18})/i);
            const existingId = existingIdMatch ? existingIdMatch[1] : 'unknown';
            errorMessage = `A record with external ID '${sourceExternalIdValue}' already exists in the target org (ID: ${existingId}). This record may have been previously migrated.`;
          } else if (errorMessage.includes('insufficient access rights on cross-reference id')) {
            // Extract the referenced ID
            const refIdMatch = errorMessage.match(/cross-reference id: ([a-zA-Z0-9]{15,18})/i);
            const refId = refIdMatch ? refIdMatch[1] : 'unknown';
            errorMessage = `Cannot clone this record because it references another record (ID: ${refId}) that doesn't exist or isn't accessible in the target org. You may need to clone the referenced records first.`;
          } else if (errorMessage.includes('ERROR :') && errorMessage.includes('fields must be populated')) {
            // Required fields error
            errorMessage = `Required fields are missing or have invalid values. ${errorMessage}`;
          }
        }
        
        console.error('Create record failed:', { 
          objectApiName, 
          targetExternalIdField, 
          externalIdValue: targetRecord[targetExternalIdField],
          error: errorMessage,
          createResult 
        });
        
        return {
          success: false,
          error: errorMessage
        };
      }
      
    } catch (error) {
      console.error('Error cloning record:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        const err = error as any;
        if (err.message) {
          errorMessage = err.message;
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.errorCode) {
          errorMessage = `${err.errorCode}: ${err.message || 'Unknown error'}`;
        }
      }
      
      // Check for cross-reference errors
      if (errorMessage.includes('insufficient access rights on cross-reference id')) {
        const refIdMatch = errorMessage.match(/cross-reference id: ([a-zA-Z0-9]{15,18})/i);
        const refId = refIdMatch ? refIdMatch[1] : 'unknown';
        errorMessage = `Cannot clone: References missing record (${refId}). Clone referenced records first.`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Fetch source record with all fields
   */
  private static async fetchSourceRecord(client: SalesforceClient, objectApiName: string, recordId: string, externalIdField: string): Promise<any> {
    console.log(`Fetching source record for ${objectApiName} with ID/ExternalID: ${recordId}, using external ID field: ${externalIdField}`);
    
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
        // Exclude non-queryable fields, but always include external ID fields
        const isExternalIdField = field.name === 'tc9_edc__External_ID_Data_Creation__c' || 
                                 field.name === 'External_ID_Data_Creation__c' || 
                                 field.name === 'External_Id__c';
        if (!field.createable && !field.updateable && field.name !== 'Id' && field.name !== 'Name' && !field.name.includes('__c') && !isExternalIdField) {
          return false;
        }
        // Exclude relationship fields that end with __r
        if (field.name.endsWith('__r')) {
          return false;
        }
        return true;
      })
      .map((f: any) => f.name);
    
    // For Leave Rules, we need to include relationship fields to get external IDs
    const relationshipFields: string[] = [];
    if (objectApiName === 'tc9_pr__Leave_Rule__c' || objectApiName === 'Leave_Rule__c') {
      // Detect the external ID field for Pay Code object
      let payCodeExternalIdField = 'tc9_edc__External_ID_Data_Creation__c';
      try {
        payCodeExternalIdField = await ExternalIdUtils.detectExternalIdField('tc9_pr__Pay_Code__c', client);
        console.log(`Detected Pay Code external ID field: ${payCodeExternalIdField}`);
      } catch (err) {
        console.log('Using default Pay Code external ID field:', payCodeExternalIdField);
      }
      
      // Only add relationship fields that actually exist on the object
      // The relationship field names stay the same - only the external ID field name changes
      const existingPayCodeFields = [];
      
      // Check each potential Pay Code relationship field
      const potentialFields = [
        'tc9_pr__Pay_Code__c', 
        'tc9_pr__Unpaid_Pay_Code__c',
        'tc9_pr__Accrual_Reduction_Pay_Code__c',
        'tc9_pr__Cash_Out_Pay_Code__c',
        'tc9_pr__Exit_Pay_Code__c',
        'tc9_pr__Loading_Pay_Code__c'
      ];
      
      for (const field of potentialFields) {
        if (queryableFields.includes(field)) {
          const relField = field.replace('__c', '__r');
          existingPayCodeFields.push(relField);
          console.log(`Found Pay Code field: ${field} -> relationship: ${relField}`);
        }
      }
      
      console.log(`Adding relationship queries for ${existingPayCodeFields.length} Pay Code fields`);
      
      for (const relField of existingPayCodeFields) {
        // Only include the detected external ID field
        relationshipFields.push(`${relField}.${payCodeExternalIdField}`);
        relationshipFields.push(`${relField}.Name`);
      }
    }
    
    // Ensure we always include essential fields
    const essentialFields = new Set(['Id', 'Name']);
    if (externalIdField && !queryableFields.includes(externalIdField)) {
      queryableFields.push(externalIdField);
    }
    
    // Remove duplicates and ensure essential fields are included
    const fieldsToQuery = Array.from(new Set([...queryableFields]));
    
    // Add relationship fields to the query
    const allFieldsToQuery = [...fieldsToQuery, ...relationshipFields];
    
    // console.log(`Fetching ${allFieldsToQuery.length} fields for ${objectApiName}`);
    
    // Build query - check if recordId is actually an external ID or a Salesforce ID
    let query: string;
    let queryResult = null;
    let result = null;
    
    // Salesforce IDs start with object key prefix (3 chars) followed by 12 or 15 more alphanumeric chars
    // Common prefixes: a0Q, a5Y, 001, 003, etc. They never start with lowercase letters like 'pc'
    const salesforceIdPattern = /^[a-zA-Z0-9]{3}[A-Z0-9]{12}$|^[a-zA-Z0-9]{3}[A-Z0-9]{12}[a-zA-Z0-9]{3}$/;
    
    if (salesforceIdPattern.test(recordId) && !recordId.startsWith('pc')) {
      // This looks like a Salesforce ID (15 or 18 characters with proper format)
      query = `SELECT ${allFieldsToQuery.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
      console.log(`Querying with Salesforce ID`);
      
      try {
        queryResult = await client.query(query);
        if (!queryResult.success) {
          throw new Error(`Failed to query: ${queryResult.error}`);
        }
        result = { records: queryResult.data };
      } catch (error: any) {
        // If the query fails due to invalid relationship fields, try without them
        if (error.message && error.message.includes('No such column')) {
          console.warn('Query failed with relationship fields, retrying without them');
          const basicQuery = `SELECT ${fieldsToQuery.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
          queryResult = await client.query(basicQuery);
          if (!queryResult.success) {
            throw new Error(`Failed to query: ${queryResult.error}`);
          }
          result = { records: queryResult.data };
        } else {
          throw error;
        }
      }
    } else {
      // This is likely an external ID - we need to try multiple possible external ID fields
      console.log(`Record ID "${recordId}" appears to be an external ID, trying multiple field options`);
      
      // Get all possible external ID fields
      const possibleExternalIdFields = ExternalIdUtils.getAllPossibleExternalIdFields();
      console.log(`Possible external ID fields to try: ${possibleExternalIdFields.join(', ')}`);
      console.log(`Total queryable fields found: ${queryableFields.length}`);
      
      // Check which external ID fields exist in queryable fields
      const availableExternalIdFields = possibleExternalIdFields.filter(field => queryableFields.includes(field));
      console.log(`Available external ID fields on ${objectApiName}: ${availableExternalIdFields.join(', ') || 'NONE'}`);
      
      // Try each possible external ID field
      for (const tryExternalIdField of possibleExternalIdFields) {
        // Check if this field exists in the queryable fields
        if (!queryableFields.includes(tryExternalIdField)) {
          console.log(`Skipping ${tryExternalIdField} - field not found on object`);
          continue;
        }
        
        // Escape single quotes in recordId to prevent SOQL injection
        const escapedRecordId = recordId.replace(/'/g, "\\'");
        query = `SELECT ${allFieldsToQuery.join(', ')} FROM ${objectApiName} WHERE ${tryExternalIdField} = '${escapedRecordId}' LIMIT 1`;
        console.log(`Trying query with external ID field: ${tryExternalIdField}`);
        console.log(`Full query: ${query}`);
        
        try {
          queryResult = await client.query(query);
          if (queryResult.success && queryResult.data && queryResult.data.length > 0) {
            console.log(`Found record using external ID field: ${tryExternalIdField}`);
            result = { records: queryResult.data };
            break;
          }
        } catch (error: any) {
          // If the query fails due to invalid relationship fields, try without them
          if (error.message && error.message.includes('No such column')) {
            console.warn('Query failed with relationship fields, retrying without them');
            const basicQuery = `SELECT ${fieldsToQuery.join(', ')} FROM ${objectApiName} WHERE ${tryExternalIdField} = '${escapedRecordId}' LIMIT 1`;
            
            try {
              queryResult = await client.query(basicQuery);
              if (queryResult.success && queryResult.data && queryResult.data.length > 0) {
                console.log(`Found record using external ID field (without relationships): ${tryExternalIdField}`);
                result = { records: queryResult.data };
                break;
              }
            } catch (basicError) {
              console.log(`Failed to query with ${tryExternalIdField}: ${basicError}`);
              
              // Try a minimal query to debug
              try {
                const debugQuery = `SELECT Id, ${tryExternalIdField} FROM ${objectApiName} WHERE ${tryExternalIdField} = '${escapedRecordId}' LIMIT 1`;
                console.log(`Trying minimal debug query: ${debugQuery}`);
                const debugResult = await client.query(debugQuery);
                if (debugResult.success) {
                  console.log(`Debug query result:`, debugResult.data);
                }
              } catch (debugError) {
                console.log(`Debug query also failed: ${debugError}`);
              }
            }
          } else {
            console.log(`Failed to query with ${tryExternalIdField}: ${error.message}`);
          }
        }
      }
      
      // If still no record found, try using the recordId as a Salesforce ID as last resort
      if (!result || !result.records || result.records.length === 0) {
        console.log(`No record found with any external ID field, trying with Id field as last resort`);
        query = `SELECT ${allFieldsToQuery.join(', ')} FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`;
        
        try {
          const fallbackQueryResult = await client.query(query);
          if (fallbackQueryResult.success && fallbackQueryResult.data && fallbackQueryResult.data.length > 0) {
            console.log(`Found record using Id field`);
            return fallbackQueryResult.data[0];
          }
        } catch (error) {
          console.log(`Failed to query with Id field: ${error}`);
        }
      }
    }
    
    return result?.records?.[0] || null;
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
      
      // Include reference fields but mark them for special handling
      // Only skip system reference fields that definitely won't map
      if (sourceField.type === 'reference' && 
          (sourceField.name === 'CreatedById' || 
           sourceField.name === 'LastModifiedById' || 
           sourceField.name === 'LastViewedById' ||
           sourceField.name === 'LastReferencedById')) {
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
  private static async mapFields(sourceRecord: any, fieldMap: Map<string, string>, targetClient: SalesforceClient, sourceClient?: SalesforceClient, objectApiName?: string): Promise<any> {
    const targetRecord: any = {};
    
    // Log the field map for Leave Rules
    if (objectApiName === 'tc9_pr__Leave_Rule__c') {
      console.log('Field mapping for Leave Rule:');
      fieldMap.forEach((targetField, sourceField) => {
        if (sourceField.includes('Pay_Code') || sourceField.includes('Unpaid')) {
          console.log(`  ${sourceField} -> ${targetField}`);
        }
      });
    }
    
    // First, process all fields from the source record
    for (const sourceField of Object.keys(sourceRecord)) {
      const value = sourceRecord[sourceField];
      
      // Skip null/undefined values for most fields, but keep false values
      if (value === null || value === undefined) {
        // For boolean fields, we might need to explicitly set false
        if (sourceField.includes('__c') && fieldMap.has(sourceField)) {
          const targetField = fieldMap.get(sourceField)!;
          // Set false for boolean fields that are null/undefined
          if (sourceField.includes('Allow_Pay_in_Advance') || 
              sourceField.includes('Skip_Manager_Approval')) {
            targetRecord[targetField] = false;
          }
        }
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
      
      // Check if we have a mapping for this field
      if (fieldMap.has(sourceField)) {
        const targetField = fieldMap.get(sourceField)!;
        
        // Check if this is a lookup field (contains an ID to another object)
        if (sourceField.endsWith('__c') && typeof value === 'string' && 
            value.match(/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/)) {
          
          // This is a lookup field - we need to use external ID instead
          console.log(`Detected lookup field ${sourceField} with value ${value}`);
          
          // For lookup fields to custom objects, we need to handle them specially
          const isPayCodeField = sourceField.includes('Pay_Code__c') || sourceField.includes('Unpaid_Pay_Code__c');
          const isLeaveRuleField = sourceField.includes('Leave_Rule__c');
          
          console.log(`Field check: ${sourceField} - isPayCodeField: ${isPayCodeField}, isLeaveRuleField: ${isLeaveRuleField}`);
          
          if ((isPayCodeField || isLeaveRuleField) && 
              sourceClient && !sourceField.includes('External_ID')) {
            
            // First, check if we have the external ID from a relationship field
            const relationshipFieldName = sourceField.replace('__c', '__r');
            let externalId = null;
            
            if (sourceRecord[relationshipFieldName]) {
              // Try to get external ID from relationship object
              const relatedRecord = sourceRecord[relationshipFieldName];
              
              // Try all possible external ID field names
              const possibleExternalIdFields = [
                'tc9_edc__External_ID_Data_Creation__c',
                'External_ID_Data_Creation__c',
                'tc9_pr__External_ID_Data_Creation__c',
                'External_Id__c'
              ];
              
              for (const extIdField of possibleExternalIdFields) {
                if (relatedRecord[extIdField]) {
                  externalId = relatedRecord[extIdField];
                  console.log(`Got external ID from relationship field ${relationshipFieldName}.${extIdField}: ${externalId}`);
                  break;
                }
              }
              
              if (!externalId) {
                console.log(`No external ID found in relationship ${relationshipFieldName}. Available fields:`, Object.keys(relatedRecord));
              }
            }
            
            // If we didn't get external ID from relationship, query for it
            if (!externalId) {
              externalId = await this.getLookupExternalId(sourceClient, value, sourceField);
            }
            
            if (externalId) {
              // Create relationship object using external ID
              // For example: Pay_Code__r = { tc9_edc__External_ID_Data_Creation__c: '100106' }
              const targetRelationshipField = targetField.replace('__c', '__r');
              
              // Determine the external ID field name in the target org
              let targetExternalIdField = 'tc9_edc__External_ID_Data_Creation__c';
              try {
                // Detect the external ID field for Pay Code in the target org
                const payCodeObjectName = isPayCodeField ? 'tc9_pr__Pay_Code__c' : 'tc9_pr__Leave_Rule__c';
                targetExternalIdField = await ExternalIdUtils.detectExternalIdField(payCodeObjectName, targetClient as any);
                console.log(`Detected target external ID field for ${payCodeObjectName}: ${targetExternalIdField}`);
              } catch (err) {
                console.log(`Using default target external ID field: ${targetExternalIdField}`);
              }
              
              targetRecord[targetRelationshipField] = {
                [targetExternalIdField]: externalId
              };
              
              console.log(`Using external ID reference for ${sourceField}: ${targetRelationshipField}.${targetExternalIdField} = ${externalId}`);
              console.log(`Added to targetRecord: ${targetRelationshipField} =`, targetRecord[targetRelationshipField]);
            } else {
              console.warn(`Could not get external ID for lookup ${sourceField}, value was: ${value}`);
            }
          } else if (!sourceField.includes('Pay_Code') && !sourceField.includes('Leave_Rule')) {
            // Other lookup fields (like OwnerId), copy as-is
            targetRecord[targetField] = value;
          }
        } else {
          // Not a lookup field, copy as-is
          targetRecord[targetField] = value;
        }
      } else {
        // Log unmapped fields for debugging
        if (sourceField.endsWith('__c') && value !== null) {
          console.log(`Field not mapped: ${sourceField} = ${value}`);
        }
      }
    }
    
    // Post-process for Leave Rules to ensure required fields
    if (objectApiName === 'tc9_pr__Leave_Rule__c') {
      // Ensure boolean fields have values
      if (!('tc9_pr__Allow_Pay_in_Advance__c' in targetRecord) && !('Allow_Pay_in_Advance__c' in targetRecord)) {
        targetRecord['tc9_pr__Allow_Pay_in_Advance__c'] = false;
      }
      if (!('tc9_pr__Skip_Manager_Approval__c' in targetRecord) && !('Skip_Manager_Approval__c' in targetRecord)) {
        targetRecord['tc9_pr__Skip_Manager_Approval__c'] = false;
      }
      
      // If Available_Pay_Rates__c is missing, set a default
      if (!('tc9_pr__Available_Pay_Rates__c' in targetRecord) && !('Available_Pay_Rates__c' in targetRecord)) {
        targetRecord['tc9_pr__Available_Pay_Rates__c'] = 'Standard';
      }
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
      
      // Common Leave Rule fields - ensure both directions are mapped
      const leaveRuleFieldMappings: Record<string, string> = {
        // Unmanaged to managed
        'Effective_Date__c': 'tc9_pr__Effective_Date__c',
        'Status__c': 'tc9_pr__Status__c',
        'Pay_Code__c': 'tc9_pr__Pay_Code__c',
        'Unpaid_Pay_Code__c': 'tc9_pr__Unpaid_Pay_Code__c',
        'Available_Pay_Rates__c': 'tc9_pr__Available_Pay_Rates__c',
        'Allow_Pay_in_Advance__c': 'tc9_pr__Allow_Pay_in_Advance__c',
        'Skip_Manager_Approval__c': 'tc9_pr__Skip_Manager_Approval__c',
        // Managed to managed (if source is already managed)
        'tc9_pr__Effective_Date__c': 'tc9_pr__Effective_Date__c',
        'tc9_pr__Status__c': 'tc9_pr__Status__c',
        'tc9_pr__Pay_Code__c': 'tc9_pr__Pay_Code__c',
        'tc9_pr__Unpaid_Pay_Code__c': 'tc9_pr__Unpaid_Pay_Code__c',
        'tc9_pr__Available_Pay_Rates__c': 'tc9_pr__Available_Pay_Rates__c',
        'tc9_pr__Allow_Pay_in_Advance__c': 'tc9_pr__Allow_Pay_in_Advance__c',
        'tc9_pr__Skip_Manager_Approval__c': 'tc9_pr__Skip_Manager_Approval__c'
      };
      
      if (leaveRuleFieldMappings[fieldName]) {
        return leaveRuleFieldMappings[fieldName];
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
  
  /**
   * Get external ID value for a lookup field
   */
  private static async getLookupExternalId(
    sourceClient: SalesforceClient,
    sourceId: string,
    lookupFieldName: string
  ): Promise<string | null> {
    try {
      // Determine the object type from the field name
      let objectApiNames = [];
      let externalIdFieldName = '';
      
      if (lookupFieldName.includes('Pay_Code')) {
        // Try both managed and unmanaged object names
        objectApiNames = ['tc9_pr__Pay_Code__c', 'Pay_Code__c'];
        // External ID field could be managed or unmanaged
        externalIdFieldName = 'tc9_edc__External_ID_Data_Creation__c,External_ID_Data_Creation__c';
      } else if (lookupFieldName.includes('Leave_Rule')) {
        objectApiNames = ['tc9_pr__Leave_Rule__c', 'Leave_Rule__c'];
        externalIdFieldName = 'tc9_edc__External_ID_Data_Creation__c,External_ID_Data_Creation__c';
      } else {
        console.log(`Unknown lookup type: ${lookupFieldName}`);
        return null; // Return null if we can't determine the type
      }
      
      // Try each possible object name
      let sourceResult = null;
      let successfulObjectName = null;
      
      for (const objectApiName of objectApiNames) {
        try {
          // First, detect the actual external ID field for this object
          let detectedExternalIdField;
          try {
            detectedExternalIdField = await ExternalIdUtils.detectExternalIdField(objectApiName, sourceClient as any);
            console.log(`Detected external ID field for ${objectApiName}: ${detectedExternalIdField}`);
          } catch (detectErr) {
            console.log(`Could not detect external ID field for ${objectApiName}, trying default fields`);
            // Continue with the default fields
          }
          
          // Use detected field if available, otherwise use the default list
          const fieldsToQuery = detectedExternalIdField 
            ? detectedExternalIdField 
            : externalIdFieldName.split(',').join(', ');
          
          const sourceQuery = `SELECT Id, Name, ${fieldsToQuery} FROM ${objectApiName} WHERE Id = '${sourceId}' LIMIT 1`;
          console.log(`Trying query: ${sourceQuery}`);
          
          const queryResult = await sourceClient.query(sourceQuery);
          if (queryResult.success && queryResult.data && queryResult.data.length > 0) {
            sourceResult = queryResult;
            successfulObjectName = objectApiName;
            console.log(`Found record in ${objectApiName}`);
            break;
          }
        } catch (err: any) {
          console.log(`Failed to query ${objectApiName}: ${err.message}`);
          continue;
        }
      }
      
      if (!sourceResult || !sourceResult.data || sourceResult.data.length === 0) {
        console.warn(`Could not find source record ${sourceId} in any of: ${objectApiNames.join(', ')}`);
        return null;
      }
      
      // Get the external ID value (check all possible field names)
      const record = sourceResult.data[0];
      
      // Try all possible external ID fields
      const possibleFields = [
        'tc9_edc__External_ID_Data_Creation__c',
        'External_ID_Data_Creation__c', 
        'tc9_pr__External_ID_Data_Creation__c',
        'External_Id__c'
      ];
      
      let externalId = null;
      for (const field of possibleFields) {
        if (record[field]) {
          externalId = record[field];
          console.log(`Found external ID in field ${field}: ${externalId}`);
          break;
        }
      }
      
      if (!externalId) {
        console.warn(`Source record ${sourceId} has no external ID in object ${successfulObjectName}`);
        console.log('Record fields:', Object.keys(record));
        console.log('Record data:', record);
        return null;
      }
      
      console.log(`Found external ID for ${lookupFieldName}: ${sourceId} -> ${externalId}`);
      return externalId;
      
    } catch (error) {
      console.error('Error getting lookup external ID:', error);
      return null;
    }
  }
}