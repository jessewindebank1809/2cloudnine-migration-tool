import * as jsforce from 'jsforce';
import type { SalesforceOrg } from '@/types';
import { prisma } from '@/lib/database/prisma';
import { encrypt } from '@/lib/utils/encryption';
import { withTokenRefresh } from './token-refresh-helper';
import { TokenManager } from './token-manager';

export class SalesforceClient {
  private connection: jsforce.Connection;
  private orgId: string;

  /**
   * Create a SalesforceClient with automatically refreshed tokens
   */
  static async createWithValidTokens(orgId: string, orgType: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION'): Promise<SalesforceClient | null> {
    try {
      const tokenManager = TokenManager.getInstance();
      const validTokens = await tokenManager.getValidToken(orgId);
      
      if (!validTokens) {
        console.warn(`No valid tokens available for org ${orgId}`);
        return null;
      }

      // Get org details from database
      const org = await prisma.organisations.findUnique({
        where: { id: orgId }
      });

      if (!org) {
        console.error(`Org ${orgId} not found`);
        return null;
      }

      const salesforceOrg: SalesforceOrg = {
        id: org.id,
        organisationId: org.salesforce_org_id || '',
        organisationName: org.name,
        instanceUrl: org.instance_url,
        accessToken: validTokens.accessToken,
        refreshToken: validTokens.refreshToken
      };

      return new SalesforceClient(salesforceOrg, orgType);
    } catch (error) {
      console.error(`Error creating SalesforceClient for org ${orgId}:`, error);
      return null;
    }
  }

  constructor(org: SalesforceOrg, orgType: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION') {
    this.orgId = org.id;
    
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

    // Set up token refresh callback to update database
    this.connection.on('refresh', async (accessToken: string, res: any) => {
      console.log('Token refreshed for org:', this.orgId);
      try {
        await this.updateTokensInDatabase(accessToken, res.refresh_token);
      } catch (error) {
        console.error('Failed to update refreshed tokens in database:', error);
      }
    });
  }

