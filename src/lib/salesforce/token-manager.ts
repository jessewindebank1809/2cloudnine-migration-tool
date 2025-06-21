import { prisma } from '@/lib/database/prisma';
import { SalesforceClient } from './client';
import { decrypt } from '@/lib/utils/encryption';
import type { SalesforceOrg } from '@/types';

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
        
        const refreshSuccess = await refreshPromise;
        this.refreshPromises.delete(orgId);
        
        if (!refreshSuccess) {
          console.error(`Failed to refresh token for org ${orgId}`);
          this.tokenCache.delete(orgId);
          return null;
        }
        
        // Get updated token info
        tokenInfo = this.tokenCache.get(orgId);
        if (!tokenInfo) {
          return null;
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
   * Refresh token for org
   */
  private async refreshToken(orgId: string, currentTokenInfo: TokenInfo): Promise<boolean> {
    try {
      console.log(`Refreshing token for org ${orgId}`);
      
      // Get org details
      const org = await prisma.organisations.findUnique({
        where: { id: orgId }
      });
      
      if (!org) {
        console.error(`Org ${orgId} not found`);
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
      const tempClient = new SalesforceClient(salesforceOrg);
      const refreshResult = await tempClient.refreshAccessToken();
      
      if (!refreshResult.success) {
        console.error(`Token refresh failed for org ${orgId}: ${refreshResult.error}`);
        
        // Check if it's a permanent failure (expired refresh token)
        if (refreshResult.error?.includes('Refresh token expired')) {
          console.log(`Refresh token expired for org ${orgId}, clearing cache`);
          this.tokenCache.delete(orgId);
          return false;
        }
        
        // For other failures, treat as temporary
        console.warn(`Temporary token refresh failure for org ${orgId}, keeping tokens for retry`);
        return false;
      }

      // Update cache with new token info
      const newTokenInfo: TokenInfo = {
        accessToken: tempClient.accessToken || currentTokenInfo.accessToken,
        refreshToken: tempClient.refreshToken || currentTokenInfo.refreshToken,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        lastRefreshed: new Date()
      };
      
      this.tokenCache.set(orgId, newTokenInfo);
      
      console.log(`Successfully refreshed token for org ${orgId}`);
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
        return false;
      }
      
      // For other errors, treat as temporary
      console.warn(`Keeping tokens for org ${orgId} due to refresh error, will retry later`);
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
   * Clear token cache for org (useful when org is reconnected)
   */
  clearTokenCache(orgId: string): void {
    this.tokenCache.delete(orgId);
    this.refreshPromises.delete(orgId);
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

    console.log('Started background token refresh scheduler (every 30 minutes)');
  }
} 