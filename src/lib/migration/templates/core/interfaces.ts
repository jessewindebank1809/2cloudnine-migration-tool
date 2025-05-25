// Core ETL Template Interfaces
export interface MigrationTemplate {
    id: string;
    name: string;
    description: string;
    category: "payroll" | "time" | "custom";
    version: string;
    etlSteps: ETLStep[];
    executionOrder: string[];
    metadata: TemplateMetadata;
}

export interface ETLStep {
    stepName: string;
    stepOrder: number;
    extractConfig: ExtractConfig;
    transformConfig: TransformConfig;
    loadConfig: LoadConfig;
    validationConfig?: ValidationConfig;
    dependencies: string[];
}

// Extract Configuration (SOQL-based)
export interface ExtractConfig {
    soqlQuery: string;
    objectApiName: string;
    filterCriteria?: string;
    orderBy?: string;
    batchSize?: number;
}

// Transform Configuration
export interface TransformConfig {
    fieldMappings: FieldMapping[];
    lookupMappings: LookupMapping[];
    recordTypeMapping?: RecordTypeMapping;
    conditionalLogic?: ConditionalTransform[];
    externalIdHandling: ExternalIdConfig;
}

// Load Configuration
export interface LoadConfig {
    targetObject: string;
    operation: "insert" | "update" | "upsert";
    externalIdField: string;
    useBulkApi: boolean;
    batchSize: number;
    allowPartialSuccess: boolean;
    retryConfig: RetryConfig;
}

// Field Mapping
export interface FieldMapping {
    sourceField: string;
    targetField: string;
    isRequired: boolean;
    transformationType: "direct" | "lookup" | "formula" | "custom" | "boolean" | "number";
    transformationConfig?: TransformationConfig;
    validationRules?: FieldValidationRule[];
}

// Dynamic Lookup Mapping
export interface LookupMapping {
    sourceField: string;
    targetField: string;
    lookupObject: string;
    lookupKeyField: string;
    lookupValueField: string;
    cacheResults: boolean;
    fallbackValue?: string;
}

// Record Type Mapping
export interface RecordTypeMapping {
    sourceField: string;
    targetField: string;
    mappingDictionary: Record<string, string>;
}

// External ID Configuration
export interface ExternalIdConfig {
    managedField: string; // tc9_edc__External_ID_Data_Creation__c
    unmanagedField: string; // External_ID_Data_Creation__c
    fallbackField: string; // External_Id__c
    strategy: "auto-detect" | "managed" | "unmanaged";
}

// Retry Configuration
export interface RetryConfig {
    maxRetries: number;
    retryWaitSeconds: number;
    retryableErrors: string[];
}

// Validation Configuration
export interface ValidationConfig {
    dependencyChecks: DependencyCheck[];
    dataIntegrityChecks: DataIntegrityCheck[];
    preValidationQueries: PreValidationQuery[];
}

// Dependency Check
export interface DependencyCheck {
    checkName: string;
    description: string;
    sourceField: string;
    targetObject: string;
    targetField: string;
    isRequired: boolean;
    errorMessage: string;
    warningMessage?: string;
}

// Data Integrity Check
export interface DataIntegrityCheck {
    checkName: string;
    description: string;
    validationQuery: string;
    expectedResult: "empty" | "non-empty" | "count-match";
    errorMessage: string;
    severity: "error" | "warning" | "info";
}

// Pre-validation Query
export interface PreValidationQuery {
    queryName: string;
    soqlQuery: string;
    cacheKey: string;
    description: string;
}

// Validation Results
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    info: ValidationIssue[];
    summary: ValidationSummary;
}

export interface ValidationIssue {
    checkName: string;
    message: string;
    severity: "error" | "warning" | "info";
    recordId: string | null;
    recordName: string | null;
    suggestedAction?: string;
}

export interface ValidationSummary {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
}

// Template Metadata
export interface TemplateMetadata {
    author: string;
    createdAt: Date;
    updatedAt: Date;
    supportedApiVersions: string[];
    requiredPermissions: string[];
    estimatedDuration: number; // in minutes
    complexity: "simple" | "moderate" | "complex";
}

// Supporting interfaces
export interface TransformationConfig {
    [key: string]: any;
}

export interface FieldValidationRule {
    rule: string;
    message: string;
}

export interface ConditionalTransform {
    condition: string;
    transformation: string;
} 