/**
 * Common Salesforce type definitions
 * These types represent the structure of data returned from Salesforce APIs
 */

// Base Salesforce record interface
export interface SalesforceRecord {
  Id: string;
  Name?: string;
  CreatedDate?: string;
  CreatedById?: string;
  LastModifiedDate?: string;
  LastModifiedById?: string;
  SystemModstamp?: string;
  IsDeleted?: boolean;
  attributes?: {
    type: string;
    url: string;
  };
}

// Salesforce query result interface
export interface SalesforceQueryResult<T = SalesforceRecord> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

// Salesforce error response
export interface SalesforceError {
  message: string;
  errorCode: string;
  fields?: string[];
  statusCode?: string;
}

// Salesforce batch result
export interface SalesforceBatchResult {
  id?: string;
  success: boolean;
  created?: boolean;
  errors?: SalesforceError[];
}

// Salesforce field describe result
export interface SalesforceFieldDescribe {
  name: string;
  label: string;
  type: string;
  length?: number;
  scale?: number;
  precision?: number;
  picklistValues?: Array<{
    value: string;
    label: string;
    active: boolean;
    defaultValue: boolean;
  }>;
  referenceTo?: string[];
  relationshipName?: string;
  nillable: boolean;
  createable: boolean;
  updateable: boolean;
  externalId: boolean;
  unique: boolean;
  calculated?: boolean;
  filterable: boolean;
  sortable: boolean;
  defaultValue?: unknown;
}

// Salesforce object describe result
export interface SalesforceObjectDescribe {
  name: string;
  label: string;
  labelPlural: string;
  fields: SalesforceFieldDescribe[];
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  queryable: boolean;
  searchable: boolean;
  retrieveable: boolean;
  triggerable: boolean;
  undeletable: boolean;
  mergeable: boolean;
  replicateable: boolean;
  activateable: boolean;
  custom: boolean;
  customSetting: boolean;
  keyPrefix: string;
  urls: {
    sobject: string;
    describe: string;
    rowTemplate: string;
  };
}

// Salesforce global describe result
export interface SalesforceGlobalDescribe {
  encoding: string;
  maxBatchSize: number;
  sobjects: Array<{
    name: string;
    label: string;
    labelPlural: string;
    custom: boolean;
    createable: boolean;
    updateable: boolean;
    queryable: boolean;
    keyPrefix: string;
    urls: {
      sobject: string;
      describe: string;
      rowTemplate: string;
    };
  }>;
}

// Salesforce API response wrapper
export interface SalesforceApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errors?: SalesforceError[];
  message?: string;
}

// Salesforce bulk API job
export interface SalesforceBulkJob {
  id: string;
  state: 'Open' | 'InProgress' | 'Completed' | 'Failed' | 'Aborted';
  object: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete' | 'hardDelete';
  createdDate: string;
  systemModstamp: string;
  numberBatchesQueued: number;
  numberBatchesInProgress: number;
  numberBatchesCompleted: number;
  numberBatchesFailed: number;
  numberBatchesTotal: number;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  numberRetries: number;
  apiVersion: string;
  numberRecordsCompleted?: number;
  retries?: number;
  totalProcessingTime?: number;
}

// Composite API request/response types
export interface CompositeSubrequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  referenceId: string;
  body?: unknown;
}

export interface CompositeSubresponse {
  body: unknown;
  httpHeaders: Record<string, string>;
  httpStatusCode: number;
  referenceId: string;
}

export interface CompositeResponse {
  compositeResponse: CompositeSubresponse[];
}

// OAuth token response
export interface SalesforceOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  id: string;
  issued_at: string;
  signature: string;
  scope?: string;
  token_type: string;
}

// User info response
export interface SalesforceUserInfo {
  id: string;
  asserted_user: boolean;
  user_id: string;
  organization_id: string;
  username: string;
  nick_name: string;
  display_name: string;
  email: string;
  email_verified: boolean;
  first_name?: string;
  last_name?: string;
  timezone: string;
  photos: {
    picture: string;
    thumbnail: string;
  };
  addr_street?: string;
  addr_city?: string;
  addr_state?: string;
  addr_country?: string;
  addr_zip?: string;
  mobile_phone?: string;
  mobile_phone_verified: boolean;
  is_app_installed: boolean;
  is_active: boolean;
  user_type: string;
  language: string;
  locale: string;
  utcOffset: number;
  last_modified_date: string;
  is_lightning_login_user: boolean;
  custom_attributes?: Record<string, unknown>;
}

// Package info
export interface SalesforcePackageInfo {
  Id: string;
  SubscriberPackageId: string;
  NamespacePrefix: string;
  Name: string;
  Description?: string;
  IsManaged: boolean;
}

// Migration-specific types
export interface MigrationFieldMapping {
  sourceField: string;
  targetField: string;
  transformFunction?: string;
  defaultValue?: unknown;
}

export interface MigrationRecordResult extends SalesforceBatchResult {
  sourceId: string;
  targetId?: string;
  operation: 'insert' | 'update' | 'upsert';
  objectType: string;
}

// Type guards
export function isSalesforceError(obj: unknown): obj is SalesforceError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'message' in obj &&
    'errorCode' in obj
  );
}

export function isSalesforceRecord(obj: unknown): obj is SalesforceRecord {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'Id' in obj &&
    typeof (obj as SalesforceRecord).Id === 'string'
  );
}

export function isQueryResult(obj: unknown): obj is SalesforceQueryResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'totalSize' in obj &&
    'done' in obj &&
    'records' in obj &&
    Array.isArray((obj as SalesforceQueryResult).records)
  );
}