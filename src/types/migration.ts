/**
 * Migration-specific type definitions
 */

import { SalesforceRecord, SalesforceBatchResult } from './salesforce';

// Migration status types
export type MigrationStatus = 
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

// Migration operation types
export type MigrationOperation = 'insert' | 'update' | 'upsert' | 'delete';

// Migration step status
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Base migration result
export interface MigrationResult {
  success: boolean;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: MigrationError[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

// Migration error
export interface MigrationError {
  recordId?: string;
  errorCode: string;
  message: string;
  field?: string;
  stackTrace?: string;
  timestamp: Date;
}

// Migration record mapping
export interface MigrationRecordMapping {
  sourceId: string;
  targetId?: string;
  status: 'pending' | 'success' | 'failed';
  error?: MigrationError;
}

// Migration validation result
export interface MigrationValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}

export interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  field?: string;
  recordId?: string;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  field?: string;
  recordId?: string;
  suggestion?: string;
}

export interface ValidationInfo {
  type: 'info';
  code: string;
  message: string;
  field?: string;
  recordId?: string;
}

// Transform function types
export type TransformFunction<TSource = unknown, TTarget = unknown> = (
  value: TSource,
  record: SalesforceRecord,
  context: TransformContext
) => TTarget;

export interface TransformContext {
  sourceOrgId: string;
  targetOrgId: string;
  userId: string;
  migrationId: string;
  metadata?: Record<string, unknown>;
}

// Field mapping configuration
export interface FieldMappingConfig {
  sourceField: string;
  targetField: string;
  required?: boolean;
  defaultValue?: unknown;
  transform?: string | TransformFunction;
  validation?: FieldValidation;
}

export interface FieldValidation {
  type: 'regex' | 'length' | 'range' | 'picklist' | 'custom';
  pattern?: string;
  min?: number;
  max?: number;
  values?: string[];
  customValidator?: (value: unknown) => boolean;
  errorMessage?: string;
}

// Batch processing types
export interface BatchConfig {
  size: number;
  parallel?: boolean;
  maxConcurrent?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface BatchResult {
  batchNumber: number;
  totalBatches: number;
  recordsInBatch: number;
  successCount: number;
  failureCount: number;
  results: SalesforceBatchResult[];
  startTime: Date;
  endTime: Date;
}

// Progress tracking
export interface MigrationProgress {
  currentStep: string;
  currentStepProgress: number;
  totalSteps: number;
  overallProgress: number;
  estimatedTimeRemaining?: number;
  currentBatch?: number;
  totalBatches?: number;
  recordsProcessed: number;
  totalRecords: number;
}

// Session types
export interface MigrationSession {
  id: string;
  migrationId: string;
  status: MigrationStatus;
  startTime: Date;
  endTime?: Date;
  progress: MigrationProgress;
  results?: MigrationResult;
  error?: MigrationError;
}

// Query builder types
export interface QueryFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte';
  value: unknown;
  type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface QueryOptions {
  fields: string[];
  filters?: QueryFilter[];
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

// Data integrity check types
export interface DataIntegrityCheck {
  name: string;
  type: 'record_count' | 'field_value' | 'relationship' | 'custom';
  expectedResult: unknown;
  actualResult?: unknown;
  passed?: boolean;
  message?: string;
}

// External ID configuration
export interface ExternalIdConfig {
  fieldName: string;
  strategy: 'create' | 'match' | 'upsert';
  prefix?: string;
  generateIfMissing?: boolean;
}

// Rollback configuration
export interface RollbackConfig {
  enabled: boolean;
  strategy: 'delete' | 'restore' | 'manual';
  saveOriginalData?: boolean;
}

// Type guards
export function isMigrationError(obj: unknown): obj is MigrationError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'errorCode' in obj &&
    'message' in obj
  );
}

export function isValidationError(obj: unknown): obj is ValidationError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as ValidationError).type === 'error'
  );
}

export function isFieldMappingConfig(obj: unknown): obj is FieldMappingConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sourceField' in obj &&
    'targetField' in obj
  );
}