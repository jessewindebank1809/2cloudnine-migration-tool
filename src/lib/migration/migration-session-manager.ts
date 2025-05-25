import { prisma } from '@/lib/database/prisma';
import { 
  MigrationProject, 
  MigrationSession, 
  SessionStatus, 
  RecordStatus,
  Organisation
} from '@prisma/client';
import { EventEmitter } from 'events';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { FieldMappingEngine } from './field-mapping-engine';

export interface MigrationProgress {
  sessionId: string;
  status: SessionStatus;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  currentBatch?: number;
  totalBatches?: number;
}

export interface MigrationError {
  timestamp: Date;
  recordId?: string;
  error: string;
  details?: any;
}

export class MigrationSessionManager extends EventEmitter {
  private activeSession: MigrationSession | null = null;
  private startTime: Date | null = null;
  private fieldMappingEngine = new FieldMappingEngine();

  /**
   * Create a new migration session
   */
  async createSession(projectId: string, objectType: string): Promise<MigrationSession> {
    // Get project with orgs
    const project = await prisma.migrationProject.findUnique({
      where: { id: projectId },
      include: {
        sourceOrg: true,
        targetOrg: true,
      }
    });

    if (!project) {
      throw new Error('Migration project not found');
    }

    // Verify org health
    const [sourceHealth, targetHealth] = await Promise.all([
      sessionManager.getHealthStatus(project.sourceOrgId),
      sessionManager.getHealthStatus(project.targetOrgId),
    ]);

    if (!sourceHealth.isHealthy) {
      throw new Error(`Source org is not healthy: ${sourceHealth.details.error || 'Unknown error'}`);
    }

    if (!targetHealth.isHealthy) {
      throw new Error(`Target org is not healthy: ${targetHealth.details.error || 'Unknown error'}`);
    }

    // Create migration session
    const session = await prisma.migrationSession.create({
      data: {
        projectId,
        objectType,
        status: SessionStatus.PENDING,
      }
    });

    this.activeSession = session;
    this.startTime = new Date();
    
    // Emit session created event
    this.emit('sessionCreated', session);

    return session;
  }

  /**
   * Start the migration session
   */
  async startSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (session.status !== SessionStatus.PENDING) {
      throw new Error(`Cannot start session in ${session.status} status`);
    }

    // Update session status
    await this.updateSessionStatus(sessionId, SessionStatus.RUNNING);
    
