import { SalesforceClient } from './client';
import { z } from 'zod';

// Schema for org capabilities
const OrgCapabilitiesSchema = z.object({
  apiVersion: z.string(),
  features: z.object({
    bulkApi: z.boolean(),
    bulkApi2: z.boolean(),
    compositeApi: z.boolean(),
    metadataApi: z.boolean(),
    streamingApi: z.boolean(),
    changeDataCapture: z.boolean(),
    platformEvents: z.boolean(),
  }),
  limits: z.object({
    apiDailyRequests: z.number(),
    apiConcurrentRequests: z.number(),
    bulkApiBatches: z.number(),
    dataStorageMB: z.number(),
    fileStorageMB: z.number(),
  }),
  objects: z.object({
    maxCustomObjects: z.number(),
    customObjectsUsed: z.number(),
  }),
  permissions: z.object({
    canCreateApps: z.boolean(),
    canModifyMetadata: z.boolean(),
    canAccessSetup: z.boolean(),
  }),
});

export type OrgCapabilities = z.infer<typeof OrgCapabilitiesSchema>;

export class OrgCapabilityDetector {
  constructor(private client: SalesforceClient) {}

  /**
   * Detect all capabilities of the connected org
   */
  async detectCapabilities(): Promise<OrgCapabilities> {
    const [
      apiVersion,
      features,
      limits,
      objectInfo,
      permissions
    ] = await Promise.all([
      this.getApiVersion(),
      this.detectFeatures(),
      this.getOrgLimits(),
      this.getObjectInfo(),
      this.checkPermissions(),
    ]);

    return {
      apiVersion,
      features,
      limits,
      objects: objectInfo,
      permissions,
    };
  }

  /**
   * Get the API version of the org
   */
  private async getApiVersion(): Promise<string> {
    try {
      // Use jsforce connection to get versions
      const connection = (this.client as any).connection;
      const versions = await connection.request('/services/data');
      
      // Get the latest version
      const latestVersion = versions[versions.length - 1];
      return latestVersion.version;
    } catch (error) {
      console.error('Failed to get API version:', error);
      return '63.0'; // Default fallback
    }
  }

  /**
   * Detect available features in the org
   */
  private async detectFeatures(): Promise<OrgCapabilities['features']> {
    const features = {
      bulkApi: true, // Usually available in all orgs
      bulkApi2: true, // Available in newer orgs
      compositeApi: true,
      metadataApi: true,
      streamingApi: false,
      changeDataCapture: false,
      platformEvents: false,
    };

    try {
      const connection = (this.client as any).connection;
      
      // Check for Bulk API 2.0
      try {
        await connection.request('/services/data/v63.0/jobs/ingest');
        features.bulkApi2 = true;
      } catch {
        features.bulkApi2 = false;
      }

      // Check for streaming API
      try {
        await connection.request('/services/data/v63.0/sobjects/PushTopic');
        features.streamingApi = true;
      } catch {
        features.streamingApi = false;
      }

      // Check for Change Data Capture
      try {
        const cdcResult = await connection.query(
          "SELECT Id FROM EntityDefinition WHERE QualifiedApiName LIKE '%ChangeEvent' LIMIT 1"
        );
        features.changeDataCapture = cdcResult.totalSize > 0;
      } catch {
        features.changeDataCapture = false;
      }

    } catch (error) {
      console.error('Error detecting features:', error);
    }

    return features;
  }

  /**
   * Get org limits
   */
  private async getOrgLimits(): Promise<OrgCapabilities['limits']> {
    const defaultLimits = {
      apiDailyRequests: 15000,
      apiConcurrentRequests: 25,
      bulkApiBatches: 10000,
      dataStorageMB: 1024,
      fileStorageMB: 1024,
    };

    try {
      const limitsResult = await this.client.getLimits();
      if (!limitsResult.success || !limitsResult.data) {
        return defaultLimits;
      }

      const connection = (this.client as any).connection;
      const limits = await connection.request('/services/data/v63.0/limits');

      return {
        apiDailyRequests: limits.DailyApiRequests?.Max || defaultLimits.apiDailyRequests,
        apiConcurrentRequests: limits.ConcurrentAsyncGetReportInstances?.Max || defaultLimits.apiConcurrentRequests,
        bulkApiBatches: limits.DailyBulkApiBatches?.Max || defaultLimits.bulkApiBatches,
        dataStorageMB: limits.DataStorageMB?.Max || defaultLimits.dataStorageMB,
        fileStorageMB: limits.FileStorageMB?.Max || defaultLimits.fileStorageMB,
      };
    } catch (error) {
      console.error('Failed to get org limits:', error);
      return defaultLimits;
    }
  }

  /**
   * Get custom object information
   */
  private async getObjectInfo(): Promise<OrgCapabilities['objects']> {
    try {
      const connection = (this.client as any).connection;
      const globalDescribe = await connection.describeGlobal();
      
      const customObjects = globalDescribe.sobjects.filter((obj: any) => obj.custom);
      
      // Get limits for custom objects
      const limits = await connection.request('/services/data/v63.0/limits');
      const maxCustomObjects = limits.CustomObjectLimit?.Max || 200;

      return {
        maxCustomObjects,
        customObjectsUsed: customObjects.length,
      };
    } catch (error) {
      console.error('Failed to get object info:', error);
      return {
        maxCustomObjects: 200,
        customObjectsUsed: 0,
      };
    }
  }

  /**
   * Check user permissions
   */
  private async checkPermissions(): Promise<OrgCapabilities['permissions']> {
    const permissions = {
      canCreateApps: false,
      canModifyMetadata: false,
      canAccessSetup: false,
    };

    try {
      const connection = (this.client as any).connection;
      
      // Check user permissions
      const userInfo = await connection.identity();
      const userId = userInfo.user_id;

      // Query user permissions
      const permQuery = await connection.query(`
        SELECT 
          PermissionsModifyAllData,
          PermissionsManageCustomPermissions,
          PermissionsCustomizeApplication,
          PermissionsViewSetup
        FROM User 
        WHERE Id = '${userId}'
      `);

      if (permQuery.records.length > 0) {
        const userPerms = permQuery.records[0];
        permissions.canCreateApps = userPerms.PermissionsCustomizeApplication || false;
        permissions.canModifyMetadata = userPerms.PermissionsModifyAllData || false;
        permissions.canAccessSetup = userPerms.PermissionsViewSetup || false;
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }

    return permissions;
  }

  /**
   * Check if org supports a specific feature
   */
  async hasFeature(feature: keyof OrgCapabilities['features']): Promise<boolean> {
    const capabilities = await this.detectCapabilities();
    return capabilities.features[feature];
  }

  /**
   * Get remaining API calls
   */
  async getRemainingApiCalls(): Promise<number> {
    try {
      const limitsResult = await this.client.getLimits();
      if (limitsResult.success && limitsResult.data) {
        return limitsResult.data.remainingApiCalls;
      }
      return 0;
    } catch (error) {
      console.error('Failed to get remaining API calls:', error);
      return 0;
    }
  }

  /**
   * Check if org has sufficient API calls for migration
   */
  async hasSufficientApiCalls(estimatedCalls: number): Promise<boolean> {
    const remaining = await this.getRemainingApiCalls();
    const buffer = 1000; // Keep 1000 calls as buffer
    return remaining > (estimatedCalls + buffer);
  }
} 