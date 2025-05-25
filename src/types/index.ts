// Organization types
export interface OrgConnection {
  id: string;
  name: string;
  type: "source" | "target";
  instanceUrl: string;
  organizationId: string;
  isConnected: boolean;
  connectionStatus: "active" | "expired" | "error";
  lastSync: Date;
  capabilities: {
    canRead: boolean;
    canWrite: boolean;
    apiVersion: string;
    limits: {
      dailyApiCalls: number;
      remainingApiCalls: number;
    };
  };
}

// Migration types
export interface MigrationProject {
  id: string;
  name: string;
  description?: string;
  sourceOrgId: string;
  targetOrgId: string;
  status: MigrationStatus;
  config: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  sourceOrg?: OrgConnection;
  targetOrg?: OrgConnection;
  sessions?: MigrationSession[];
}

export interface MigrationSession {
  id: string;
  projectId: string;
  objectType: string;
  status: SessionStatus;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errorLog: MigrationError[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  project?: MigrationProject;
  records?: MigrationRecord[];
}

export interface MigrationRecord {
  id: string;
  sessionId: string;
  sourceRecordId?: string;
  targetRecordId?: string;
  objectType: string;
  status: RecordStatus;
  errorMessage?: string;
  recordData: Record<string, any>;
  createdAt: Date;
}

export interface MigrationError {
  timestamp: Date;
  level: "error" | "warning" | "info";
  message: string;
  details?: Record<string, any>;
}

// Object definition types
export interface MigrationObjectType {
  name: string;
  apiName: string;
  category: "payroll" | "time" | "custom";
  relationships: {
    parent?: string;
    children: string[];
    lookups: string[];
  };
  fields: {
    required: string[];
    optional: string[];
    readonly: string[];
    autonumber: string[];
  };
  validation: {
    rules: ValidationRule[];
    dependencies: string[];
  };
}

export interface ValidationRule {
  id: string;
  name: string;
  type: "required" | "unique" | "format" | "dependency";
  field: string;
  condition?: string;
  message: string;
}

// Enums
export type MigrationStatus = "DRAFT" | "READY" | "RUNNING" | "COMPLETED" | "FAILED";
export type SessionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type RecordStatus = "SUCCESS" | "FAILED" | "SKIPPED";

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Salesforce types
export interface SalesforceOrg {
  id: string;
  organizationId: string;
  organizationName: string;
  instanceUrl: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface SalesforceObject {
  name: string;
  label: string;
  apiName: string;
  isCustom: boolean;
  fields: SalesforceField[];
  relationships: SalesforceRelationship[];
}

export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isAutoNumber: boolean;
  length?: number;
  referenceTo?: string[];
}

export interface SalesforceRelationship {
  name: string;
  relationshipName: string;
  referenceTo: string;
  type: "lookup" | "master-detail" | "hierarchical";
} 