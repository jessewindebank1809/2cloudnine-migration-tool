import * as jsforce from 'jsforce';
import type { SalesforceOrg } from '@/types';

export class SalesforceClient {
  private connection: jsforce.Connection;

  constructor(org: SalesforceOrg, orgType: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION') {
    // Select credentials based on org type
    const clientId = orgType === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID!
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID!;
    
    const clientSecret = orgType === 'PRODUCTION'
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET!
      : process.env.SALESFORCE_SANDBOX_CLIENT_SECRET!;

    this.connection = new jsforce.Connection({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      refreshToken: org.refreshToken,
      version: '63.0',
      oauth2: {
        clientId,
        clientSecret,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce-org`,
      }
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const userInfo = await this.connection.identity();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getObjectMetadata(objectName: string) {
    try {
      const describe = await this.connection.sobject(objectName).describe();
      return {
        success: true,
        data: {
          name: describe.name,
          label: describe.label,
          apiName: describe.name,
          isCustom: describe.custom,
          fields: describe.fields.map((field: any) => ({
            name: field.name,
            label: field.label,
            type: field.type,
            isRequired: !field.nillable && !field.defaultedOnCreate,
            isUnique: field.unique,
            isAutoNumber: field.autoNumber,
            length: field.length,
            referenceTo: field.referenceTo,
          })),
          relationships: describe.childRelationships.map((rel: any) => ({
            name: rel.field,
            relationshipName: rel.relationshipName,
            referenceTo: rel.childSObject,
            type: 'lookup' as const,
          })),
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get object metadata'
      };
    }
  }

  async query(soql: string) {
    try {
      const result = await this.connection.query(soql);
      return {
        success: true,
        data: result.records,
        totalSize: result.totalSize
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }

  async bulkInsert(objectName: string, records: any[]) {
    try {
      const result = await this.connection.bulk.load(objectName, 'insert', records);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk insert failed'
      };
    }
  }

  async bulkUpdate(objectName: string, records: any[]) {
    try {
      const result = await this.connection.bulk.load(objectName, 'update', records);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk update failed'
      };
    }
  }

  async getLimits() {
    try {
      const limits = await this.connection.request('/services/data/v63.0/limits') as any;
      return {
        success: true,
        data: {
          dailyApiCalls: limits.DailyApiRequests?.Max || 0,
          remainingApiCalls: limits.DailyApiRequests?.Remaining || 0,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get limits'
      };
    }
  }
} 