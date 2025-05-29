# User Analytics & Monitoring System Specification

## Overview

This specification outlines the implementation of a comprehensive user analytics
and monitoring system for the TC9 Migration Tool. The system will provide
insights into user behaviour, application performance, error tracking, and
feature usage to help developers understand how the application is being used
and identify areas for improvement.

## Problem Statement

As a developer, I need comprehensive insights into:

- **User Behaviour**: Who is using the app, how they navigate, what features
  they use
- **Performance Issues**: Where the app is slow, what operations are failing
- **Error Patterns**: What errors users encounter, where they get stuck
- **Feature Adoption**: Which features are popular, which are underutilised
- **User Journey**: How users progress through migration workflows

Currently, the application has:

- Basic console logging scattered throughout the codebase
- Limited error tracking in `migration_sessions.error_log`
- Migration analytics showing success/failure rates
- No user behaviour tracking or performance monitoring

## Goals

### Primary Goals

1. **User Behaviour Insights**: Track user actions, feature usage, and
   navigation patterns
2. **Error Monitoring**: Comprehensive error tracking with alerting and
   aggregation
3. **Performance Monitoring**: Track application performance and identify
   bottlenecks
4. **Feature Analytics**: Understand which features are used and how effectively
5. **User Journey Analysis**: Map user flows and identify drop-off points

### Secondary Goals

1. **Automated Alerting**: Notify developers of critical issues
2. **Historical Trends**: Track metrics over time to identify patterns
3. **User Segmentation**: Analyse usage patterns by user type/organisation
4. **A/B Testing Foundation**: Infrastructure for future feature testing

## Technical Requirements

### Database Schema Extensions

#### 1. User Activity Tracking

```sql
CREATE TABLE user_activities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES "User"(id) ON DELETE CASCADE,
  session_id VARCHAR,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_action ON user_activities(action);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);
CREATE INDEX idx_user_activities_session_id ON user_activities(session_id);
```

#### 2. Application Error Tracking

```sql
CREATE TABLE application_errors (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES "User"(id) ON DELETE SET NULL,
  session_id VARCHAR,
  error_type VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  url VARCHAR,
  user_agent TEXT,
  severity VARCHAR(20) DEFAULT 'error',
  resolved BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_application_errors_user_id ON application_errors(user_id);
CREATE INDEX idx_application_errors_error_type ON application_errors(error_type);
CREATE INDEX idx_application_errors_severity ON application_errors(severity);
CREATE INDEX idx_application_errors_created_at ON application_errors(created_at);
CREATE INDEX idx_application_errors_resolved ON application_errors(resolved);
```

#### 3. Feature Usage Tracking

```sql
CREATE TABLE feature_usage (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES "User"(id) ON DELETE CASCADE,
  feature_name VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  first_used_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  total_duration_ms BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE feature_usage ADD CONSTRAINT unique_user_feature UNIQUE(user_id, feature_name);
CREATE INDEX idx_feature_usage_feature_name ON feature_usage(feature_name);
CREATE INDEX idx_feature_usage_last_used_at ON feature_usage(last_used_at);
```

#### 4. Performance Metrics

```sql
CREATE TABLE performance_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES "User"(id) ON DELETE SET NULL,
  session_id VARCHAR,
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_created_at ON performance_metrics(created_at);
```

#### 5. User Sessions Enhanced

```sql
-- Extend existing session table
ALTER TABLE session ADD COLUMN analytics_session_id VARCHAR;
ALTER TABLE session ADD COLUMN page_views INTEGER DEFAULT 0;
ALTER TABLE session ADD COLUMN actions_count INTEGER DEFAULT 0;
ALTER TABLE session ADD COLUMN last_activity_at TIMESTAMP;
```

### Core Services

#### 1. Analytics Logger Service

**File**: `src/lib/analytics/logger.ts`