  private async updateTokensInDatabase(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      const encryptedAccessToken = encrypt(accessToken);
      const updateData: any = {
        access_token_encrypted: encryptedAccessToken,
        token_expires_at: new Date(Date.now() + (2 * 60 * 60 * 1000)), // 2 hours from now
        updated_at: new Date(),
      };

      if (refreshToken) {
        updateData.refresh_token_encrypted = encrypt(refreshToken);
      }

      await prisma.organisations.update({
        where: { id: this.orgId },
        data: updateData,
      });

      console.log('Successfully updated tokens in database for org:', this.orgId);
    } catch (error) {
      console.error('Failed to update tokens in database:', error);
      throw error;
    }
  }

  get accessToken(): string | undefined {
    return this.connection.accessToken || undefined;
  }

  get refreshToken(): string | undefined {
    return this.connection.refreshToken || undefined;
  }

  async refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.connection.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      console.log('Attempting to refresh access token for org:', this.orgId);
      
      // Use jsforce's built-in refresh method
      const result = await this.connection.oauth2.refreshToken(this.connection.refreshToken);
      
      // Update the connection with new tokens
      this.connection.accessToken = result.access_token;
      if (result.refresh_token) {
        this.connection.refreshToken = result.refresh_token;
      }
      
      // Update database with new tokens
      await this.updateTokensInDatabase(result.access_token, result.refresh_token);
      
      console.log('Successfully refreshed access token for org:', this.orgId);
      return { success: true };
    } catch (error) {
      console.error('Token refresh failed for org:', this.orgId, error);
      
      // Check if refresh token itself is expired
      if (error instanceof Error && (
        error.message.includes('invalid_grant') ||
        error.message.includes('expired') ||
        error.message.includes('refresh token')
      )) {
        // Mark org as disconnected in database to prevent infinite retry loops
        try {
          await prisma.organisations.update({
            where: { id: this.orgId },
            data: {
              access_token_encrypted: null,
              refresh_token_encrypted: null,
              token_expires_at: null,
              salesforce_org_id: null,
              updated_at: new Date()
            }
          });
          console.log(`Marked org ${this.orgId} as disconnected due to expired refresh token`);
        } catch (dbError) {
          console.error('Failed to mark org as disconnected:', dbError);
        }
        
        return { 
          success: false, 
          error: 'Refresh token expired. Please reconnect the organisation.'
        };
      }
      
      return { 
        success: false, 
        error: 'Token refresh failed'
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const userInfo = await this.connection.identity();
      return { success: true };
    } catch (error) {
      // If we get an invalid_grant error, try to refresh the token
      if (error instanceof Error && error.message.includes('invalid_grant')) {
        console.log('Access token expired, attempting refresh for org:', this.orgId);
        const refreshResult = await this.refreshAccessToken();
        if (refreshResult.success) {
          // Try the connection test again after refresh
          try {
            const userInfo = await this.connection.identity();
            return { success: true };
          } catch (retryError) {
            return { 
              success: false, 
              error: retryError instanceof Error ? retryError.message : 'Connection failed after token refresh' 
            };
          }
        } else {
          return { 
            success: false, 
            error: `expired access/refresh token` 
          };
        }
      }
      
      // Check for other token-related errors
      if (error instanceof Error && (
        error.message.includes('INVALID_SESSION_ID') ||
        error.message.includes('Session expired') ||
        error.message.includes('expired') ||
        error.message.includes('invalid_grant')
      )) {
        return { 
          success: false, 
          error: 'expired access/refresh token' 
        };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getObjectMetadata(objectName: string) {
    try {
      const describe = await withTokenRefresh(
        this,
        async () => await this.connection.sobject(objectName).describe(),
        `object metadata for ${objectName}`
      );
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
            picklistValues: field.picklistValues || [],
            restrictedPicklist: field.restrictedPicklist || false,
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

  async getPicklistValues(objectName: string, fieldName: string) {
    try {
      const describe = await withTokenRefresh(
        this,
        async () => await this.connection.sobject(objectName).describe(),
        `picklist values for ${objectName}.${fieldName}`
      );
      
      const field = describe.fields.find((f: any) => f.name === fieldName);
      if (!field) {
        return {
          success: false,
          error: `Field ${fieldName} not found on object ${objectName}`
        };
      }

      if (field.type !== 'picklist' && field.type !== 'multipicklist') {
        return {
          success: false,
          error: `Field ${fieldName} is not a picklist field (type: ${field.type})`
        };
      }

      return {
        success: true,
        data: {
          fieldName,
          values: field.picklistValues || [],
          restricted: field.restrictedPicklist || false,
          defaultValue: field.defaultValue || undefined
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get picklist values'
      };
    }
  }

  async query(soql: string) {
    try {
      const result = await withTokenRefresh(
        this,
        async () => await this.connection.query(soql),
        'SOQL query'
      );
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
      console.log(`Starting bulk insert for ${objectName} with ${records.length} records`);
      const result = await withTokenRefresh(
        this,
        async () => await this.connection.bulk.load(objectName, 'insert', records),
        `bulk insert for ${objectName}`
      );
      console.log(`Bulk insert completed for ${objectName}:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Bulk insert failed for ${objectName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk insert failed'
      };
    }
  }

  async bulkUpdate(objectName: string, records: any[]) {
    try {
      console.log(`Starting bulk update for ${objectName} with ${records.length} records`);
      const result = await withTokenRefresh(
        this,
        async () => await this.connection.bulk.load(objectName, 'update', records),
        `bulk update for ${objectName}`
      );
      console.log(`Bulk update completed for ${objectName}:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Bulk update failed for ${objectName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk update failed'
      };
    }
  }

  async bulkUpsert(objectName: string, records: any[], externalIdField: string) {
    try {
      console.log(`Starting bulk upsert for ${objectName} with ${records.length} records using external ID field: ${externalIdField}`);
      const result = await withTokenRefresh(
        this,
        async () => await this.connection.bulk.load(objectName, 'upsert', { extIdField: externalIdField }, records),
        `bulk upsert for ${objectName}`
      );
      console.log(`Bulk upsert completed for ${objectName}:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Bulk upsert failed for ${objectName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk upsert failed'
      };
    }
  }

  async bulkDelete(objectName: string, recordIds: string[]) {
    try {
      console.log(`Starting bulk delete for ${objectName} with ${recordIds.length} records`);
      
      // Convert record IDs to records with just Id field for deletion
      const deleteRecords = recordIds.map(id => ({ Id: id }));
      
      const result = await withTokenRefresh(
        this,
        async () => await this.connection.bulk.load(objectName, 'delete', deleteRecords),
        `bulk delete for ${objectName}`
      );
      console.log(`Bulk delete completed for ${objectName}:`, result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Bulk delete failed for ${objectName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk delete failed'
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