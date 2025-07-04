/**
 * Migration execution specific types
 */

import { MigrationError } from './migration';

// Step execution result
export interface StepExecutionResult {
  stepName: string;
  status: 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors?: StepExecutionError[];
  duration?: number;
}

// Step execution error
export interface StepExecutionError {
  recordId: string;
  error: string;
  errorCode?: string;
  field?: string;
  invalidValue?: string;
  retryable: boolean;
  technicalDetails?: {
    stackTrace?: string;
    originalError?: unknown;
  };
}

// Technical error details
export interface TechnicalErrorDetails {
  stepName: string;
  recordId: string;
  error: string;
  errorCode?: string;
  field?: string;
  invalidValue?: string;
  retryable: boolean;
  missingFields?: string[];
  validationRule?: string;
  breakpointName?: string;
  technicalDetails?: {
    stackTrace?: string;
    originalError?: unknown;
  };
}

// Migration execution result
export interface MigrationExecutionResult {
  migrationId: string;
  sessionId: string;
  status: 'completed' | 'failed' | 'partial';
  startTime: Date;
  endTime: Date;
  duration: number;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  stepResults: StepExecutionResult[];
  recordMappings?: Record<string, string>;
  error?: string;
}

// Record processing result
export interface RecordProcessingResult {
  sourceId: string;
  targetId?: string;
  status: 'success' | 'failed';
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

// Batch processing result for migrations
export interface MigrationBatchResult {
  batchId: string;
  batchNumber: number;
  totalBatches: number;
  status: 'success' | 'failed' | 'partial';
  records: RecordProcessingResult[];
  startTime: Date;
  endTime: Date;
  retryCount?: number;
}

// Unique error summary
export interface UniqueErrorSummary {
  type: string;
  count: number;
  examples: string[];
  firstOccurrence?: string;
  affectedFields?: string[];
}

// Migration session details
export interface MigrationSessionDetails {
  id: string;
  migrationId: string;
  userId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  lastActivity: Date;
  progress: {
    currentStep: string;
    currentStepProgress: number;
    overallProgress: number;
    recordsProcessed: number;
    totalRecords: number;
  };
  metadata?: Record<string, unknown>;
}

// Type guards
export function isStepExecutionError(obj: unknown): obj is StepExecutionError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'recordId' in obj &&
    'error' in obj &&
    'retryable' in obj
  );
}

export function isRecordProcessingResult(obj: unknown): obj is RecordProcessingResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sourceId' in obj &&
    'status' in obj
  );
}