import { prisma } from '@/lib/database/prisma';

export interface UsageEventData {
  eventType: string;
  userId?: string;
  organisationId?: string;
  migrationId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface UsageMetricData {
  metricName: string;
  metricValue: number;
  tags?: Record<string, any>;
}

/**
 * Usage tracking service for monitoring application usage
 */
export class UsageTracker {
  /**
   * Track a usage event
   */
  async trackEvent(data: UsageEventData): Promise<void> {
    try {
      await prisma.usage_events.create({
        data: {
          event_type: data.eventType,
          user_id: data.userId || null,
          organisation_id: data.organisationId || null,
          migration_id: data.migrationId || null,
          session_id: data.sessionId || null,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      // Don't throw errors for tracking failures to avoid disrupting main functionality
      console.error('Failed to track usage event:', error);
    }
  }

  /**
   * Record a usage metric
   */
  async recordMetric(data: UsageMetricData): Promise<void> {
    try {
      await prisma.usage_metrics.create({
        data: {
          metric_name: data.metricName,
          metric_value: data.metricValue,
          tags: data.tags || {},
        },
      });
    } catch (error) {
      console.error('Failed to record usage metric:', error);
    }
  }

  /**
   * Track migration start event
   */
  async trackMigrationStart(migrationId: string, sessionId: string, userId: string, organisationIds: { source: string; target: string }): Promise<void> {
    await this.trackEvent({
      eventType: 'migration_started',
      userId,
      migrationId,
      sessionId,
      metadata: {
        sourceOrgId: organisationIds.source,
        targetOrgId: organisationIds.target,
      },
    });
  }

  /**
   * Track migration completion event
   */
  async trackMigrationComplete(migrationId: string, sessionId: string, userId: string, result: { success: boolean; recordsProcessed: number; duration: number }): Promise<void> {
    await this.trackEvent({
      eventType: 'migration_completed',
      userId,
      migrationId,
      sessionId,
      metadata: {
        success: result.success,
        recordsProcessed: result.recordsProcessed,
        durationMs: result.duration,
      },
    });

    // Record performance metrics
    await this.recordMetric({
      metricName: 'migration_duration',
      metricValue: result.duration / 1000, // Convert to seconds
      tags: { migrationId, success: result.success },
    });

    await this.recordMetric({
      metricName: 'records_processed',
      metricValue: result.recordsProcessed,
      tags: { migrationId, success: result.success },
    });
  }

  /**
   * Track migration failure event
   */
  async trackMigrationFailure(migrationId: string, sessionId: string, userId: string, error: string): Promise<void> {
    await this.trackEvent({
      eventType: 'migration_failed',
      userId,
      migrationId,
      sessionId,
      metadata: {
        error,
      },
    });
  }

  /**
   * Track user authentication event
   */
  async trackUserAuth(userId: string, eventType: 'login' | 'logout', metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: `user_${eventType}`,
      userId,
      metadata,
    });
  }

  /**
   * Track organisation connection event
   */
  async trackOrgConnection(userId: string, organisationId: string, eventType: 'connected' | 'disconnected'): Promise<void> {
    await this.trackEvent({
      eventType: `org_${eventType}`,
      userId,
      organisationId,
    });
  }

  /**
   * Track API usage
   */
  async trackApiUsage(endpoint: string, method: string, responseTime: number, statusCode: number, userId?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'api_request',
      userId,
      metadata: {
        endpoint,
        method,
        responseTime,
        statusCode,
      },
    });

    await this.recordMetric({
      metricName: 'api_response_time',
      metricValue: responseTime,
      tags: { endpoint, method, statusCode },
    });
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(featureName: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'feature_used',
      userId,
      metadata: {
        feature: featureName,
        ...metadata,
      },
    });
  }

  /**
   * Get usage summary for a user
   */
  async getUserUsageSummary(userId: string, days: number = 30): Promise<{
    totalMigrations: number;
    successfulMigrations: number;
    failedMigrations: number;
    totalRecordsProcessed: number;
    averageMigrationDuration: number;
    mostUsedFeatures: Array<{ feature: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const migrationEvents = await prisma.usage_events.findMany({
      where: {
        user_id: userId,
        event_type: {
          in: ['migration_completed', 'migration_failed'],
        },
        created_at: {
          gte: startDate,
        },
      },
    });

    const featureEvents = await prisma.usage_events.findMany({
      where: {
        user_id: userId,
        event_type: 'feature_used',
        created_at: {
          gte: startDate,
        },
      },
    });

    const totalMigrations = migrationEvents.length;
    const successfulMigrations = migrationEvents.filter(e => e.event_type === 'migration_completed' && (e.metadata as any)?.success).length;
    const failedMigrations = totalMigrations - successfulMigrations;

    const completedMigrations = migrationEvents.filter(e => e.event_type === 'migration_completed');
    const totalRecordsProcessed = completedMigrations.reduce((sum, e) => sum + ((e.metadata as any)?.recordsProcessed || 0), 0);
    const totalDuration = completedMigrations.reduce((sum, e) => sum + ((e.metadata as any)?.durationMs || 0), 0);
    const averageMigrationDuration = completedMigrations.length > 0 ? totalDuration / completedMigrations.length : 0;

    const featureUsage = featureEvents.reduce((acc, event) => {
      const feature = (event.metadata as any)?.feature || 'unknown';
      acc[feature] = (acc[feature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedFeatures = Object.entries(featureUsage)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalMigrations,
      successfulMigrations,
      failedMigrations,
      totalRecordsProcessed,
      averageMigrationDuration: averageMigrationDuration / 1000, // Convert to seconds
      mostUsedFeatures,
    };
  }

  /**
   * Get system-wide usage statistics
   */
  async getSystemUsageStats(days: number = 30): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalMigrations: number;
    totalRecordsProcessed: number;
    averageSuccessRate: number;
    topFeatures: Array<{ feature: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalUsers, activeUserEvents, migrationEvents, featureEvents] = await Promise.all([
      prisma.user.count(),
      prisma.usage_events.findMany({
        where: {
          created_at: {
            gte: startDate,
          },
          user_id: {
            not: null,
          },
        },
        select: {
          user_id: true,
        },
        distinct: ['user_id'],
      }),
      prisma.usage_events.findMany({
        where: {
          event_type: {
            in: ['migration_completed', 'migration_failed'],
          },
          created_at: {
            gte: startDate,
          },
        },
      }),
      prisma.usage_events.findMany({
        where: {
          event_type: 'feature_used',
          created_at: {
            gte: startDate,
          },
        },
      }),
    ]);

    const activeUsers = activeUserEvents.length;
    const totalMigrations = migrationEvents.length;
    const successfulMigrations = migrationEvents.filter(e => 
      e.event_type === 'migration_completed' && (e.metadata as any)?.success
    ).length;
    const averageSuccessRate = totalMigrations > 0 ? (successfulMigrations / totalMigrations) * 100 : 0;

    const totalRecordsProcessed = migrationEvents
      .filter(e => e.event_type === 'migration_completed')
      .reduce((sum, e) => sum + ((e.metadata as any)?.recordsProcessed || 0), 0);

    const featureUsage = featureEvents.reduce((acc, event) => {
      const feature = (event.metadata as any)?.feature || 'unknown';
      acc[feature] = (acc[feature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topFeatures = Object.entries(featureUsage)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalUsers,
      activeUsers,
      totalMigrations,
      totalRecordsProcessed,
      averageSuccessRate,
      topFeatures,
    };
  }
}

// Export singleton instance
export const usageTracker = new UsageTracker();