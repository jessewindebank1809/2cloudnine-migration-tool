import { SalesforceClient } from './client';
import { prisma } from '@/lib/database/prisma';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import type { SalesforceOrg } from '@/types';

export interface HealthCheckResult {
  orgId: string;
  isHealthy: boolean;
  lastChecked: Date;
  details: {
    connected: boolean;
    tokenValid: boolean;
    apiLimitOk: boolean;
    error?: string;
  };
  limits?: {
    dailyApiRequests: {
      max: number;
      remaining: number;
      used: number;
    };
  };
}

export class ConnectionHealthMonitor {
  private checkInterval: number = 5 * 60 * 1000; // 5 minutes
  private healthCache = new Map<string, HealthCheckResult>();

  /**
   * Check health of a single organization
   */
  async checkOrgHealth(orgId: string): Promise<HealthCheckResult> {
    try {
      // Get org from database
      const org = await prisma.organisation.findUnique({
        where: { id: orgId },
      });

      if (!org || !org.accessTokenEncrypted) {
        return this.createHealthResult(orgId, false, 'Organization not found or not connected');
      }

      // Decrypt tokens
      const accessToken = decrypt(org.accessTokenEncrypted);
      const refreshToken = org.refreshTokenEncrypted ? decrypt(org.refreshTokenEncrypted) : undefined;

      // Create client
      const client = new SalesforceClient({
        id: org.id,
        organizationId: org.salesforceOrgId || '',
        organizationName: org.name,
        instanceUrl: org.instanceUrl,
        accessToken,
        refreshToken,
      });

      // Test connection
      const connectionTest = await client.testConnection();
      if (!connectionTest.success) {
        return this.createHealthResult(orgId, false, connectionTest.error);
      }

      // Get API limits
      const limitsResult = await client.getLimits();
      const limits = limitsResult.success && limitsResult.data ? {
        dailyApiRequests: {
          max: limitsResult.data.dailyApiCalls,
          remaining: limitsResult.data.remainingApiCalls,
          used: limitsResult.data.dailyApiCalls - limitsResult.data.remainingApiCalls,
        }
      } : undefined;

      // Check if API limits are healthy (> 10% remaining)
      const apiLimitOk = limits ? 
        (limits.dailyApiRequests.remaining / limits.dailyApiRequests.max) > 0.1 : true;

      const result = this.createHealthResult(orgId, true, undefined, {
        connected: true,
        tokenValid: true,
        apiLimitOk,
      }, limits);

      // Cache the result
      this.healthCache.set(orgId, result);

      // Update database
      await this.updateOrgHealthStatus(orgId, result);

      return result;
    } catch (error) {
      console.error(`Health check failed for org ${orgId}:`, error);
      return this.createHealthResult(orgId, false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check health of all connected organizations
   */
  async checkAllOrgsHealth(): Promise<HealthCheckResult[]> {
    const orgs = await prisma.organisation.findMany({
      where: {
        accessTokenEncrypted: { not: null }
      }
    });

    const results = await Promise.all(
      orgs.map(org => this.checkOrgHealth(org.id))
    );

    return results;
  }

  /**
   * Get cached health status
   */
  getCachedHealth(orgId: string): HealthCheckResult | undefined {
    return this.healthCache.get(orgId);
  }

  /**
   * Start periodic health monitoring
   */
  startMonitoring(intervalMs?: number): NodeJS.Timer {
    if (intervalMs) {
      this.checkInterval = intervalMs;
    }

    // Initial check
    this.checkAllOrgsHealth();

    // Set up periodic checks
    return setInterval(() => {
      this.checkAllOrgsHealth();
    }, this.checkInterval);
  }

  /**
   * Check if org needs token refresh
   */
  async needsTokenRefresh(org: { tokenExpiresAt: Date | null }): Promise<boolean> {
    if (!org.tokenExpiresAt) return false;
    
    const now = new Date();
    const expiresAt = new Date(org.tokenExpiresAt);
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return now.getTime() > (expiresAt.getTime() - bufferTime);
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(orgId: string): Promise<boolean> {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId }
    });

    if (!org || !await this.needsTokenRefresh(org)) {
      return false;
    }

    try {
      const refreshToken = org.refreshTokenEncrypted ? decrypt(org.refreshTokenEncrypted) : undefined;
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Create client and refresh token
      const client = new SalesforceClient({
        id: org.id,
        organizationId: org.salesforceOrgId || '',
        organizationName: org.name,
        instanceUrl: org.instanceUrl,
        accessToken: decrypt(org.accessTokenEncrypted!),
        refreshToken,
      });

      // TODO: Implement token refresh in SalesforceClient
      // const newTokens = await client.refreshAccessToken();
      
      // For now, just return false
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Create health check result object
   */
  private createHealthResult(
    orgId: string,
    isHealthy: boolean,
    error?: string,
    details?: Partial<HealthCheckResult['details']>,
    limits?: HealthCheckResult['limits']
  ): HealthCheckResult {
    return {
      orgId,
      isHealthy,
      lastChecked: new Date(),
      details: {
        connected: false,
        tokenValid: false,
        apiLimitOk: true,
        ...details,
        ...(error ? { error } : {}),
      },
      limits,
    };
  }

  /**
   * Update org health status in database
   */
  private async updateOrgHealthStatus(
    orgId: string,
    health: HealthCheckResult
  ): Promise<void> {
    // Store health status in a separate field or related table
    // For now, we'll just update the updatedAt timestamp
    await prisma.organisation.update({
      where: { id: orgId },
      data: {
        updatedAt: new Date(),
        // TODO: Add healthStatus field to schema
      }
    });
  }
} 