```typescript
interface LogEvent {
    userId?: string;
    sessionId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    level: "info" | "warn" | "error" | "debug";
    duration?: number;
}

interface ErrorEvent {
    userId?: string;
    sessionId?: string;
    error: Error;
    context?: Record<string, any>;
    severity?: "low" | "medium" | "high" | "critical";
    url?: string;
}

interface PerformanceEvent {
    userId?: string;
    sessionId?: string;
    metricType: string;
    metricName: string;
    value: number;
    unit: string;
    metadata?: Record<string, any>;
}

class AnalyticsLogger {
    private static instance: AnalyticsLogger;
    private queue: Array<any> = [];
    private isProcessing = false;

    static getInstance(): AnalyticsLogger {
        if (!AnalyticsLogger.instance) {
            AnalyticsLogger.instance = new AnalyticsLogger();
        }
        return AnalyticsLogger.instance;
    }

    async logUserActivity(event: LogEvent): Promise<void>;
    async logError(event: ErrorEvent): Promise<void>;
    async logPerformance(event: PerformanceEvent): Promise<void>;
    async trackFeatureUsage(
        userId: string,
        featureName: string,
        metadata?: Record<string, any>,
    ): Promise<void>;

    private async processQueue(): Promise<void>;
    private async batchInsert(events: any[]): Promise<void>;
    private getClientInfo(): {
        ip: string;
        userAgent: string;
        referrer?: string;
    };
}
```

#### 2. Error Tracking Service

**File**: `src/lib/analytics/error-tracker.ts`

```typescript
interface ErrorContext {
    userId?: string;
    sessionId?: string;
    url?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}

class ErrorTracker {
    async captureException(error: Error, context?: ErrorContext): Promise<void>;
    async captureMessage(
        message: string,
        level: "info" | "warn" | "error",
        context?: ErrorContext,
    ): Promise<void>;

    private async shouldAlert(error: Error): Promise<boolean>;
    private async sendAlert(
        error: Error,
        context?: ErrorContext,
    ): Promise<void>;
    private async logToDatabase(
        error: Error,
        context?: ErrorContext,
    ): Promise<void>;
    private async sendToExternalService(
        error: Error,
        context?: ErrorContext,
    ): Promise<void>;
    private classifyError(error: Error): "low" | "medium" | "high" | "critical";
}
```

#### 3. Performance Monitor

**File**: `src/lib/analytics/performance-monitor.ts`

```typescript
class PerformanceMonitor {
    private timers: Map<string, number> = new Map();

    startTimer(name: string): void;
    endTimer(name: string, metadata?: Record<string, any>): Promise<void>;

    async trackApiCall(
        endpoint: string,
        method: string,
        duration: number,
        statusCode: number,
    ): Promise<void>;
    async trackPageLoad(page: string, duration: number): Promise<void>;
    async trackMigrationPerformance(
        sessionId: string,
        metrics: MigrationMetrics,
    ): Promise<void>;

    async getMetrics(timeRange: string): Promise<PerformanceReport>;
}

interface MigrationMetrics {
    recordsPerSecond: number;
    memoryUsage: number;
    apiCallCount: number;
    totalDuration: number;
    errorRate: number;
}
```

### Client-Side Implementation

#### 1. Analytics Hook

**File**: `src/hooks/useAnalytics.ts`

```typescript
interface AnalyticsConfig {
  enableTracking: boolean;
  sampleRate: number;
  debugMode: boolean;
}

export function useAnalytics(config?: Partial<AnalyticsConfig>) {
  const trackEvent = useCallback(async (event: TrackingEvent) => Promise<void>;
  const trackPageView = useCallback((page: string, metadata?: Record<string, any>) => Promise<void>;
  const trackFeatureUsage = useCallback((feature: string, metadata?: Record<string, any>) => Promise<void>;
  const trackError = useCallback((error: Error, context?: Record<string, any>) => Promise<void>;
  const startPerformanceTimer = useCallback((name: string) => void;
  const endPerformanceTimer = useCallback((name: string, metadata?: Record<string, any>) => Promise<void>;

  return {
    trackEvent,
    trackPageView,
    trackFeatureUsage,
    trackError,
    startPerformanceTimer,
    endPerformanceTimer
  };
}
```

#### 2. Error Boundary Component

**File**: `src/components/providers/ErrorBoundary.tsx`

