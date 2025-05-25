# Migration Template Solution Specification

## Overview

The Migration Template Solution is designed to simplify the migration of
important 2cloudnine data from source to target Salesforce organisations through
a template-driven approach. This solution provides a streamlined user experience
while maintaining flexibility for various migration scenarios.

## User Experience Flow

### 1. Project Definition

- **Project Name**: User-defined identifier for the migration
- **Source Org**: Selection from connected organisations
- **Target Org**: Selection from connected organisations
- **Migration Template**: Pre-configured template selection (e.g., "Payroll
  Configuration", "Time Management Setup", "Custom Objects")

### 2. Record Selection

- **Multi-select Interface**: Support for selecting 1 to many source records
- **Filtering & Search**: Advanced filtering capabilities for large datasets
- **Preview Mode**: Show record details before selection
- **Bulk Selection**: Select all, select by criteria, etc.

### 3. Validation Step

- **Pre-Migration Validation**: Cache target org data for dependency checks
- **Dependency Validation**: Verify all referenced records exist (Pay Codes,
  Leave Rules, etc.)
- **External ID Validation**: Ensure all required external IDs are populated
- **Data Integrity Checks**: Validate data consistency and completeness
- **Validation Report**: Detailed report categorised by severity
  (Error/Warning/Info)
- **Blocking vs Non-Blocking**: Errors block migration, warnings allow with
  confirmation

### 4. Migration Execution

- **Start Migration Button**: Initiate the migration process
- **Real-time Progress**: Live updates on migration status
- **Error Handling**: Graceful handling of failures with retry options
- **Completion Report**: Summary of successful and failed records

## Technical Architecture

### Template System Structure

```
src/
├── lib/
│   └── migration/
│       └── templates/
│           ├── core/
│           │   ├── template-engine.ts
│           │   ├── template-registry.ts
│           │   └── template-validator.ts
│           ├── definitions/
│           │   ├── payroll/
│           │   │   ├── interpretation-rules.template.ts
│           │   │   ├── pay-codes.template.ts
│           │   │   └── breakpoints.template.ts
│           │   ├── time/
│           │   │   ├── leave-rules.template.ts
│           │   │   └── time-policies.template.ts
│           │   └── custom/
│           │       └── custom-objects.template.ts
│           └── utils/
│               ├── field-mapping.ts
│               ├── relationship-resolver.ts
│               └── validation-rules.ts
```

### Core Interfaces

```typescript
// Template Definition Interface
export interface MigrationTemplate {
    id: string;
    name: string;
    description: string;
    category: "payroll" | "time" | "custom";
    version: string;
    objects: TemplateObject[];
    dependencies: string[];
    validationRules: ValidationRule[];
    metadata: TemplateMetadata;
}

// Template Object Configuration
export interface TemplateObject {
    apiName: string;
    displayName: string;
    migrationOrder: number;
    fieldMappings: FieldMapping[];
    relationships: RelationshipMapping[];
    validationRules: ObjectValidationRule[];
    transformations: DataTransformation[];
}

// Field Mapping Configuration
export interface FieldMapping {
    sourceField: string;
    targetField: string;
    isRequired: boolean;
    transformationType: "direct" | "lookup" | "formula" | "custom";
    transformationConfig?: TransformationConfig;
    validationRules?: FieldValidationRule[];
}

// Relationship Mapping
export interface RelationshipMapping {
    sourceField: string;
    targetField: string;
    relatedObject: string;
    relationshipType: "lookup" | "master-detail" | "hierarchical";
    preserveHierarchy: boolean;
    fallbackStrategy: "skip" | "create" | "error";
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
```

### Database Schema Extensions

```sql
-- Migration templates
CREATE TABLE migration_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    template_config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Template usage tracking
CREATE TABLE migration_template_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES migration_templates(id),
    project_id UUID REFERENCES migration_projects(id),
    selected_records JSONB DEFAULT '[]',
    validation_results JSONB DEFAULT '{}',
    execution_config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Record selection for migrations
CREATE TABLE migration_record_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES migration_projects(id),
    object_type VARCHAR(255) NOT NULL,
    source_record_id VARCHAR(18) NOT NULL,
    is_selected BOOLEAN DEFAULT true,
    selection_criteria JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Template Engine Implementation

```typescript
// Template Engine Core
export class TemplateEngine {
    private registry: TemplateRegistry;
    private validator: TemplateValidator;

    async loadTemplate(templateId: string): Promise<MigrationTemplate> {
        return this.registry.getTemplate(templateId);
    }

    async validateTemplate(
        template: MigrationTemplate,
        sourceOrg: string,
        targetOrg: string,
    ): Promise<ValidationResult> {
        return this.validator.validateTemplate(template, sourceOrg, targetOrg);
    }

    async executeTemplate(
        template: MigrationTemplate,
        selectedRecords: SelectedRecord[],
        options: ExecutionOptions,
    ): Promise<MigrationResult> {
        // Implementation for template execution
    }
}

// Template Registry
export class TemplateRegistry {
    private templates: Map<string, MigrationTemplate> = new Map();

    registerTemplate(template: MigrationTemplate): void {
        this.templates.set(template.id, template);
    }

    getTemplate(id: string): MigrationTemplate | undefined {
        return this.templates.get(id);
    }

    getTemplatesByCategory(category: string): MigrationTemplate[] {
        return Array.from(this.templates.values())
            .filter((t) => t.category === category);
    }
}
```

## ETL-Based Template Architecture

Based on the legacy migration files, the template system follows a proven ETL
pattern:

### ETL Process Flow

1. **Extract**: SOQL queries to retrieve source data with specific field
   selection
2. **Transform**: Field mappings, dynamic lookups (RecordType, External IDs),
   and conditional logic
3. **Load**: Upsert operations using External IDs with Batch/Bulk API

### Enhanced Template Interfaces

```typescript
// ETL Step Configuration
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

// Dynamic Lookup Mapping (for RecordType, Pay Code lookups, etc.)
export interface LookupMapping {
    sourceField: string;
    targetField: string;
    lookupObject: string;
    lookupKeyField: string;
    lookupValueField: string;
    cacheResults: boolean;
    fallbackValue?: string;
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

// Dependency Check (for missing Pay Codes, Leave Rules, etc.)
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

// Pre-validation Query (to cache lookup data)
export interface PreValidationQuery {
    queryName: string;
    soqlQuery: string;
    cacheKey: string;
    description: string;
}

// Validation Engine Implementation
export class ValidationEngine {
    private sourceConnection: SalesforceConnection;
    private targetConnection: SalesforceConnection;
    private validationCache: Map<string, any[]> = new Map();

    async validateTemplate(
        template: MigrationTemplate,
        sourceOrgId: string,
        targetOrgId: string,
        selectedRecords?: string[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            info: [],
            summary: {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0,
                warningChecks: 0,
            },
        };

        // Run validation for each ETL step
        for (const step of template.etlSteps) {
            if (step.validationConfig) {
                const stepResult = await this.validateStep(
                    step,
                    selectedRecords,
                );
                this.mergeValidationResults(results, stepResult);
            }
        }

        results.isValid = results.errors.length === 0;
        return results;
    }

    private async validateStep(
        step: ETLStep,
        selectedRecords?: string[],
    ): Promise<ValidationResult> {
        const config = step.validationConfig!;

        // 1. Execute pre-validation queries to cache target data
        await this.executePreValidationQueries(config.preValidationQueries);

        // 2. Extract source data for validation
        const sourceData = await this.extractSourceDataForValidation(
            step.extractConfig,
            selectedRecords,
        );

        // 3. Run dependency checks
        const dependencyResults = await this.runDependencyChecks(
            config.dependencyChecks,
            sourceData,
        );

        // 4. Run data integrity checks
        const integrityResults = await this.runDataIntegrityChecks(
            config.dataIntegrityChecks,
        );

        return this.combineValidationResults([
            dependencyResults,
            integrityResults,
        ]);
    }

    private async runDependencyChecks(
        checks: DependencyCheck[],
        sourceData: any[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();

        for (const check of checks) {
            const targetCache = this.validationCache.get(
                check.targetObject.toLowerCase(),
            );
            if (!targetCache) {
                results.errors.push({
                    checkName: check.checkName,
                    message: `Target cache for ${check.targetObject} not found`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                });
                continue;
            }

            // Check each source record
            for (const record of sourceData) {
                const sourceValue = this.getFieldValue(
                    record,
                    check.sourceField,
                );
                if (!sourceValue && check.isRequired) {
                    results.errors.push({
                        checkName: check.checkName,
                        message: check.errorMessage
                            .replace("{sourceValue}", sourceValue || "null")
                            .replace("{recordName}", record.Name || record.Id),
                        severity: "error",
                        recordId: record.Id,
                        recordName: record.Name,
                    });
                } else if (sourceValue) {
                    const targetExists = targetCache.some((target) =>
                        target[check.targetField] === sourceValue
                    );

                    if (!targetExists) {
                        if (check.isRequired) {
                            results.errors.push({
                                checkName: check.checkName,
                                message: check.errorMessage
                                    .replace("{sourceValue}", sourceValue)
                                    .replace(
                                        "{recordName}",
                                        record.Name || record.Id,
                                    ),
                                severity: "error",
                                recordId: record.Id,
                                recordName: record.Name,
                            });
                        } else if (check.warningMessage) {
                            results.warnings.push({
                                checkName: check.checkName,
                                message: check.warningMessage
                                    .replace("{sourceValue}", sourceValue)
                                    .replace(
                                        "{recordName}",
                                        record.Name || record.Id,
                                    ),
                                severity: "warning",
                                recordId: record.Id,
                                recordName: record.Name,
                            });
                        }
                    }
                }
            }
        }

        return results;
    }
}

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
```

## Template Definitions

### Payroll Templates

#### Interpretation Rules Template

```typescript
export const interpretationRulesTemplate: MigrationTemplate = {
    id: "payroll-interpretation-rules",
    name: "Interpretation Rules Migration",
    description:
        "Migrate interpretation rules with breakpoints following exact legacy ETL pattern",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "interpretationRuleMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery:
                    `SELECT Id, Name, RecordType.Name, tc9_et__Apply_4_Week_Frequency__c,
          tc9_et__Apply_Break_Loading_Interpretation__c, tc9_et__Apply_Break_Time_Interpretation__c,
          tc9_et__Apply_Casual_Loading__c, tc9_et__Apply_Dual_Leave_Loading_Calculations__c,
          tc9_et__Apply_Excursion_Interpretation__c, tc9_et__Apply_Interpretation_Variations__c,
          tc9_et__Apply_Minimum_Rest_Interpretation__c, tc9_et__Apply_Minimum_Rest_on_Overtime__c,
          tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c, tc9_et__Apply_Overnight_Interpretation__c,
          tc9_et__Pay_Code__r.{externalIdField}, tc9_et__Status__c, tc9_et__Short_Description__c,
          tc9_et__Long_Description__c, tc9_et__Timesheet_Frequency__c, tc9_et__Total_Span_Hours__c,
          tc9_et__Frequency_Standard_Hours__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c,
          {externalIdField} FROM tc9_et__Interpretation_Rule__c 
          WHERE RecordType.Name != 'Interpretation Variation Rule'`,
                objectApiName: "tc9_et__Interpretation_Rule__c",
                batchSize: 200,
            },
            transformConfig: {
                fieldMappings: [
                    {
                        sourceField: "Name",
                        targetField: "Name",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Status__c",
                        targetField: "tc9_et__Status__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_4_Week_Frequency__c",
                        targetField: "tc9_et__Apply_4_Week_Frequency__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                ],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Pay_Code__c",
                        lookupObject: "tc9_et__Pay_Code__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                ],
                recordTypeMapping: {
                    sourceField: "RecordType.Name",
                    targetField: "RecordTypeId",
                    mappingDictionary: {
                        "Master Interpretation Rule": "{targetRecordTypeId}",
                        "Standard Interpretation Rule": "{targetRecordTypeId}",
                    },
                },
                externalIdHandling: {
                    managedField: "tc9_edc__External_ID_Data_Creation__c",
                    unmanagedField: "External_ID_Data_Creation__c",
                    fallbackField: "External_Id__c",
                    strategy: "auto-detect",
                },
            },
            loadConfig: {
                targetObject: "tc9_et__Interpretation_Rule__c",
                operation: "upsert",
                externalIdField: "External_Id__c",
                useBulkApi: true,
                batchSize: 200,
                allowPartialSuccess: false,
                retryConfig: {
                    maxRetries: 3,
                    retryWaitSeconds: 30,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "TIMEOUT"],
                },
            },
            validationConfig: {
                preValidationQueries: [
                    {
                        queryName: "targetPayCodes",
                        soqlQuery:
                            "SELECT Id, External_Id__c, Name FROM tc9_et__Pay_Code__c",
                        cacheKey: "target_pay_codes",
                        description:
                            "Cache all target org pay codes for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "payCodeExists",
                        description:
                            "Verify all referenced pay codes exist in target org",
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_et__Pay_Code__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage:
                            "Pay Code '{sourceValue}' referenced by Interpretation Rule '{recordName}' does not exist in target org",
                        warningMessage:
                            "Pay Code '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "payCodeExternalIdNotNull",
                        description:
                            "Ensure pay code external IDs are not null",
                        validationQuery:
                            "SELECT COUNT() FROM tc9_et__Interpretation_Rule__c WHERE tc9_et__Pay_Code__r.{externalIdField} = null AND tc9_et__Pay_Code__c != null",
                        expectedResult: "empty",
                        errorMessage:
                            "Found interpretation rules with pay codes that have null external IDs",
                        severity: "error",
                    },
                ],
            },
            dependencies: ["tc9_et__Pay_Code__c"],
        },
        {
            stepName: "interpretationRuleVariation",
            stepOrder: 2,
            extractConfig: {
                soqlQuery:
                    `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
          tc9_et__Variation_Type__c, tc9_et__Variation_Record_Type__c,
          {externalIdField} FROM tc9_et__Interpretation_Rule__c 
          WHERE RecordType.Name = 'Interpretation Variation Rule'`,
                objectApiName: "tc9_et__Interpretation_Rule__c",
            },
            transformConfig: {
                fieldMappings: [
                    {
                        sourceField: "Name",
                        targetField: "Name",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Variation_Type__c",
                        targetField: "tc9_et__Variation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                ],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetField: "tc9_et__Interpretation_Rule__c",
                        lookupObject: "tc9_et__Interpretation_Rule__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                ],
                externalIdHandling: {
                    managedField: "tc9_edc__External_ID_Data_Creation__c",
                    unmanagedField: "External_ID_Data_Creation__c",
                    fallbackField: "External_Id__c",
                    strategy: "auto-detect",
                },
            },
            loadConfig: {
                targetObject: "tc9_et__Interpretation_Rule__c",
                operation: "upsert",
                externalIdField: "External_Id__c",
                useBulkApi: true,
                batchSize: 200,
                allowPartialSuccess: false,
                retryConfig: {
                    maxRetries: 3,
                    retryWaitSeconds: 30,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "TIMEOUT"],
                },
            },
            dependencies: ["interpretationRuleMaster"],
        },
        {
            stepName: "interpretationBreakpointLeaveHeader",
            stepOrder: 3,
            extractConfig: {
                soqlQuery:
                    `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
          tc9_et__Breakpoint_Type__c, tc9_et__Leave_Header__r.{externalIdField},
          tc9_et__Leave_Rule__r.{externalIdField}, tc9_et__Start_Threshold__c,
          tc9_et__End_Threshold__c, tc9_et__Daily_Quantity__c, {externalIdField}
          FROM tc9_et__Interpretation_Breakpoint__c 
          WHERE RecordType.Name = 'Leave Breakpoint' 
          AND tc9_et__Breakpoint_Type__c = 'Leave Header'`,
                objectApiName: "tc9_et__Interpretation_Breakpoint__c",
            },
            transformConfig: {
                fieldMappings: [
                    {
                        sourceField: "Name",
                        targetField: "Name",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Breakpoint_Type__c",
                        targetField: "tc9_et__Breakpoint_Type__c",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Daily_Quantity__c",
                        targetField: "tc9_et__Daily_Quantity__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                ],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetField: "tc9_et__Interpretation_Rule__c",
                        lookupObject: "tc9_et__Interpretation_Rule__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                    {
                        sourceField:
                            "tc9_et__Leave_Header__r.{externalIdField}",
                        targetField: "tc9_et__Leave_Header__c",
                        lookupObject: "tc9_et__Leave_Header__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                ],
                externalIdHandling: {
                    managedField: "tc9_edc__External_ID_Data_Creation__c",
                    unmanagedField: "External_ID_Data_Creation__c",
                    fallbackField: "External_Id__c",
                    strategy: "auto-detect",
                },
            },
            loadConfig: {
                targetObject: "tc9_et__Interpretation_Breakpoint__c",
                operation: "upsert",
                externalIdField: "External_Id__c",
                useBulkApi: true,
                batchSize: 200,
                allowPartialSuccess: false,
                retryConfig: {
                    maxRetries: 3,
                    retryWaitSeconds: 30,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "TIMEOUT"],
                },
            },
            validationConfig: {
                preValidationQueries: [
                    {
                        queryName: "targetLeaveHeaders",
                        soqlQuery:
                            "SELECT Id, External_Id__c, Name FROM tc9_et__Leave_Header__c",
                        cacheKey: "target_leave_headers",
                        description:
                            "Cache all target org leave headers for validation",
                    },
                    {
                        queryName: "targetLeaveRules",
                        soqlQuery:
                            "SELECT Id, External_Id__c, Name FROM tc9_et__Leave_Rule__c",
                        cacheKey: "target_leave_rules",
                        description:
                            "Cache all target org leave rules for validation",
                    },
                    {
                        queryName: "targetInterpretationRules",
                        soqlQuery:
                            "SELECT Id, External_Id__c, Name FROM tc9_et__Interpretation_Rule__c",
                        cacheKey: "target_interpretation_rules",
                        description:
                            "Cache all target org interpretation rules for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "interpretationRuleExists",
                        description:
                            "Verify parent interpretation rule exists in target org",
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetObject: "tc9_et__Interpretation_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage:
                            "Parent Interpretation Rule '{sourceValue}' for leave breakpoint '{recordName}' does not exist in target org",
                    },
                    {
                        checkName: "leaveHeaderExists",
                        description:
                            "Verify referenced leave headers exist in target org",
                        sourceField:
                            "tc9_et__Leave_Header__r.{externalIdField}",
                        targetObject: "tc9_et__Leave_Header__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage:
                            "Leave Header '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage:
                            "Leave Header '{sourceValue}' will need to be migrated first",
                    },
                    {
                        checkName: "leaveRuleExists",
                        description:
                            "Verify referenced leave rules exist in target org",
                        sourceField: "tc9_et__Leave_Rule__r.{externalIdField}",
                        targetObject: "tc9_et__Leave_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage:
                            "Leave Rule '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage:
                            "Leave Rule '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "leaveHeaderExternalIdNotNull",
                        description:
                            "Ensure leave header external IDs are not null",
                        validationQuery:
                            "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Leave_Header__c != null AND tc9_et__Leave_Header__r.{externalIdField} = null AND RecordType.Name = 'Leave Breakpoint'",
                        expectedResult: "empty",
                        errorMessage:
                            "Found leave breakpoints with leave headers that have null external IDs",
                        severity: "error",
                    },
                    {
                        checkName: "leaveRuleExternalIdNotNull",
                        description:
                            "Ensure leave rule external IDs are not null",
                        validationQuery:
                            "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Leave_Rule__c != null AND tc9_et__Leave_Rule__r.{externalIdField} = null AND RecordType.Name = 'Leave Breakpoint'",
                        expectedResult: "empty",
                        errorMessage:
                            "Found leave breakpoints with leave rules that have null external IDs",
                        severity: "error",
                    },
                    {
                        checkName: "leaveBreakpointIntegrity",
                        description:
                            "Verify leave breakpoints have required leave references",
                        validationQuery:
                            "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE RecordType.Name = 'Leave Breakpoint' AND tc9_et__Breakpoint_Type__c = 'Leave Header' AND (tc9_et__Leave_Header__c = null OR tc9_et__Leave_Rule__c = null)",
                        expectedResult: "empty",
                        errorMessage:
                            "Found leave breakpoints missing required leave header or leave rule references",
                        severity: "error",
                    },
                ],
            },
            dependencies: [
                "interpretationRuleMaster",
                "interpretationRuleVariation",
            ],
        },
        {
            stepName: "interpretationBreakpointOther",
            stepOrder: 4,
            extractConfig: {
                soqlQuery:
                    `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
          tc9_et__Breakpoint_Type__c, tc9_et__Pay_Code__r.{externalIdField},
          tc9_et__Overtime_Pay_Code__r.{externalIdField}, tc9_et__Start_Threshold__c,
          tc9_et__End_Threshold__c, tc9_et__Daily_Quantity__c, tc9_et__Minimum_Paid_Hours__c,
          tc9_et__Pay_Code_Cap__c, {externalIdField}
          FROM tc9_et__Interpretation_Breakpoint__c 
          WHERE RecordType.Name != 'Pay Code Cap' AND RecordType.Name != 'Leave Breakpoint'`,
                objectApiName: "tc9_et__Interpretation_Breakpoint__c",
            },
            transformConfig: {
                fieldMappings: [
                    {
                        sourceField: "Name",
                        targetField: "Name",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Start_Threshold__c",
                        targetField: "tc9_et__Start_Threshold__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__End_Threshold__c",
                        targetField: "tc9_et__End_Threshold__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                ],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetField: "tc9_et__Interpretation_Rule__c",
                        lookupObject: "tc9_et__Interpretation_Rule__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Pay_Code__c",
                        lookupObject: "tc9_et__Pay_Code__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                    {
                        sourceField:
                            "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Overtime_Pay_Code__c",
                        lookupObject: "tc9_et__Pay_Code__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                ],
                externalIdHandling: {
                    managedField: "tc9_edc__External_ID_Data_Creation__c",
                    unmanagedField: "External_ID_Data_Creation__c",
                    fallbackField: "External_Id__c",
                    strategy: "auto-detect",
                },
            },
            loadConfig: {
                targetObject: "tc9_et__Interpretation_Breakpoint__c",
                operation: "upsert",
                externalIdField: "External_Id__c",
                useBulkApi: true,
                batchSize: 200,
                allowPartialSuccess: false,
                retryConfig: {
                    maxRetries: 3,
                    retryWaitSeconds: 30,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "TIMEOUT"],
                },
            },
            validationConfig: {
                preValidationQueries: [
                    {
                        queryName: "targetPayCodes",
                        soqlQuery:
                            "SELECT Id, External_Id__c, Name FROM tc9_et__Pay_Code__c",
                        cacheKey: "target_pay_codes",
                        description:
                            "Cache all target org pay codes for validation",
                    },
                    {
                        queryName: "targetInterpretationRules",
                        soqlQuery:
                            "SELECT Id, External_Id__c, Name FROM tc9_et__Interpretation_Rule__c",
                        cacheKey: "target_interpretation_rules",
                        description:
                            "Cache all target org interpretation rules for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "interpretationRuleExists",
                        description:
                            "Verify parent interpretation rule exists in target org",
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetObject: "tc9_et__Interpretation_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage:
                            "Parent Interpretation Rule '{sourceValue}' for breakpoint '{recordName}' does not exist in target org",
                    },
                    {
                        checkName: "payCodeExists",
                        description:
                            "Verify referenced pay codes exist in target org",
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_et__Pay_Code__c",
                        targetField: "External_Id__c",
                        isRequired: false,
                        errorMessage:
                            "Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage:
                            "Pay Code '{sourceValue}' will need to be migrated first",
                    },
                    {
                        checkName: "overtimePayCodeExists",
                        description:
                            "Verify referenced overtime pay codes exist in target org",
                        sourceField:
                            "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_et__Pay_Code__c",
                        targetField: "External_Id__c",
                        isRequired: false,
                        errorMessage:
                            "Overtime Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage:
                            "Overtime Pay Code '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "interpretationRuleExternalIdNotNull",
                        description:
                            "Ensure interpretation rule external IDs are not null",
                        validationQuery:
                            "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c != null AND tc9_et__Interpretation_Rule__r.{externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage:
                            "Found breakpoints with interpretation rules that have null external IDs",
                        severity: "error",
                    },
                    {
                        checkName: "payCodeExternalIdConsistency",
                        description:
                            "Check for pay codes with missing external IDs",
                        validationQuery:
                            "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Pay_Code__c != null AND tc9_et__Pay_Code__r.{externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage:
                            "Found breakpoints with pay codes that have null external IDs",
                        severity: "warning",
                    },
                ],
            },
            dependencies: ["interpretationBreakpointLeaveHeader"],
        },
    ],
    executionOrder: [
        "interpretationRuleMaster",
        "interpretationRuleVariation",
        "interpretationBreakpointLeaveHeader",
        "interpretationBreakpointOther",
    ],
    metadata: {
        author: "2cloudnine",
        createdAt: new Date(),
        updatedAt: new Date(),
        supportedApiVersions: ["63.0"],
        requiredPermissions: [
            "tc9_et__Interpretation_Rule__c.Create",
            "tc9_et__Interpretation_Breakpoint__c.Create",
        ],
        estimatedDuration: 25,
        complexity: "complex",
    },
};
```

### API Endpoints

```typescript
// Template Management APIs
GET    /api/templates                    // List all available templates
GET    /api/templates/:id               // Get specific template
POST   /api/templates                   // Create new template (admin)
PUT    /api/templates/:id               // Update template (admin)
DELETE /api/templates/:id               // Delete template (admin)

// Project Template APIs
POST   /api/migrations/:id/template     // Apply template to project
GET    /api/migrations/:id/records      // Get available records for selection
POST   /api/migrations/:id/records      // Update record selection
POST   /api/migrations/:id/validate     // Run validation on selected records
POST   /api/migrations/:id/execute      // Execute migration with template

// Record Selection APIs
GET    /api/migrations/:id/objects/:objectType/records  // Get records for object
POST   /api/migrations/:id/objects/:objectType/select   // Select/deselect records
GET    /api/migrations/:id/selection                    // Get current selection summary
```

### UI Components Structure

```
src/components/features/migrations/templates/
├── TemplateSelector.tsx              // Template selection interface
├── RecordSelector.tsx                // Multi-select record interface
├── ValidationReport.tsx              // Validation results display
├── MigrationProgress.tsx             // Real-time progress tracking
├── TemplatePreview.tsx               // Template configuration preview
└── ExecutionSummary.tsx              // Migration completion summary

src/components/features/migrations/templates/forms/
├── ProjectTemplateForm.tsx           // Project + template configuration
├── RecordSelectionForm.tsx           // Record selection with filters
└── ValidationForm.tsx                // Validation configuration

src/components/features/migrations/templates/admin/
├── TemplateBuilder.tsx               // Template creation interface
├── TemplateEditor.tsx                // Template modification interface
└── TemplateValidator.tsx             // Template validation tools
```

## Implementation Phases

**Progress: Phase 1 Complete (1/6) - 16.7% ✅**

### Phase 1: Core ETL Infrastructure (Week 1) ✅ COMPLETE

- [x] Create ETL interfaces (`ETLStep`, `ExtractConfig`, `TransformConfig`,
      `LoadConfig`)
- [x] Implement `ValidationEngine` class with caching and dependency checks
- [x] Add database tables: `migration_templates`, `migration_template_usage`,
      `migration_record_selections`
- [x] Create `TemplateRegistry` for template management
- [x] Build external ID detection utility (`auto-detect` strategy)

**Phase 1 Deliverables:**

- ✅ Core ETL interfaces implemented
  (`src/lib/migration/templates/core/interfaces.ts`)
- ✅ ValidationEngine with caching
  (`src/lib/migration/templates/core/validation-engine.ts`)
- ✅ TemplateRegistry for management
  (`src/lib/migration/templates/core/template-registry.ts`)
- ✅ External ID utilities
  (`src/lib/migration/templates/utils/external-id-utils.ts`)
- ✅ Database schema updated with template tables
- ✅ Build system verified and working

### Phase 2: Interpretation Rules Template (Week 2) 🎯 NEXT

- [ ] Create interpretation rules template definition file
- [ ] Implement 4 ETL steps: interpretationRuleMaster,
      interpretationRuleVariation, interpretationBreakpointLeaveHeader,
      interpretationBreakpointOther
- [ ] Add validation configs for pay code, leave rule, and interpretation rule
      dependencies
- [ ] Create SOQL query builders with dynamic external ID field replacement
- [ ] Implement retry logic with configurable wait times and error types
- [ ] Register template in TemplateRegistry
- [ ] Test template execution with sample data

### Phase 3: Validation System (Week 3)

- [ ] Build pre-validation query execution and caching system
- [ ] Implement dependency check engine with target org data validation
- [ ] Create data integrity check system with SOQL count queries
- [ ] Add validation result interfaces with error categorisation
- [ ] Build validation report UI component with blocking/non-blocking logic

### Phase 4: Template Execution Engine (Week 4)

- [ ] Create ETL step executor with batch processing (200 records)
- [ ] Implement lookup mapping resolver with caching
- [ ] Add record type mapping with dynamic resolution
- [ ] Build progress tracking with real-time updates
- [ ] Add error handling with partial success support

### Phase 5: UI Integration (Week 5)

- [ ] Create template selection interface with category filtering
- [ ] Build multi-select record interface with SOQL preview
- [ ] Implement validation report display with expandable error details
- [ ] Add migration progress tracking with step-by-step status
- [ ] Create execution summary with success/failure breakdown

### Phase 6: API & Testing (Week 6)

- [ ] Implement template management APIs (`/api/templates/*`)
- [ ] Add migration execution APIs (`/api/migrations/:id/template`,
      `/api/migrations/:id/validate`)
- [ ] Create record selection APIs with object-specific endpoints
- [ ] End-to-end testing with real Salesforce orgs
- [ ] Performance testing with large datasets (1000+ records)

## Success Metrics

### User Experience

- **Setup Time**: Reduce migration setup from 30+ minutes to under 5 minutes
- **Error Rate**: Achieve <5% validation failure rate
- **User Satisfaction**: Target 90%+ satisfaction score

### Technical Performance

- **Migration Speed**: Process 1000+ records per minute
- **Reliability**: 99.5% success rate for validated migrations
- **Scalability**: Support 100+ concurrent migrations

### Business Impact

- **Adoption Rate**: 80% of migrations use templates within 3 months
- **Support Reduction**: 50% reduction in migration-related support tickets
- **Time Savings**: Average 75% reduction in migration project duration

## Risk Mitigation

### Data Integrity

- Comprehensive validation before execution
- Rollback capabilities for failed migrations
- Audit trail for all changes

### Performance

- Batch processing for large datasets
- Queue management for concurrent migrations
- Resource monitoring and throttling

### Usability

- Progressive disclosure of complexity
- Clear error messages and guidance
- Comprehensive documentation and help

## Future Enhancements

### Template Marketplace

- Community-contributed templates
- Template rating and reviews
- Template sharing between organisations

### AI-Powered Features

- Intelligent field mapping suggestions
- Automated template generation
- Predictive validation

### Advanced Customisation

- Custom transformation functions
- Dynamic template generation
- Template inheritance and composition