    // Emit session started event
    this.emit('sessionStarted', session);
  }

  /**
   * Update session progress
   */
  async updateProgress(
    sessionId: string, 
    progress: Partial<MigrationProgress>
  ): Promise<void> {
    const session = await prisma.migrationSession.update({
      where: { id: sessionId },
      data: {
        totalRecords: progress.totalRecords,
        processedRecords: progress.processedRecords,
        successfulRecords: progress.successfulRecords,
        failedRecords: progress.failedRecords,
      }
    });

    // Calculate percentage and time remaining
    const percentComplete = session.totalRecords > 0 
      ? Math.round((session.processedRecords / session.totalRecords) * 100)
      : 0;

    const estimatedTimeRemaining = this.calculateTimeRemaining(session);

    const fullProgress: MigrationProgress = {
      sessionId: session.id,
      status: session.status,
      totalRecords: session.totalRecords,
      processedRecords: session.processedRecords,
      successfulRecords: session.successfulRecords,
      failedRecords: session.failedRecords,
      percentComplete,
      estimatedTimeRemaining,
      currentBatch: progress.currentBatch,
      totalBatches: progress.totalBatches,
    };

    // Emit progress event
    this.emit('progress', fullProgress);
  }

  /**
   * Record a successful migration
   */
  async recordSuccess(
    sessionId: string,
    sourceRecordId: string,
    targetRecordId: string,
    recordData: any
  ): Promise<void> {
    await prisma.migrationRecord.create({
      data: {
        sessionId,
        sourceRecordId,
        targetRecordId,
        objectType: this.activeSession?.objectType || '',
        status: RecordStatus.SUCCESS,
        recordData,
      }
    });

    // Update session counters
    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: {
        processedRecords: { increment: 1 },
        successfulRecords: { increment: 1 },
      }
    });
  }

  /**
   * Record a failed migration
   */
  async recordFailure(
    sessionId: string,
    sourceRecordId: string,
    error: string,
    recordData: any
  ): Promise<void> {
    // Create migration record
    await prisma.migrationRecord.create({
      data: {
        sessionId,
        sourceRecordId,
        objectType: this.activeSession?.objectType || '',
        status: RecordStatus.FAILED,
        errorMessage: error,
        recordData,
      }
    });

    // Update session counters
    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: {
        processedRecords: { increment: 1 },
        failedRecords: { increment: 1 },
      }
    });

    // Add to error log
    await this.addError(sessionId, {
      timestamp: new Date(),
      recordId: sourceRecordId,
      error,
      details: recordData,
    });
  }

  /**
   * Add error to session log
   */
  async addError(sessionId: string, error: MigrationError): Promise<void> {
    const session = await this.getSession(sessionId);
    
    const errorLog = session.errorLog as any[] || [];
    errorLog.push(error);

    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: { errorLog }
    });

    // Emit error event
    this.emit('error', { sessionId, error });
  }

  /**
   * Complete the migration session
   */
  async completeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    const status = session.failedRecords > 0 
      ? SessionStatus.COMPLETED 
      : SessionStatus.COMPLETED;

    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: {
        status,
        completedAt: new Date(),
      }
    });

    // Generate summary
    const summary = await this.generateSummary(sessionId);
    
    // Emit completion event
    this.emit('sessionCompleted', { session, summary });
  }

  /**
   * Fail the migration session
   */
  async failSession(sessionId: string, error: string): Promise<void> {
    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.FAILED,
        completedAt: new Date(),
      }
    });

    await this.addError(sessionId, {
      timestamp: new Date(),
      error,
    });

    // Emit failure event
    this.emit('sessionFailed', { sessionId, error });
  }

  /**
   * Cancel the migration session
   */
  async cancelSession(sessionId: string): Promise<void> {
    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CANCELLED,
        completedAt: new Date(),
      }
    });

    // Emit cancellation event
    this.emit('sessionCancelled', { sessionId });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<MigrationSession> {
    const session = await prisma.migrationSession.findUnique({
      where: { id: sessionId },
      include: {
        project: {
          include: {
            sourceOrg: true,
            targetOrg: true,
          }
        }
      }
    });

    if (!session) {
      throw new Error('Migration session not found');
    }

    return session;
  }

  /**
   * Get session progress
   */
  async getProgress(sessionId: string): Promise<MigrationProgress> {
    const session = await this.getSession(sessionId);
    
    const percentComplete = session.totalRecords > 0 
      ? Math.round((session.processedRecords / session.totalRecords) * 100)
      : 0;

    return {
      sessionId: session.id,
      status: session.status,
      totalRecords: session.totalRecords,
      processedRecords: session.processedRecords,
      successfulRecords: session.successfulRecords,
      failedRecords: session.failedRecords,
      percentComplete,
      estimatedTimeRemaining: this.calculateTimeRemaining(session),
    };
  }

  /**
   * Get failed records for retry
   */
  async getFailedRecords(sessionId: string): Promise<any[]> {
    const records = await prisma.migrationRecord.findMany({
      where: {
        sessionId,
        status: RecordStatus.FAILED,
      }
    });

    return records;
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(
    sessionId: string, 
    status: SessionStatus
  ): Promise<void> {
    await prisma.migrationSession.update({
      where: { id: sessionId },
      data: { 
        status,
        startedAt: status === SessionStatus.RUNNING ? new Date() : undefined,
      }
    });
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateTimeRemaining(session: MigrationSession): number | undefined {
    if (!this.startTime || session.processedRecords === 0) {
      return undefined;
    }

    const elapsedMs = Date.now() - this.startTime.getTime();
    const recordsPerMs = session.processedRecords / elapsedMs;
    const remainingRecords = session.totalRecords - session.processedRecords;
    
    return Math.round(remainingRecords / recordsPerMs);
  }

  /**
   * Generate migration summary
   */
  private async generateSummary(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    const records = await prisma.migrationRecord.findMany({
      where: { sessionId },
      select: {
        status: true,
        createdAt: true,
      }
    });

    const duration = session.completedAt && session.startedAt
      ? session.completedAt.getTime() - session.startedAt.getTime()
      : 0;

    return {
      sessionId,
      objectType: session.objectType,
      status: session.status,
      duration,
      totalRecords: session.totalRecords,
      successfulRecords: session.successfulRecords,
      failedRecords: session.failedRecords,
      successRate: session.totalRecords > 0 
        ? Math.round((session.successfulRecords / session.totalRecords) * 100)
        : 0,
      recordsPerSecond: duration > 0 
        ? Math.round(session.processedRecords / (duration / 1000))
        : 0,
    };
  }
}

// Export singleton instance
export const migrationSessionManager = new MigrationSessionManager(); 