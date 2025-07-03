import { prisma } from '@/lib/database/prisma';
import { 
  migration_projects, 
  migration_sessions, 
  session_status, 
  record_status,
  organisations
} from '@prisma/client';
import { EventEmitter } from 'events';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { FieldMappingEngine } from './field-mapping-engine';
import crypto from 'crypto';

export interface MigrationProgress {
  sessionId: string;
  status: session_status;
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
  private activeSession: migration_sessions | null = null;
  private startTime: Date | null = null;
  private fieldMappingEngine = new FieldMappingEngine();

  /**
   * Create a new migration session
   */
  async createSession(projectId: string, objectType: string): Promise<migration_sessions> {
    // Get project with orgs
    const project = await prisma.migration_projects.findUnique({
      where: { id: projectId },
      include: {
        organisations_migration_projects_source_org_idToorganisations: true,
        organisations_migration_projects_target_org_idToorganisations: true,
      }
    });

    if (!project) {
      throw new Error('Migration project not found');
    }

    // Verify org health
    const [sourceHealth, targetHealth] = await Promise.all([
      sessionManager.getHealthStatus(project.source_org_id),
      sessionManager.getHealthStatus(project.target_org_id),
    ]);

    if (!sourceHealth.isHealthy) {
      throw new Error(`Source org is not healthy: ${sourceHealth.details.error || 'Unknown error'}`);
    }

    if (!targetHealth.isHealthy) {
      throw new Error(`Target org is not healthy: ${targetHealth.details.error || 'Unknown error'}`);
    }

    // Create migration session
    const session = await prisma.migration_sessions.create({
      data: {
        id: crypto.randomUUID(),
        project_id: projectId,
        object_type: objectType,
        status: 'PENDING',
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
    
    if (session.status !== 'PENDING') {
      throw new Error(`Cannot start session in ${session.status} status`);
    }

    // Update session status
    await this.updateSessionStatus(sessionId, 'RUNNING');
    
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
    const session = await prisma.migration_sessions.update({
      where: { id: sessionId },
      data: {
        total_records: progress.totalRecords,
        processed_records: progress.processedRecords,
        successful_records: progress.successfulRecords,
        failed_records: progress.failedRecords,
      }
    });

    // Calculate percentage and time remaining
    const percentComplete = session.total_records > 0 
      ? Math.round((session.processed_records / session.total_records) * 100)
      : 0;

    const estimatedTimeRemaining = this.calculateTimeRemaining(session);

    const fullProgress: MigrationProgress = {
      sessionId: session.id,
      status: session.status,
      totalRecords: session.total_records,
      processedRecords: session.processed_records,
      successfulRecords: session.successful_records,
      failedRecords: session.failed_records,
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
    await prisma.$transaction(async (tx) => {
      await tx.migration_records.create({
        data: {
          id: crypto.randomUUID(),
          session_id: sessionId,
          source_record_id: sourceRecordId,
          target_record_id: targetRecordId,
          object_type: this.activeSession?.object_type || '',
          status: 'SUCCESS',
          record_data: recordData,
        }
      });

      // Update session counters
      await tx.migration_sessions.update({
        where: { id: sessionId },
        data: {
          processed_records: { increment: 1 },
          successful_records: { increment: 1 },
        }
      });
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
    await prisma.$transaction(async (tx) => {
      // Create migration record
      await tx.migration_records.create({
        data: {
          id: crypto.randomUUID(),
          session_id: sessionId,
          source_record_id: sourceRecordId,
          object_type: this.activeSession?.object_type || '',
          status: 'FAILED',
          error_message: error,
          record_data: recordData,
        }
      });

      // Update session counters
      await tx.migration_sessions.update({
        where: { id: sessionId },
        data: {
          processed_records: { increment: 1 },
          failed_records: { increment: 1 },
        }
      });
    });
  }

  /**
   * Add error to session log
   */
  async addError(sessionId: string, error: MigrationError): Promise<void> {
    const session = await this.getSession(sessionId);
    const currentErrors = Array.isArray(session.error_log) ? session.error_log : [];
    
    await prisma.migration_sessions.update({
      where: { id: sessionId },
      data: {
        error_log: [
          ...currentErrors,
          {
            timestamp: error.timestamp.toISOString(),
            recordId: error.recordId,
            error: error.error,
            details: error.details,
          }
        ]
      }
    });
  }

  /**
   * Complete the migration session
   */
  async completeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (session.status !== 'RUNNING') {
      throw new Error(`Cannot complete session in ${session.status} status`);
    }

    // Update session status and completion time
    await prisma.migration_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
      }
    });

    // Generate summary
    const summary = await this.generateSummary(sessionId);
    
    // Emit completion event
    this.emit('sessionCompleted', { sessionId, summary });
    
    // Clear active session
    this.activeSession = null;
    this.startTime = null;
  }

  /**
   * Fail the migration session
   */
  async failSession(sessionId: string, error: string): Promise<void> {
    await prisma.migration_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        completed_at: new Date(),
        error_log: {
          push: {
            timestamp: new Date().toISOString(),
            error,
          }
        }
      }
    });