```typescript
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export class ErrorBoundary
    extends Component<PropsWithChildren, ErrorBoundaryState> {
    constructor(props: PropsWithChildren) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to analytics
        ErrorTracker.getInstance().captureException(error, {
            metadata: { errorInfo, componentStack: errorInfo.componentStack },
        });
    }

    render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} />;
        }

        return this.props.children;
    }
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Priority**: High **Estimated Effort**: 16-20 hours

#### Tasks:

1. **Database Schema Setup** (4 hours)
   - Create Prisma migrations for new tables
   - Update schema.prisma file
   - Run migrations on development environment

2. **Core Analytics Logger** (6 hours)
   - Implement AnalyticsLogger service
   - Add queue-based processing for performance
   - Create database insertion methods
   - Add basic error handling

3. **Basic User Activity Tracking** (4 hours)
   - Track user login/logout
   - Track page navigation
   - Track migration creation/execution
   - Track organisation connections

4. **Client-Side Hook** (3 hours)
   - Create useAnalytics hook
   - Implement basic event tracking
   - Add page view tracking

5. **API Endpoints** (3 hours)
   - Create /api/analytics/track endpoint
   - Add basic validation and sanitisation
   - Implement batch processing

#### Deliverables:

- Database schema updated with analytics tables
- Basic user activity tracking functional
- Analytics API endpoints operational
- Client-side tracking hook available

#### Success Criteria:

- User activities are logged to database
- No performance impact on existing functionality
- Basic analytics data visible in database

### Phase 2: Error Monitoring (Week 3-4)

**Priority**: High **Estimated Effort**: 12-16 hours

#### Tasks:

1. **Error Tracking Service** (5 hours)
   - Implement ErrorTracker class
   - Add error classification logic
   - Create database logging methods
   - Add error aggregation

2. **Error Boundary Components** (3 hours)
   - Create React Error Boundary
   - Add error fallback UI
   - Integrate with error tracking

3. **API Error Middleware** (4 hours)
   - Create analytics middleware for API routes
   - Add automatic error capture
   - Implement performance tracking

4. **Error Dashboard** (4 hours)
   - Create basic error analytics view
   - Add error filtering and search
   - Show error trends and patterns

#### Deliverables:

- Comprehensive error tracking system
- Error boundary components
- Error analytics dashboard
- API error monitoring

#### Success Criteria:

- All application errors are captured and logged
- Error patterns are visible in dashboard
- Critical errors trigger appropriate responses

### Phase 3: Performance Monitoring (Week 5-6)

**Priority**: Medium **Estimated Effort**: 10-14 hours

#### Tasks:

1. **Performance Monitor Service** (4 hours)
   - Implement PerformanceMonitor class
   - Add timer-based tracking
   - Create metrics aggregation

2. **API Performance Tracking** (3 hours)
   - Add performance middleware to all API routes
   - Track response times and throughput
   - Monitor database query performance

3. **Migration Performance Tracking** (4 hours)
   - Add detailed migration metrics
   - Track records per second
   - Monitor memory usage and API calls

4. **Performance Dashboard** (3 hours)
   - Create performance metrics view
   - Add performance trend charts
   - Show bottleneck identification

#### Deliverables:

- Performance monitoring system
- API performance tracking
- Migration performance metrics
- Performance analytics dashboard

#### Success Criteria:

- All API calls are performance monitored
- Migration performance is tracked in detail
- Performance bottlenecks are identifiable

### Phase 4: Enhanced Analytics & Insights (Week 7-8)

**Priority**: Medium **Estimated Effort**: 14-18 hours

#### Tasks:

1. **Feature Usage Tracking** (4 hours)
   - Implement feature usage analytics
   - Add usage pattern analysis
   - Create feature adoption metrics

2. **User Journey Analysis** (5 hours)
   - Track user flow through application
   - Identify drop-off points
   - Create journey visualisation

3. **Advanced Analytics Dashboard** (6 hours)
   - Create comprehensive analytics view
   - Add user segmentation
   - Implement trend analysis
   - Add export functionality

4. **Alerting System** (3 hours)
   - Implement critical error alerting
   - Add performance threshold alerts
   - Create notification system

#### Deliverables:

- Feature usage analytics
- User journey tracking
- Comprehensive analytics dashboard
- Automated alerting system

#### Success Criteria:

- Feature adoption patterns are visible
- User journeys are tracked and analysable
- Critical issues trigger automatic alerts

## Key Metrics to Track

### User Engagement Metrics

- **Daily Active Users (DAU)**: Unique users per day
- **Weekly Active Users (WAU)**: Unique users per week
- **Session Duration**: Average time spent in application
- **Page Views per Session**: Navigation depth
- **Feature Adoption Rate**: Percentage of users using each feature
- **User Retention**: Return user percentage over time

### Application Performance Metrics

- **API Response Times**: Average and 95th percentile response times
- **Error Rates**: Percentage of failed requests by endpoint
- **Migration Success Rate**: Percentage of successful migrations
- **Records per Second**: Migration throughput performance
- **Memory Usage**: Application resource consumption
- **Database Query Performance**: Query execution times

### Business Intelligence Metrics

- **Migration Template Usage**: Most popular templates
- **Organisation Type Analysis**: Usage patterns by org type
- **Common Failure Points**: Where migrations typically fail
- **Support Correlation**: Link between errors and support tickets
- **Feature ROI**: Value delivered by each feature

### User Experience Metrics

- **Error Frequency**: How often users encounter errors
- **Task Completion Rate**: Percentage of successful workflows
- **Drop-off Points**: Where users abandon processes
- **Help Usage**: Documentation and support access patterns
- **User Satisfaction Indicators**: Implicit satisfaction metrics

## Technical Considerations

### Performance Impact

- **Asynchronous Processing**: All analytics logging must be non-blocking
- **Batch Processing**: Group database writes to minimise performance impact
- **Sampling**: Implement sampling for high-volume events
- **Caching**: Cache frequently accessed analytics data

### Data Privacy & Compliance

- **PII Handling**: Ensure no sensitive data is logged inappropriately
- **Data Retention**: Implement automatic data cleanup policies
- **User Consent**: Respect user privacy preferences
- **GDPR Compliance**: Ensure data handling meets regulatory requirements

### Scalability

- **Database Indexing**: Proper indexing for analytics queries
- **Data Archiving**: Move old data to archive storage
- **Query Optimisation**: Efficient analytics query patterns
- **Horizontal Scaling**: Design for future scaling needs

### Security

- **Input Validation**: Sanitise all analytics input data
- **Access Control**: Restrict analytics data access appropriately
- **Audit Trail**: Log access to analytics data
- **Data Encryption**: Encrypt sensitive analytics data

## Success Criteria

### Immediate Success (Phase 1-2)

1. **User Activity Tracking**: All major user actions are logged
2. **Error Monitoring**: All application errors are captured and categorised
3. **Basic Analytics**: Core metrics are available in dashboard
4. **Performance Impact**: <5% performance overhead from analytics

### Medium-term Success (Phase 3-4)

1. **Performance Insights**: Clear visibility into application bottlenecks
2. **User Behaviour Understanding**: Clear patterns in user behaviour
3. **Proactive Issue Detection**: Issues identified before user reports
4. **Feature Usage Insights**: Data-driven feature development decisions

### Long-term Success (3+ months)

1. **Reduced Support Load**: Fewer user-reported issues due to proactive fixes
2. **Improved User Experience**: Higher user satisfaction and retention
3. **Data-Driven Development**: All feature decisions backed by usage data
4. **Operational Excellence**: Minimal unplanned downtime and issues

## Risk Mitigation

### Technical Risks

- **Performance Impact**: Implement asynchronous processing and monitoring
- **Data Volume**: Plan for data growth and implement archiving
- **System Complexity**: Maintain clear separation of concerns
- **Database Load**: Optimise queries and implement proper indexing

### Business Risks

- **Privacy Concerns**: Implement strong privacy controls and transparency
- **Data Accuracy**: Validate analytics data against known benchmarks
- **Over-Engineering**: Focus on high-value metrics first
- **Resource Allocation**: Ensure adequate development and maintenance resources

### Operational Risks

- **Alert Fatigue**: Carefully tune alert thresholds
- **Data Loss**: Implement backup and recovery procedures
- **Access Control**: Secure analytics data appropriately
- **Maintenance Overhead**: Plan for ongoing system maintenance

## Future Enhancements

### Advanced Analytics (6+ months)

- **Machine Learning**: Predictive analytics for user behaviour
- **A/B Testing**: Infrastructure for feature testing
- **Real-time Analytics**: Live dashboard updates
- **Advanced Visualisations**: Interactive charts and graphs

### Integration Opportunities

- **External Analytics**: Integration with Google Analytics, Mixpanel
- **Business Intelligence**: Connection to BI tools like Tableau
- **Customer Support**: Integration with support ticket systems
- **Marketing Tools**: User behaviour data for marketing insights

### Automation

- **Auto-scaling**: Automatic resource scaling based on usage
- **Self-healing**: Automatic recovery from common issues
- **Intelligent Alerting**: ML-based alert prioritisation
- **Automated Reporting**: Scheduled report generation and distribution

## Sentry.io Integration Enhancement

### Overview

Integrating Sentry.io into the proposed analytics and monitoring system would
significantly enhance capabilities while reducing development overhead. Sentry
provides enterprise-grade error tracking, performance monitoring, and alerting
that complements our custom analytics implementation.

### How Sentry Enhances the Solution

#### 1. **Professional Error Tracking & Alerting**

**What Sentry Provides:**

- Real-time error capture with detailed stack traces
- Automatic error grouping and deduplication
- Smart alerting with configurable thresholds
- Integration with Slack, email, PagerDuty, etc.
- Release tracking and error regression detection

**Enhancement to Our Solution:**

```typescript
// Enhanced Error Tracker with Sentry integration
class ErrorTracker {
    async captureException(
        error: Error,
        context?: ErrorContext,
    ): Promise<void> {
        // Log to our custom database for analytics
        await this.logToDatabase(error, context);

        // Send to Sentry for professional error tracking
        Sentry.captureException(error, {
            tags: {
                userId: context?.userId,
                sessionId: context?.sessionId,
                severity: this.classifyError(error),
            },
            extra: context?.metadata,
            user: {
                id: context?.userId,
                ip_address: context?.ip,
            },
        });

        // Check if critical error needs immediate alert
        if (this.isCriticalError(error)) {
            // Sentry handles alerting automatically
            await this.sendInternalAlert(error, context);
        }
    }
}
```

#### 2. **Advanced Performance Monitoring**

**What Sentry Provides:**

- Automatic performance instrumentation for Next.js
- Database query tracking
- API endpoint monitoring
- Frontend performance metrics (LCP, FID, CLS)
- Distributed tracing across services

**Enhancement to Our Solution:**

```typescript
// Enhanced Performance Monitor with Sentry tracing
class PerformanceMonitor {
    async trackMigrationPerformance(
        sessionId: string,
        metrics: MigrationMetrics,
    ): Promise<void> {
        // Log to our database for custom analytics
        await this.logToDatabase(sessionId, metrics);

        // Create Sentry transaction for detailed tracing
        const transaction = Sentry.startTransaction({
            name: "Migration Execution",
            op: "migration.execute",
            tags: {
                sessionId,
                recordCount: metrics.totalRecords,
            },
        });

        // Add spans for different migration phases
        const extractSpan = transaction.startChild({
            op: "migration.extract",
            description: "Data Extraction",
        });

        const transformSpan = transaction.startChild({
            op: "migration.transform",
            description: "Data Transformation",
        });

        const loadSpan = transaction.startChild({
            op: "migration.load",
            description: "Data Loading",
        });

        // Set performance metrics
        transaction.setMeasurement(
            "records_per_second",
            metrics.recordsPerSecond,
        );
        transaction.setMeasurement(
            "memory_usage_mb",
            metrics.memoryUsage / 1024 / 1024,
        );
        transaction.setMeasurement("api_calls", metrics.apiCallCount);

        transaction.finish();
    }
}
```

#### 3. **Session Replay for User Journey Analysis**

**What Sentry Provides:**

- Video-like recordings of user sessions
- Automatic capture of user interactions
- Error correlation with user actions
- Privacy controls for sensitive data

**Enhancement to Our Solution:**

```typescript
// Enhanced Analytics Logger with Session Replay context
class AnalyticsLogger {
    async logUserActivity(event: LogEvent): Promise<void> {
        // Log to our database for custom analytics
        await this.logToDatabase(event);

        // Add breadcrumb to Sentry for session replay context
        Sentry.addBreadcrumb({
            message: event.action,
            category: event.resourceType || "user_action",
            level: "info",
            data: {
                resourceId: event.resourceId,
                duration: event.duration,
                ...event.metadata,
            },
        });

        // Set user context for better error correlation
        Sentry.setUser({
            id: event.userId,
            segment: await this.getUserSegment(event.userId),
        });
    }
}
```

#### 4. **Cron Job Monitoring**

**What Sentry Provides:**

- Automatic detection of missed cron jobs
- Performance tracking for scheduled tasks
- Alerting for failed background jobs

**Enhancement for Scheduled Migrations:**

```typescript
// Enhanced scheduled migration monitoring
async function executeScheduledMigration(migrationId: string) {
    const checkInId = Sentry.captureCheckIn({
        monitorSlug: `migration-${migrationId}`,
        status: "in_progress",
    });

    try {
        await runMigration(migrationId);

        Sentry.captureCheckIn({
            checkInId,
            monitorSlug: `migration-${migrationId}`,
            status: "ok",
        });
    } catch (error) {
        Sentry.captureCheckIn({
            checkInId,
            monitorSlug: `migration-${migrationId}`,
            status: "error",
        });

        throw error;
    }
}
```

### Implementation Strategy

#### Phase 1: Sentry Foundation (Week 1)

**Estimated Effort**: 4-6 hours

1. **Install and Configure Sentry** (2 hours)
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```

