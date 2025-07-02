import { prisma } from '@/lib/database/prisma';
import { SalesforceClient } from './client';
import { decrypt } from '@/lib/utils/encryption';
import type { SalesforceOrg } from '@/types';
import { TokenRefreshMonitor } from './token-refresh-monitor';

interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  lastRefreshed: Date;
}

export class TokenManager {
  private static instance: TokenManager;
  private tokenCache = new Map<string, TokenInfo>();
  private refreshPromises = new Map<string, Promise<boolean>>();
  private monitor = TokenRefreshMonitor.getInstance();

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Check if token needs refresh (refresh 5 minutes before expiry)
   */
  private needsRefresh(tokenInfo: TokenInfo): boolean {
    const now = new Date();
    const refreshThreshold = new Date(tokenInfo.expiresAt.getTime() - 5 * 60 * 1000); // 5 minutes before expiry
    return now >= refreshThreshold;
  }

  /**
   * Get valid token for org, refreshing if necessary
   */
  async getValidToken(orgId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      // Check cache first
      let tokenInfo = this.tokenCache.get(orgId);
      
      // If not in cache, load from database
      if (!tokenInfo) {
        const org = await prisma.organisations.findUnique({
          where: { id: orgId }
        });
        
        if (!org || !org.access_token_encrypted || !org.refresh_token_encrypted) {
          console.warn(`No valid tokens found for org ${orgId}`);
          return null;
        }

        tokenInfo = {
          accessToken: decrypt(org.access_token_encrypted),
          refreshToken: decrypt(org.refresh_token_encrypted),
          expiresAt: org.token_expires_at || new Date(Date.now() + 2 * 60 * 60 * 1000), // Default 2 hours
          lastRefreshed: org.updated_at || new Date()
        };
        
        this.tokenCache.set(orgId, tokenInfo);
      }

      // Check if token needs refresh
      if (this.needsRefresh(tokenInfo)) {
        console.log(`Token for org ${orgId} needs refresh`);
        
        // Check if refresh is already in progress
        let refreshPromise = this.refreshPromises.get(orgId);
        if (!refreshPromise) {
          refreshPromise = this.refreshToken(orgId, tokenInfo);
          this.refreshPromises.set(orgId, refreshPromise);
        }
        
        try {
          const refreshSuccess = await refreshPromise;
          
          if (!refreshSuccess) {
            console.error(`Failed to refresh token for org ${orgId}`);
            this.tokenCache.delete(orgId);
            this.refreshPromises.delete(orgId);
            return null;
          }
          
          // Get updated token info after successful refresh
          tokenInfo = this.tokenCache.get(orgId);
          if (!tokenInfo) {
            console.error(`Token cache inconsistency for org ${orgId}`);
            return null;
          }
        } finally {
          // Always clean up the refresh promise
          this.refreshPromises.delete(orgId);
        }
      }

      return {
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken
      };
    } catch (error) {
      console.error(`Error getting valid token for org ${orgId}:`, error);
      return null;
    }
  }

  /**
   * Refresh token for org with retry logic
   */
  private async refreshToken(orgId: string, currentTokenInfo: TokenInfo, retryCount = 0): Promise<boolean> {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    try {
      console.log(`Refreshing token for org ${orgId}${retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''}`);
      
      // Get org details
      const org = await prisma.organisations.findUnique({
        where: { id: orgId }
      });
      
      if (!org) {
        console.error(`Org ${orgId} not found`);
        await this.monitor.recordRefreshAttempt(orgId, false, 'Org not found');
        return false;
      }

      // Create temporary client for refresh using already-decrypted tokens from cache
      const salesforceOrg: SalesforceOrg = {
        id: org.id,
        organisationId: org.salesforce_org_id || '',
        organisationName: org.name,
        instanceUrl: org.instance_url,
        accessToken: currentTokenInfo.accessToken,
        refreshToken: currentTokenInfo.refreshToken
      };
      const tempClient = await SalesforceClient.create(salesforceOrg, org.org_type as 'PRODUCTION' | 'SANDBOX');
      const refreshResult = await tempClient.refreshAccessToken();
      
      if (!refreshResult.success) {
        console.error(`Token refresh failed for org ${orgId}: ${refreshResult.error}`);
        
        // Check if it's a permanent failure (expired refresh token)
        if (refreshResult.error?.includes('Refresh token expired') || refreshResult.error?.includes('invalid_grant')) {
          console.log(`Refresh token expired for org ${orgId}, clearing cache`);
          this.tokenCache.delete(orgId);
          await this.monitor.recordRefreshAttempt(orgId, false, refreshResult.error);
          return false;
        }
        
        // For temporary failures, retry with exponential backoff
        if (retryCount < maxRetries) {
          console.warn(`Temporary token refresh failure for org ${orgId}, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.refreshToken(orgId, currentTokenInfo, retryCount + 1);
        }
        
        console.error(`Token refresh failed after ${maxRetries} retries for org ${orgId}`);
        await this.monitor.recordRefreshAttempt(orgId, false, refreshResult.error);
        return false;
      }

      // Validate new tokens before updating cache
      const newAccessToken = tempClient.accessToken;
      const newRefreshToken = tempClient.refreshToken;
      
      if (!newAccessToken || !newRefreshToken) {
        console.error(`Token refresh returned invalid tokens for org ${orgId}`);
        await this.monitor.recordRefreshAttempt(orgId, false, 'Invalid tokens returned');
        return false;
      }

      // Update cache with new token info atomically
      const newTokenInfo: TokenInfo = {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        lastRefreshed: new Date()
      };
      
      this.tokenCache.set(orgId, newTokenInfo);
      
      console.log(`Successfully refreshed token for org ${orgId}`);
      await this.monitor.recordRefreshAttempt(orgId, true);
      return true;
    } catch (error) {
      console.error(`Error refreshing token for org ${orgId}:`, error);
      
      // Check if it's a token-related error that indicates permanent failure
      if (error instanceof Error && (
        error.message.includes('invalid_grant') ||
        error.message.includes('expired') ||
        error.message.includes('refresh token')
      )) {
        console.log(`Permanent token failure for org ${orgId}, clearing cache`);
        this.tokenCache.delete(orgId);
        await this.monitor.recordRefreshAttempt(orgId, false, error.message);
        return false;
      }
      
      // For other errors, retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.warn(`Error refreshing token for org ${orgId}, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.refreshToken(orgId, currentTokenInfo, retryCount + 1);
      }
      
      console.error(`Token refresh error after ${maxRetries} retries for org ${orgId}`);
      await this.monitor.recordRefreshAttempt(orgId, false, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Proactively refresh tokens for all connected orgs
   */
  async refreshAllTokens(): Promise<void> {
    try {
      const connectedOrgs = await prisma.organisations.findMany({
        where: {
          access_token_encrypted: { not: null },
          refresh_token_encrypted: { not: null }
        }
      });

      console.log(`Proactively refreshing tokens for ${connectedOrgs.length} connected orgs`);

      const refreshPromises = connectedOrgs.map(async (org) => {
        try {
          await this.getValidToken(org.id);
        } catch (error) {
          console.error(`Error refreshing token for org ${org.id}:`, error);
        }
      });

      await Promise.allSettled(refreshPromises);
      console.log('Completed proactive token refresh for all orgs');
    } catch (error) {
      console.error('Error in proactive token refresh:', error);
    }
  }

  /**
   * Get token health report
   */
  async getTokenHealthReport() {
    return this.monitor.generateHealthReport();
  }
  
  /**
   * Get unhealthy orgs that need attention
   */
  getUnhealthyOrgs() {
    return this.monitor.getUnhealthyOrgs();
  }
  
  /**
   * Clear token cache for org (useful when org is reconnected)
   */
  clearTokenCache(orgId: string): void {
    this.tokenCache.delete(orgId);
    this.refreshPromises.delete(orgId);
    this.monitor.clearOrgHealth(orgId);
  }

  /**
   * Start background token refresh scheduler
   */
  startTokenRefreshScheduler(): void {
    // Refresh tokens every 30 minutes
    setInterval(() => {
      this.refreshAllTokens().catch(error => {
        console.error('Error in scheduled token refresh:', error);
      });
    }, 30 * 60 * 1000); // 30 minutes
    
    // Log health status every hour
    setInterval(async () => {
      try {
        const report = await this.getTokenHealthReport();
        if (report.unhealthyOrgs > 0) {
          console.warn(`⚠️  Token Health Alert: ${report.unhealthyOrgs} orgs need attention`);
          console.warn(`  - ${report.requireReconnect} orgs require reconnection`);
          report.details.forEach(detail => {
            console.warn(`  - ${detail.orgName}: ${detail.error || 'Unknown error'}`);
          });
        } else {
          console.log(`✅ Token Health: All ${report.totalOrgs} orgs are healthy`);
        }
      } catch (error) {
        console.error('Error generating health report:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    console.log('Started background token refresh scheduler (every 30 minutes)');
    console.log('Started token health monitoring (every 60 minutes)');
    
    // Run initial health check after 5 seconds
    setTimeout(async () => {
      try {
        const report = await this.getTokenHealthReport();
        console.log(`Initial token health check: ${report.healthyOrgs}/${report.totalOrgs} orgs healthy`);
      } catch (error) {
        console.error('Error in initial health check:', error);
      }
    }, 5000);
  }
} 