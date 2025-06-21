import { SalesforceClient } from './client';
import { ConnectionHealthMonitor, HealthCheckResult } from './connection-health';
import { OrgCapabilityDetector, OrgCapabilities } from './org-capabilities';
import { prisma } from '@/lib/database/prisma';
import { decrypt } from '@/lib/utils/encryption';
import { SalesforceRateLimiter } from './rate-limiter';

export interface OrgSession {
  orgId: string;
  client: SalesforceClient;
  healthMonitor: ConnectionHealthMonitor;
  capabilityDetector: OrgCapabilityDetector;
  rateLimiter: SalesforceRateLimiter;
  lastAccessed: Date;
  health?: HealthCheckResult;
  capabilities?: OrgCapabilities;
}

export class MultiOrgSessionManager {
  private sessions = new Map<string, OrgSession>();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get or create a session for an organisation
   */
  async getSession(orgId: string): Promise<OrgSession> {
    // Check if session exists and is valid
    const existingSession = this.sessions.get(orgId);
    if (existingSession) {
      existingSession.lastAccessed = new Date();
      return existingSession;
    }

    // Create new session
    return await this.createSession(orgId);
  }

  /**
   * Create a new session for an organisation
   */
  private async createSession(orgId: string): Promise<OrgSession> {
    // Get org from database
    const org = await prisma.organisations.findUnique({
      where: { id: orgId },
    });

    if (!org || !org.access_token_encrypted) {
      throw new Error(`Organisation ${orgId} not found or not connected`);
    }

    // Decrypt tokens
    const accessToken = decrypt(org.access_token_encrypted);
    const refreshToken = org.refresh_token_encrypted ? decrypt(org.refresh_token_encrypted) : undefined;

    // Create Salesforce client
    const client = new SalesforceClient({
      id: org.id,
      organisationId: org.salesforce_org_id || '',
      organisationName: org.name,
      instanceUrl: org.instance_url,
      accessToken,
      refreshToken,
    });

    // Create supporting services
    const healthMonitor = new ConnectionHealthMonitor();
    const capabilityDetector = new OrgCapabilityDetector(client);
    const rateLimiter = new SalesforceRateLimiter({
      maxRequestsPerSecond: 10,
      maxConcurrent: 5,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    // Create session object
    const session: OrgSession = {
      orgId,
      client,
      healthMonitor,
      capabilityDetector,
      rateLimiter,
      lastAccessed: new Date(),
    };

    // Store session
    this.sessions.set(orgId, session);

    // Perform initial health check
    session.health = await healthMonitor.checkOrgHealth(orgId);

    return session;
  }

  /**
   * Get client for an organisation
   */
  async getClient(orgId: string): Promise<SalesforceClient> {
    // Try to get client with valid tokens
    const client = await SalesforceClient.createWithValidTokens(orgId);
    
    if (!client) {
      throw new Error(`Organisation ${orgId} not connected or tokens expired`);
    }
    
    return client;
  }

  /**
   * Get health monitor for an organisation
   */
  async getHealthMonitor(orgId: string): Promise<ConnectionHealthMonitor> {
    const session = await this.getSession(orgId);
    return session.healthMonitor;
  }

  /**
   * Get capability detector for an organisation
   */
  async getCapabilityDetector(orgId: string): Promise<OrgCapabilityDetector> {
    const session = await this.getSession(orgId);
    return session.capabilityDetector;
  }

  /**
   * Get rate limiter for an organisation
   */
  async getRateLimiter(orgId: string): Promise<SalesforceRateLimiter> {
    const session = await this.getSession(orgId);
    return session.rateLimiter;
  }

  /**
   * Execute a rate-limited operation
   */
  async executeWithRateLimit<T>(
    orgId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const rateLimiter = await this.getRateLimiter(orgId);
    return rateLimiter.execute(operation);
  }

  /**
   * Get health status for an organisation
   */
  async getHealthStatus(orgId: string): Promise<HealthCheckResult> {
    const session = await this.getSession(orgId);
    
    // Return cached health if recent (< 5 minutes)
    if (session.health && 
        (new Date().getTime() - session.health.lastChecked.getTime()) < 5 * 60 * 1000) {
      return session.health;
    }

    // Otherwise, perform new health check
    session.health = await session.healthMonitor.checkOrgHealth(orgId);
    return session.health;
  }

  /**
   * Get capabilities for an organisation
   */
  async getCapabilities(orgId: string): Promise<OrgCapabilities> {
    const session = await this.getSession(orgId);
    
    // Cache capabilities as they don't change often
    if (!session.capabilities) {
      session.capabilities = await session.capabilityDetector.detectCapabilities();
    }

    return session.capabilities;
  }

  /**
   * Check if all organisations are healthy
   */
  async areAllOrgsHealthy(orgIds: string[]): Promise<boolean> {
    const healthChecks = await Promise.all(
      orgIds.map(id => this.getHealthStatus(id))
    );

    return healthChecks.every(health => health.isHealthy);
  }

  /**
   * Get sessions for multiple organisations
   */
  async getSessions(orgIds: string[]): Promise<Map<string, OrgSession>> {
    const sessions = new Map<string, OrgSession>();

    await Promise.all(
      orgIds.map(async (id) => {
        try {
          const session = await this.getSession(id);
          sessions.set(id, session);
        } catch (error) {
          console.error(`Failed to get session for org ${id}:`, error);
        }
      })
    );

    return sessions;
  }

  /**
   * Remove a session
   */
  removeSession(orgId: string): void {
    this.sessions.delete(orgId);
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Start cleanup interval to remove stale sessions
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Clean up stale sessions
   */
  private cleanupStaleSessions(): void {
    const now = new Date().getTime();
    const staleSessionIds: string[] = [];

    this.sessions.forEach((session, orgId) => {
      if (now - session.lastAccessed.getTime() > this.sessionTimeout) {
        staleSessionIds.push(orgId);
      }
    });

    staleSessionIds.forEach(id => {
      console.log(`Removing stale session for org ${id}`);
      this.sessions.delete(id);
    });
  }

  /**
   * Destroy the session manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearAllSessions();
  }
}

// Export singleton instance
export const sessionManager = new MultiOrgSessionManager(); 