2. **Basic Error Tracking** (2 hours)
   - Configure Sentry in `sentry.client.config.js` and `sentry.server.config.js`
   - Add error boundaries with Sentry integration
   - Set up basic alerting rules

3. **Performance Monitoring Setup** (2 hours)
   - Enable tracing for API routes
   - Configure performance thresholds
   - Set up release tracking

#### Phase 2: Enhanced Integration (Week 2-3)

**Estimated Effort**: 8-10 hours

1. **Custom Context Integration** (4 hours)
   - Enhance error tracker to use both custom DB and Sentry
   - Add user context and custom tags
   - Implement error classification

2. **Performance Tracing** (3 hours)
   - Add custom spans for migration operations
   - Track Salesforce API performance
   - Monitor database query performance

3. **Session Replay Configuration** (3 hours)
   - Enable session replay with privacy controls
   - Configure sampling rates
   - Set up user journey tracking

#### Phase 3: Advanced Features (Week 4)

**Estimated Effort**: 6-8 hours

1. **Cron Monitoring** (3 hours)
   - Set up check-ins for scheduled migrations
   - Configure alerting for missed jobs
   - Add performance tracking

2. **Custom Dashboards** (3 hours)
   - Create Sentry dashboards for migration metrics
   - Set up custom alerts for business logic
   - Configure team notifications

