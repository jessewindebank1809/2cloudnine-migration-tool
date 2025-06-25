import { SalesforceClient } from '@/lib/salesforce/client';
import type { SalesforceOrg } from '@/types';

export interface RollbackRecord {
  targetRecordId: string;
  objectType: string;
  stepName: string;
}

export interface RollbackResult {
  success: boolean;
  deletedRecords: number;
  failedDeletions: number;
  errors: Array<{
    recordId: string;
    error: string;
  }>;
}

export class RollbackService {
  private targetClient: SalesforceClient;

  private constructor(targetClient: SalesforceClient) {
    this.targetClient = targetClient;
  }

  static async create(targetOrg: SalesforceOrg): Promise<RollbackService> {
    const targetClient = await SalesforceClient.create(targetOrg);
    return new RollbackService(targetClient);
  }

  /**
   * Rollback successfully inserted records by deleting them from the target org
   */
  async rollbackRecords(records: RollbackRecord[]): Promise<RollbackResult> {
    if (records.length === 0) {
      console.log('No records to rollback - empty records array');
      return {
        success: true,
        deletedRecords: 0,
        failedDeletions: 0,
        errors: []
      };
    }

    console.log(`Starting rollback of ${records.length} records...`);
    console.log('Records to rollback:', JSON.stringify(records, null, 2));

    // Group records by object type for efficient deletion
    const recordsByObjectType = this.groupRecordsByObjectType(records);
    
    let totalDeleted = 0;
    let totalFailed = 0;
    const allErrors: Array<{ recordId: string; error: string }> = [];

    // Delete records for each object type
    for (const [objectType, objectRecords] of Array.from(recordsByObjectType.entries())) {
      const result = await this.deleteRecordsForObjectType(objectType, objectRecords);
      totalDeleted += result.deletedRecords;
      totalFailed += result.failedDeletions;
      allErrors.push(...result.errors);
    }

    const success = totalFailed === 0;
    
    console.log(`Rollback completed: ${totalDeleted} deleted, ${totalFailed} failed`);

    return {
      success,
      deletedRecords: totalDeleted,
      failedDeletions: totalFailed,
      errors: allErrors
    };
  }

  /**
   * Group records by object type for efficient batch deletion
   */
  private groupRecordsByObjectType(records: RollbackRecord[]): Map<string, RollbackRecord[]> {
    const grouped = new Map<string, RollbackRecord[]>();
    
    for (const record of records) {
      if (!grouped.has(record.objectType)) {
        grouped.set(record.objectType, []);
      }
      grouped.get(record.objectType)!.push(record);
    }
    
    return grouped;
  }

  /**
   * Delete records for a specific object type
   */
  private async deleteRecordsForObjectType(
    objectType: string, 
    records: RollbackRecord[]
  ): Promise<RollbackResult> {
    const recordIds = records.map(r => r.targetRecordId);
    
    try {
      console.log(`Deleting ${recordIds.length} ${objectType} records...`);
      
      // Use bulk delete for efficiency
      const result = await this.targetClient.bulkDelete(objectType, recordIds);
      
      if (!result.success) {
        console.error(`Bulk delete failed for ${objectType}:`, result.error);
        return {
          success: false,
          deletedRecords: 0,
          failedDeletions: recordIds.length,
          errors: recordIds.map(id => ({
            recordId: id,
            error: result.error || 'Bulk delete failed'
          }))
        };
      }

      // Process individual results
      const bulkResults = Array.isArray(result.data) ? result.data : [result.data];
      let deletedCount = 0;
      let failedCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      bulkResults.forEach((deleteResult: any, index: number) => {
        if (deleteResult.success) {
          deletedCount++;
        } else {
          failedCount++;
          const recordId = recordIds[index];
          const errorMessages = Array.isArray(deleteResult.errors) 
            ? deleteResult.errors.map((e: any) => e.message || e.toString()).join('; ')
            : deleteResult.errors?.message || 'Unknown deletion error';
          
          errors.push({
            recordId,
            error: errorMessages
          });
        }
      });

      console.log(`${objectType} deletion result: ${deletedCount} deleted, ${failedCount} failed`);

      return {
        success: failedCount === 0,
        deletedRecords: deletedCount,
        failedDeletions: failedCount,
        errors
      };

    } catch (error) {
      console.error(`Error deleting ${objectType} records:`, error);
      
      return {
        success: false,
        deletedRecords: 0,
        failedDeletions: recordIds.length,
        errors: recordIds.map(id => ({
          recordId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      };
    }
  }
} 