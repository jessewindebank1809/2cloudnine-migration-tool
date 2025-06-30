import { sessionManager } from '@/lib/salesforce/session-manager';

export interface RecordValidationResult {
  valid: boolean;
  errors: string[];
  invalidRecords: string[];
  validRecords: string[];
}

/**
 * Validates that selected record IDs exist and belong to the expected object type
 */
export async function validateSelectedRecords(
  orgId: string,
  recordIds: string[],
  expectedObject: string
): Promise<RecordValidationResult> {
  if (!recordIds || recordIds.length === 0) {
    return {
      valid: true,
      errors: [],
      invalidRecords: [],
      validRecords: []
    };
  }

  try {
    // Query to verify records exist and match expected object type
    const query = `
      SELECT Id, Name 
      FROM ${expectedObject} 
      WHERE Id IN (${recordIds.map(id => `'${id}'`).join(',')})
    `;
    
    const client = await sessionManager.getClient(orgId);
    const results = await client.query(query);
    
    if (!results.success || !results.data) {
      throw new Error('Failed to query records from source org');
    }
    
    const foundIds = results.data.records.map((r: any) => r.Id);
    const invalidIds = recordIds.filter(id => !foundIds.includes(id));
    
    // Format the object name for display
    const objectDisplayName = expectedObject
      .replace(/__c$/, '')
      .replace(/tc9_[a-z]+__/, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return {
      valid: invalidIds.length === 0,
      errors: invalidIds.map(id => 
        `Selected ID '${id}' is not a valid ${objectDisplayName} record in the source org`
      ),
      invalidRecords: invalidIds,
      validRecords: foundIds
    };
  } catch (error) {
    console.error('Error validating selected records:', error);
    return {
      valid: false,
      errors: [`Failed to validate selected records: ${error instanceof Error ? error.message : 'Unknown error'}`],
      invalidRecords: recordIds,
      validRecords: []
    };
  }
}