3. **Release Tracking** (2 hours)
   - Integrate with deployment pipeline
   - Track error rates by release
   - Set up regression detection

### Benefits of Sentry Integration

#### Immediate Benefits

1. **Reduced Development Time**: 60-70% less code needed for error tracking
2. **Professional Alerting**: Enterprise-grade notification system
3. **Better Debugging**: Source map support and detailed stack traces
4. **User Context**: Automatic user session correlation

#### Long-term Benefits

1. **Scalability**: Handles high-volume error tracking automatically
2. **Team Collaboration**: Built-in assignment and workflow features
3. **Compliance**: SOC 2 Type II certified infrastructure
4. **Integration Ecosystem**: 100+ integrations with other tools

### Cost Considerations

#### Sentry Pricing (2024)

- **Developer Plan**: Free up to 5,000 errors/month
- **Team Plan**: $26/month for 50,000 errors/month
- **Organization Plan**: $80/month for 200,000 errors/month

#### Cost-Benefit Analysis

- **Development Time Saved**: 40-60 hours (£2,000-£3,000 value)
- **Faster Issue Resolution**: 50-70% reduction in debugging time
- **Reduced Downtime**: Proactive alerting prevents extended outages
- **ROI**: Typically 300-500% within first year

### Hybrid Architecture

