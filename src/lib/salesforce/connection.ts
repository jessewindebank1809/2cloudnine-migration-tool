import { SalesforceClient } from './client';
import type { SalesforceOrg } from '@/types';

export interface SalesforceConnection {
  query(soql: string): Promise<{ records: any[]; totalSize: number }>;
  create(objectType: string, records: any[]): Promise<any>;
  update(objectType: string, records: any[]): Promise<any>;
  upsert(objectType: string, records: any[], externalIdField: string): Promise<any>;
  testConnection(): Promise<{ success: boolean; error?: string }>;
}

export class SalesforceConnectionImpl implements SalesforceConnection {
  private client: SalesforceClient;

  constructor(org: SalesforceOrg, orgType: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION') {
    this.client = new SalesforceClient(org, orgType);
  }

  async query(soql: string): Promise<{ records: any[]; totalSize: number }> {
    const result = await this.client.query(soql);
    if (!result.success) {
      throw new Error(result.error || 'Query failed');
    }
    return {
      records: result.data || [],
      totalSize: result.totalSize || 0
    };
  }

  async create(objectType: string, records: any[]): Promise<any> {
    const result = await this.client.bulkInsert(objectType, records);
    if (!result.success) {
      throw new Error(result.error || 'Create operation failed');
    }
    return result.data;
  }

  async update(objectType: string, records: any[]): Promise<any> {
    const result = await this.client.bulkUpdate(objectType, records);
    if (!result.success) {
      throw new Error(result.error || 'Update operation failed');
    }
    return result.data;
  }

  async upsert(objectType: string, records: any[], externalIdField: string): Promise<any> {
    // For now, we'll implement upsert as a combination of update/insert
    // In a real implementation, you'd use the Salesforce upsert operation
    try {
      const result = await this.client.bulkUpdate(objectType, records);
      if (!result.success) {
        throw new Error(result.error || 'Upsert operation failed');
      }
      return result.data;
    } catch (error) {
      // If update fails, try insert
      const insertResult = await this.client.bulkInsert(objectType, records);
      if (!insertResult.success) {
        throw new Error(insertResult.error || 'Upsert operation failed');
      }
      return insertResult.data;
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return await this.client.testConnection();
  }
} 