    // Emit failure event
    this.emit('sessionFailed', { sessionId, error });
    
    // Clear active session
    this.activeSession = null;
    this.startTime = null;
  }

  /**
   * Cancel the migration session
   */
  async cancelSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'CANCELLED');
    
    // Emit cancellation event
    this.emit('sessionCancelled', { sessionId });
    
    // Clear active session
    this.activeSession = null;
    this.startTime = null;
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<migration_sessions> {
    const session = await prisma.migration_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Migration session not found');
    }

    return session;
  }

  /**
   * Get current progress
   */
  async getProgress(sessionId: string): Promise<MigrationProgress> {
    const session = await this.getSession(sessionId);
    
    const percentComplete = session.total_records > 0 
      ? Math.round((session.processed_records / session.total_records) * 100)
      : 0;

    const estimatedTimeRemaining = this.calculateTimeRemaining(session);

    return {
      sessionId: session.id,
      status: session.status,
      totalRecords: session.total_records,
      processedRecords: session.processed_records,
      successfulRecords: session.successful_records,
      failedRecords: session.failed_records,
      percentComplete,
      estimatedTimeRemaining,
    };
  }

  /**
   * Get failed records for retry
   */
  async getFailedRecords(sessionId: string): Promise<any[]> {
    const records = await prisma.migration_records.findMany({
      where: {
        session_id: sessionId,
        status: 'FAILED',
      }
    });

    return records;
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(
    sessionId: string, 
    status: session_status
  ): Promise<void> {
    await prisma.migration_sessions.update({
      where: { id: sessionId },
      data: { 
        status,
        started_at: status === 'RUNNING' ? new Date() : undefined,
      }
    });
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateTimeRemaining(session: migration_sessions): number | undefined {
    if (!this.startTime || session.processed_records === 0) {
      return undefined;
    }

    const elapsed = Date.now() - this.startTime.getTime();
    const rate = session.processed_records / elapsed; // records per ms
    const remaining = session.total_records - session.processed_records;
    
    return remaining / rate; // ms remaining
  }

  /**
   * Generate migration summary
   */
  private async generateSummary(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    const records = await prisma.migration_records.findMany({
      where: { session_id: sessionId }
    });

    return {
      sessionId,
      objectType: session.object_type,
      totalRecords: session.total_records,
      successfulRecords: session.successful_records,
      failedRecords: session.failed_records,
      duration: session.completed_at && session.started_at
        ? session.completed_at.getTime() - session.started_at.getTime()
        : 0,
      errors: session.error_log,
    };
  }
}

// Export singleton instance
export const migrationSessionManager = new MigrationSessionManager(); 