#### Custom Analytics + Sentry

```typescript
interface HybridAnalyticsConfig {
    enableSentry: boolean;
    sentryDsn: string;
    customAnalytics: boolean;
    dataRetention: {
        sentry: "90d";
        custom: "2y";
    };
    sampling: {
        errors: 1.0; // Send all errors to Sentry
        performance: 0.1; // Sample 10% of performance data
        analytics: 1.0; // Log all user activities to custom DB
    };
}

class HybridAnalyticsLogger {
    async logError(error: Error, context?: ErrorContext): Promise<void> {
        // Always log to Sentry for immediate alerting and debugging
        if (this.config.enableSentry) {
            await this.sentryLogger.captureException(error, context);
        }

        // Log to custom DB for long-term analytics and business intelligence
        if (this.config.customAnalytics) {
            await this.customLogger.logError(error, context);
        }
    }

    async logPerformance(event: PerformanceEvent): Promise<void> {
        // Send to Sentry with sampling for performance monitoring
        if (this.config.enableSentry && this.shouldSample("performance")) {
            await this.sentryLogger.logPerformance(event);
        }

        // Always log to custom DB for detailed analytics
        await this.customLogger.logPerformance(event);
    }
}
```

### Migration Path

#### Existing Custom Solution → Hybrid Approach

1. **Week 1**: Add Sentry alongside existing error tracking
2. **Week 2**: Migrate critical error alerting to Sentry
3. **Week 3**: Add performance monitoring and session replay
4. **Week 4**: Optimise custom analytics for business intelligence focus

#### Recommended Final Architecture

- **Sentry**: Real-time error tracking, alerting, performance monitoring,
  session replay
- **Custom Analytics**: User behaviour analysis, business intelligence,
  long-term trends
- **Database**: Historical data, custom metrics, compliance requirements

### Conclusion

Integrating Sentry.io would transform the proposed analytics solution from a
custom-built system into a hybrid approach that combines:

