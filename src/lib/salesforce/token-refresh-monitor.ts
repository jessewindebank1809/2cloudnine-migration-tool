import { prisma } from '@/lib/database/prisma';

interface TokenHealthStatus {
  orgId: string;
  orgName: string;
  lastRefreshAttempt?: Date;
  lastSuccessfulRefresh?: Date;
  refreshFailureCount: number;
  requiresReconnect: boolean;
  error?: string;
}

export class TokenRefreshMonitor {
  private static instance: TokenRefreshMonitor;
  private tokenHealthMap = new Map<string, TokenHealthStatus>();
  
  static getInstance(): TokenRefreshMonitor {
    if (!TokenRefreshMonitor.instance) {
      TokenRefreshMonitor.instance = new TokenRefreshMonitor();
    }
    return TokenRefreshMonitor.instance;
  }
  
  async recordRefreshAttempt(orgId: string, success: boolean, error?: string): Promise<void> {
    const org = await prisma.organisations.findUnique({
      where: { id: orgId },
      select: { name: true }
    });
    
    const health = this.tokenHealthMap.get(orgId) || {
      orgId,
      orgName: org?.name || 'Unknown',
      refreshFailureCount: 0,
      requiresReconnect: false
    };
    
    health.lastRefreshAttempt = new Date();
    
    if (success) {
      health.lastSuccessfulRefresh = new Date();
      health.refreshFailureCount = 0;
      health.requiresReconnect = false;
      health.error = undefined;
    } else {
      health.refreshFailureCount++;
      health.error = error;
      
      // Mark as requiring reconnect if refresh token is expired
      if (error?.includes('expired') || error?.includes('invalid_grant')) {
        health.requiresReconnect = true;
      }
    }
    
    this.tokenHealthMap.set(orgId, health);
    
    // Log critical failures
    if (health.refreshFailureCount >= 3) {
      console.error(`Critical: Org ${health.orgName} (${orgId}) has failed ${health.refreshFailureCount} consecutive refresh attempts`);
    }
  }
  
  getTokenHealth(): TokenHealthStatus[] {
    return Array.from(this.tokenHealthMap.values());
  }
  
  getUnhealthyOrgs(): TokenHealthStatus[] {
    return this.getTokenHealth().filter(
      health => health.requiresReconnect || health.refreshFailureCount > 0
    );
  }
  
  async generateHealthReport(): Promise<{
    totalOrgs: number;
    healthyOrgs: number;
    unhealthyOrgs: number;
    requireReconnect: number;
    details: TokenHealthStatus[];
  }> {
    const allHealth = this.getTokenHealth();
    const unhealthy = this.getUnhealthyOrgs();
    
    return {
      totalOrgs: allHealth.length,
      healthyOrgs: allHealth.length - unhealthy.length,
      unhealthyOrgs: unhealthy.length,
      requireReconnect: unhealthy.filter(h => h.requiresReconnect).length,
      details: unhealthy
    };
  }
  
  clearOrgHealth(orgId: string): void {
    this.tokenHealthMap.delete(orgId);
  }
}