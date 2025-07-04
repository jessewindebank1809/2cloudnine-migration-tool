/**
 * API-specific type definitions
 */

import { MigrationResult, MigrationError } from './migration';

// API Error types
export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

// Migration execution error
export interface MigrationExecutionError extends ApiError {
  details?: MigrationStepError[];
  result?: Partial<MigrationResult>;
  sessionId?: string;
  uniqueErrors?: MigrationUniqueError[];
  recordResults?: MigrationRecordResult[];
  isWarning?: boolean;
}

export interface MigrationStepError {
  step: string;
  stepName: string;
  errorCount: number;
  errors: MigrationError[];
}

export interface MigrationUniqueError {
  type: string;
  count: number;
  examples: string[];
}

export interface MigrationRecordResult {
  id: string;
  success: boolean;
  error?: string;
  created?: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T> {
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

// Organisation API types
export interface OrganisationApiResponse {
  orgs: Array<{
    id: string;
    name: string;
    org_type: 'PRODUCTION' | 'SANDBOX' | 'SCRATCH';
    instance_url: string;
    salesforce_org_id: string | null;
    connected: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

// Template API types
export interface TemplateApiResponse {
  templates: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    version: string;
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedDuration: number;
    objectType: string;
    requiredFeatures?: string[];
    tags?: string[];
  }>;
}

// Migration API types
export interface MigrationApiResponse {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  source_org_id: string;
  target_org_id: string;
  template_id: string;
  selected_record_ids: string[];
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  error_message?: string;
}

// Validation API types
export interface ValidationApiResponse {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  selectedRecordNames?: Record<string, string>;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  recordId?: string;
  recordLink?: string;
  field?: string;
  suggestion?: string;
  parentRecordId?: string;
}

// Type guards
export function isMigrationExecutionError(error: unknown): error is MigrationExecutionError {
  return (
    error instanceof Error &&
    'details' in error &&
    Array.isArray((error as MigrationExecutionError).details)
  );
}

export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    ('statusCode' in error || 'code' in error)
  );
}