- **Professional-grade error tracking** (Sentry)
- **Custom business analytics** (Our implementation)
- **Reduced development overhead** (60-70% less code)
- **Enterprise reliability** (Sentry's infrastructure)
- **Tailored insights** (Custom analytics for business needs)

This hybrid approach provides the best of both worlds: immediate professional
monitoring capabilities with Sentry, plus custom analytics tailored to the
specific needs of the TC9 Migration Tool.

## High-Impact Minimal Implementation Plan

### Overview

This distilled approach focuses on maximum insight with minimal codebase
changes, targeting the highest-value monitoring capabilities that can be
implemented quickly without disrupting existing functionality.

### Core Strategy: Sentry + Lightweight Custom Tracking

**Why This Approach:**

- 80% of monitoring value with 20% of the implementation effort
- Minimal risk to existing codebase
- Immediate professional-grade error tracking
- Quick wins that demonstrate value

### Phase 1: Immediate Impact (Week 1 - 4 hours)

#### 1. Sentry Setup (2 hours)

```bash
# Install Sentry
npx @sentry/wizard@latest -i nextjs
```

**Configuration:**

```typescript
// sentry.client.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% performance sampling
    replaysSessionSampleRate: 0.1, // 10% session replay
    replaysOnErrorSampleRate: 1.0, // 100% replay on errors
});

// sentry.server.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
});
```

#### 2. Critical Error Boundaries (1 hour)

```typescript
// src/components/providers/ErrorBoundary.tsx
"use client";
import * as Sentry from "@sentry/nextjs";
import { ErrorBoundary as SentryErrorBoundary } from "@sentry/react";

export function GlobalErrorBoundary(
    { children }: { children: React.ReactNode },
) {
    return (
        <SentryErrorBoundary
            fallback={({ error, resetError }) => (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold mb-4">
                            Something went wrong
                        </h2>
                        <button
                            onClick={resetError}
                            className="btn btn-primary"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}
            beforeCapture={(scope, error, errorInfo) => {
                scope.setTag("errorBoundary", true);
                scope.setContext("errorInfo", errorInfo);
            }}
        >
            {children}
        </SentryErrorBoundary>
    );
}
```

#### 3. Migration Context Enhancement (1 hour)

```typescript
// Add to existing migration execution code
// src/app/api/migrations/[id]/execute/route.ts

import * as Sentry from "@sentry/nextjs";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    const migrationId = params.id;

    // Set Sentry context for this migration
    Sentry.setTag("migration.id", migrationId);
    Sentry.setTag("operation", "migration.execute");

    try {
        // Existing migration code...
        const result = await executeMigration(migrationId);

        // Log success metrics
        Sentry.setMeasurement(
            "migration.records_processed",
            result.totalRecords,
        );
        Sentry.setMeasurement("migration.success_rate", result.successRate);

        return NextResponse.json(result);
    } catch (error) {
        // Enhanced error context
        Sentry.setContext("migration", {
            id: migrationId,
            phase: "execution",
            recordsProcessed: session?.processed_records || 0,
        });

        Sentry.captureException(error);
        throw error;
    }
}
```

**Immediate Benefits:**

- All errors automatically captured with context
- Session replay for debugging user issues
- Performance monitoring for API routes
- Zero changes to existing business logic

### Phase 2: Strategic Enhancements (Week 2 - 3 hours)

#### 1. User Context Middleware (1 hour)

```typescript
// src/middleware/sentry-context.ts
import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";

export async function setSentryUserContext(request: NextRequest) {
    const session = await getServerSession();

    if (session?.user) {
        Sentry.setUser({
            id: session.user.id,
            email: session.user.email,
            username: session.user.name,
        });

        // Add organisation context
        if (session.user.salesforceOrgId) {
            Sentry.setTag("org.salesforce_id", session.user.salesforceOrgId);
            Sentry.setTag("org.type", "salesforce"); // or determine from data
        }
    }
}
```

#### 2. Critical Path Monitoring (2 hours)

```typescript
// Add to key user actions with minimal code changes

// Migration creation
export async function createMigration(data: MigrationData) {
    return Sentry.startSpan(
        { name: "Create Migration", op: "migration.create" },
        async () => {
            Sentry.setTag("migration.source_org", data.sourceOrgId);
            Sentry.setTag("migration.target_org", data.targetOrgId);

            // Existing code unchanged
            return await prisma.migration_projects.create({ data });
        },
    );
}

// Salesforce connection
export async function connectSalesforceOrg(orgData: OrgData) {
    return Sentry.startSpan(
        { name: "Connect Salesforce Org", op: "salesforce.connect" },
        async () => {
            Sentry.setTag("org.type", orgData.type);

            // Existing code unchanged
            return await createOrganisation(orgData);
        },
    );
}
```

**Benefits:**

- User-specific error tracking
- Performance monitoring for critical paths
- Minimal code changes (wrapper functions)

### Phase 3: Business Intelligence (Week 3 - 2 hours)

#### 1. Simple Analytics Hook (1 hour)

```typescript
// src/hooks/useSimpleAnalytics.ts
import * as Sentry from "@sentry/nextjs";

export function useSimpleAnalytics() {
    const trackFeatureUsage = (
        feature: string,
        metadata?: Record<string, any>,
    ) => {
        Sentry.addBreadcrumb({
            message: `Feature used: ${feature}`,
            category: "user_action",
            data: metadata,
        });
    };

    const trackMigrationStep = (step: string, migrationId: string) => {
        Sentry.addBreadcrumb({
            message: `Migration step: ${step}`,
            category: "migration_flow",
            data: { migrationId, step },
        });
    };

    return { trackFeatureUsage, trackMigrationStep };
}
```

#### 2. Key Metrics Dashboard (1 hour)

```typescript
// Add to existing analytics API
// src/app/api/analytics/migrations/route.ts

// Enhance existing response with Sentry data correlation
const enhancedAnalytics = {
    ...existingAnalytics,
    errorInsights: {
        topErrors: "View in Sentry Dashboard",
        sentryProjectUrl: process.env.SENTRY_PROJECT_URL,
    },
};
```

**Benefits:**

- User journey tracking
- Feature usage insights
- Integration with existing analytics

### Implementation Checklist

#### Week 1: Foundation (4 hours total)

- [ ] Install Sentry via wizard (30 mins)
- [ ] Configure environment variables (15 mins)
- [ ] Add error boundary to root layout (30 mins)
- [ ] Enhance migration API with Sentry context (1 hour)
- [ ] Test error capture and alerts (45 mins)
- [ ] Configure Slack/email notifications (30 mins)

#### Week 2: Enhancement (3 hours total)

- [ ] Add user context middleware (1 hour)
- [ ] Wrap critical functions with performance monitoring (1.5 hours)
- [ ] Test performance tracking (30 mins)

#### Week 3: Intelligence (2 hours total)

- [ ] Create simple analytics hook (45 mins)
- [ ] Add feature usage tracking to key components (45 mins)
- [ ] Enhance analytics dashboard (30 mins)

### Environment Variables Required

```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_PROJECT_URL=https://sentry.io/organizations/your-org/projects/your-project/
```

### Expected Outcomes

#### Immediate (Week 1)

- **100% error capture** with detailed context
- **Automatic alerting** for critical issues
- **Session replay** for debugging user problems
- **Performance baseline** established

#### Short-term (Week 2-3)

- **User-specific error tracking** and context
- **Performance monitoring** for critical paths
- **Feature usage insights** via breadcrumbs
- **Proactive issue detection**

#### Long-term (Month 2+)

- **50-70% reduction** in debugging time
- **Proactive issue resolution** before user reports
- **Data-driven feature decisions**
- **Improved user experience** through faster fixes

### Cost Analysis

- **Development time**: 9 hours total
- **Sentry cost**: Free tier (5,000 errors/month) initially
- **Maintenance**: <1 hour/month
- **ROI**: 300-500% within 3 months

### Risk Mitigation

- **Zero breaking changes** to existing code
- **Gradual rollout** with feature flags
- **Fallback mechanisms** for Sentry failures
- **Privacy controls** for sensitive data

### Success Metrics

- **Error detection time**: <5 minutes (vs hours/days currently)
- **Issue resolution time**: 50% reduction
- **User satisfaction**: Measured via reduced support tickets
- **Developer productivity**: Faster debugging and fewer interruptions

This approach gives you enterprise-grade monitoring with minimal risk and
maximum immediate value. The entire implementation can be done incrementally
without disrupting existing functionality.

## Conclusion

This comprehensive analytics and monitoring system will provide unprecedented
visibility into the TC9 Migration Tool's usage patterns, performance
characteristics, and user experience. The phased implementation approach ensures
that high-value insights are delivered quickly while building a foundation for
advanced analytics capabilities.

The system is designed to be:

- **Non-intrusive**: Minimal impact on existing functionality
- **Scalable**: Capable of growing with the application
- **Actionable**: Providing insights that drive development decisions
- **Maintainable**: Clear architecture and separation of concerns

Success will be measured by improved user experience, reduced support load, and
data-driven development decisions that enhance the value delivered to users.
