import { UsageTracker } from '@/lib/usage-tracker';
import { prisma } from '@/lib/database/prisma';

// Mock Prisma
jest.mock('@/lib/database/prisma', () => ({
  prisma: {
    usage_events: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    usage_metrics: {
      create: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('UsageTracker', () => {
  let usageTracker: UsageTracker;

  beforeEach(() => {
    usageTracker = new UsageTracker();
    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should create a usage event successfully', async () => {
      const eventData = {
        eventType: 'test_event',
        userId: 'user123',
        metadata: { key: 'value' },
      };

      mockPrisma.usage_events.create.mockResolvedValue({
        id: 'event123',
        event_type: 'test_event',
        user_id: 'user123',
        organisation_id: null,
        migration_id: null,
        session_id: null,
        metadata: { key: 'value' },
        created_at: new Date(),
      });

      await usageTracker.trackEvent(eventData);

      expect(mockPrisma.usage_events.create).toHaveBeenCalledWith({
        data: {
          event_type: 'test_event',
          user_id: 'user123',
          organisation_id: null,
          migration_id: null,
          session_id: null,
          metadata: { key: 'value' },
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const eventData = {
        eventType: 'test_event',
        userId: 'user123',
      };

      mockPrisma.usage_events.create.mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(usageTracker.trackEvent(eventData)).resolves.toBeUndefined();
    });
  });

  describe('recordMetric', () => {
    it('should create a usage metric successfully', async () => {
      const metricData = {
        metricName: 'test_metric',
        metricValue: 123.45,
        tags: { environment: 'test' },
      };

      mockPrisma.usage_metrics.create.mockResolvedValue({
        id: 'metric123',
        metric_name: 'test_metric',
        metric_value: 123.45,
        tags: { environment: 'test' },
        recorded_at: new Date(),
      });

      await usageTracker.recordMetric(metricData);

      expect(mockPrisma.usage_metrics.create).toHaveBeenCalledWith({
        data: {
          metric_name: 'test_metric',
          metric_value: 123.45,
          tags: { environment: 'test' },
        },
      });
    });
  });

  describe('trackMigrationStart', () => {
    it('should track migration start event', async () => {
      mockPrisma.usage_events.create.mockResolvedValue({} as any);

      await usageTracker.trackMigrationStart(
        'migration123',
        'session123',
        'user123',
        { source: 'source_org', target: 'target_org' }
      );

      expect(mockPrisma.usage_events.create).toHaveBeenCalledWith({
        data: {
          event_type: 'migration_started',
          user_id: 'user123',
          organisation_id: null,
          migration_id: 'migration123',
          session_id: 'session123',
          metadata: {
            sourceOrgId: 'source_org',
            targetOrgId: 'target_org',
          },
        },
      });
    });
  });

  describe('trackMigrationComplete', () => {
    it('should track migration completion with metrics', async () => {
      mockPrisma.usage_events.create.mockResolvedValue({} as any);
      mockPrisma.usage_metrics.create.mockResolvedValue({} as any);

      const result = {
        success: true,
        recordsProcessed: 100,
        duration: 5000,
      };

      await usageTracker.trackMigrationComplete(
        'migration123',
        'session123',
        'user123',
        result
      );

      expect(mockPrisma.usage_events.create).toHaveBeenCalledWith({
        data: {
          event_type: 'migration_completed',
          user_id: 'user123',
          organisation_id: null,
          migration_id: 'migration123',
          session_id: 'session123',
          metadata: {
            success: true,
            recordsProcessed: 100,
            durationMs: 5000,
          },
        },
      });

      expect(mockPrisma.usage_metrics.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserUsageSummary', () => {
    it('should return user usage summary', async () => {
      const migrationEvents = [
        {
          event_type: 'migration_completed',
          metadata: { success: true, recordsProcessed: 50, durationMs: 3000 },
        },
        {
          event_type: 'migration_failed',
          metadata: { error: 'Test error' },
        },
      ];

      const featureEvents = [
        { metadata: { feature: 'feature1' } },
        { metadata: { feature: 'feature1' } },
        { metadata: { feature: 'feature2' } },
      ];

      mockPrisma.usage_events.findMany
        .mockResolvedValueOnce(migrationEvents as any)
        .mockResolvedValueOnce(featureEvents as any);

      const summary = await usageTracker.getUserUsageSummary('user123', 30);

      expect(summary).toEqual({
        totalMigrations: 2,
        successfulMigrations: 1,
        failedMigrations: 1,
        totalRecordsProcessed: 50,
        averageMigrationDuration: 3, // 3000ms / 1000 = 3 seconds
        mostUsedFeatures: [
          { feature: 'feature1', count: 2 },
          { feature: 'feature2', count: 1 },
        ],
      });
    });
  });

  describe('getSystemUsageStats', () => {
    it('should return system-wide usage statistics', async () => {
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.usage_events.findMany
        .mockResolvedValueOnce([{ user_id: 'user1' }, { user_id: 'user2' }] as any) // Active users
        .mockResolvedValueOnce([ // Migration events
          { event_type: 'migration_completed', metadata: { success: true, recordsProcessed: 100 } },
          { event_type: 'migration_failed', metadata: { error: 'Test error' } },
        ] as any)
        .mockResolvedValueOnce([ // Feature events
          { metadata: { feature: 'feature1' } },
          { metadata: { feature: 'feature2' } },
          { metadata: { feature: 'feature1' } },
        ] as any);

      const stats = await usageTracker.getSystemUsageStats(30);

      expect(stats).toEqual({
        totalUsers: 10,
        activeUsers: 2,
        totalMigrations: 2,
        totalRecordsProcessed: 100,
        averageSuccessRate: 50, // 1 success out of 2 total = 50%
        topFeatures: [
          { feature: 'feature1', count: 2 },
          { feature: 'feature2', count: 1 },
        ],
      });
    });
  });
});