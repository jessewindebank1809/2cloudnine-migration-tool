# External ID Cross-Environment Migration Implementation Summary

## Overview

This document summarises the implementation of cross-environment external ID
handling for Salesforce migrations, addressing the issue where source and target
environments use different external ID field names (managed vs unmanaged
packages).

## Problem Solved

**Original Issue**: When migrating from unmanaged to managed environments:

- Source uses `External_ID_Data_Creation__c`
- Target uses `tc9_edc__External_ID_Data_Creation__c`
- Lookup mappings failed because external IDs weren't being queried with correct
  field names

## Implementation Details

### 1. Enhanced Core Interfaces

**File**: `src/lib/migration/templates/core/interfaces.ts`

**New Interfaces Added**:

```typescript
export interface ExternalIdConfig {
    sourceField: string; // Detected source external ID field
    targetField: string; // Detected target external ID field
    managedField: string; // tc9_edc__External_ID_Data_Creation__c
    unmanagedField: string; // External_ID_Data_Creation__c
    fallbackField: string; // External_Id__c
    strategy: "auto-detect" | "manual" | "cross-environment";
    crossEnvironmentMapping?: {
        sourcePackageType: "managed" | "unmanaged";
        targetPackageType: "managed" | "unmanaged";
    };
}

export interface EnvironmentExternalIdInfo {
    packageType: "managed" | "unmanaged";
    externalIdField: string;
    detectedFields: string[];
    fallbackUsed: boolean;
}

export interface ExternalIdValidationResult {
    sourceEnvironment: EnvironmentExternalIdInfo;
    targetEnvironment: EnvironmentExternalIdInfo;
    crossEnvironmentDetected: boolean;
    potentialIssues: ExternalIdIssue[];
    recommendations: string[];
}
```

**Enhanced LookupMapping**:

```typescript
export interface LookupMapping {
    // ... existing fields ...
    sourceExternalIdField?: string; // Override for source external ID field
    targetExternalIdField?: string; // Override for target external ID field
    crossEnvironmentMapping?: boolean; // Flag for cross-environment scenarios
}
```

### 2. Enhanced ExternalIdUtils Class

**File**: `src/lib/migration/templates/utils/external-id-utils.ts`

**New Methods Added**:

#### `detectEnvironmentExternalIdInfo()`

- Detects external ID field information for a specific environment
- Determines package type (managed/unmanaged)
- Returns comprehensive environment information

#### `detectCrossEnvironmentMapping()`

- Creates cross-environment external ID configuration
- Compares source and target environments
- Sets appropriate strategy based on environment differences

#### `validateCrossEnvironmentCompatibility()`

- Validates compatibility between source and target environments
- Identifies potential issues and provides recommendations
- Returns detailed validation results

#### `buildCrossEnvironmentQuery()`

- Builds SOQL queries that include all possible external ID fields
- Handles relationship fields with multiple external ID options
- Ensures data capture across different field naming conventions

#### `extractExternalIdValue()`

- Extracts external ID values with fallback logic
- Tries multiple external ID fields in order of preference
- Handles missing or null external ID values gracefully

### 3. Enhanced Execution Engine

**File**: `src/lib/migration/templates/core/execution-engine.ts`

**Key Updates**:

#### Updated ExecutionContext

```typescript
export interface ExecutionContext {
    // ... existing fields ...
    externalIdField: string; // Deprecated: use externalIdConfig instead
    externalIdConfig: ExternalIdConfig; // New cross-environment configuration
    config: ExecutionConfig;
}
```

#### Enhanced Query Building

- Uses `buildCrossEnvironmentQuery()` for cross-environment scenarios
- Falls back to legacy method for backward compatibility
- Improved error handling for missing external ID fields

#### Enhanced Lookup Resolution

- Supports different external ID fields for source and target
- Tries multiple external ID fields when cross-environment mapping is detected
- Caches results efficiently across different field names

### 4. Enhanced API Route

**File**: `src/app/api/migrations/[id]/execute/route.ts`

**Key Changes**:

- Detects external ID fields for both source and target environments
- Creates cross-environment configuration automatically
- Validates compatibility and logs issues/recommendations
- Maintains backward compatibility with existing API

### 5. Template Validation Enhancement

**File**:
`src/lib/migration/templates/definitions/payroll/interpretation-rules.template.ts`

**New Validation Check**:

```typescript
{
    checkName: "crossEnvironmentExternalIdValidation",
    description: "Validate external ID fields exist for cross-environment migration",
    validationQuery: `SELECT COUNT() FROM tc9_et__Pay_Code__c WHERE 
        (External_ID_Data_Creation__c IS NULL AND tc9_edc__External_ID_Data_Creation__c IS NULL AND External_Id__c IS NULL)`,
    expectedResult: "empty",
    errorMessage: "Found pay codes without any external ID values. Cross-environment migration requires external IDs to be populated",
    severity: "error",
}
```

## How It Works

### 1. Environment Detection

When a migration starts, the system:

1. Detects external ID fields in both source and target environments
2. Determines package types (managed/unmanaged)
3. Creates appropriate cross-environment configuration

### 2. Query Enhancement

For cross-environment scenarios:

1. SOQL queries include all possible external ID fields
2. Relationship fields are expanded to capture data regardless of field naming
3. Fallback mechanisms handle missing fields gracefully

### 3. Lookup Resolution

During lookup resolution:

1. System tries multiple external ID fields in order of preference
2. Uses appropriate target external ID field for lookup
3. Caches results efficiently

### 4. Validation

Pre-migration validation:

1. Checks for missing external ID values
2. Validates field availability in both environments
3. Provides clear error messages and recommendations

## Supported Scenarios

✅ **Unmanaged → Managed**: Source uses `External_ID_Data_Creation__c`, target
uses `tc9_edc__External_ID_Data_Creation__c` ✅ **Managed → Managed**: Both use
`tc9_edc__External_ID_Data_Creation__c` ✅ **Managed → Unmanaged**: Source uses
`tc9_edc__External_ID_Data_Creation__c`, target uses
`External_ID_Data_Creation__c` ✅ **Fallback Scenarios**: Uses `External_Id__c`
when primary fields are unavailable

## Backward Compatibility

The implementation maintains full backward compatibility:

- Existing `externalIdField` property still works
- Legacy detection methods remain functional
- No breaking changes to existing templates or API calls

## Error Handling & Validation

### 1. Pre-Migration Validation

- Detects missing external ID fields
- Validates cross-environment compatibility
- Provides clear error messages and recommendations

### 2. Runtime Validation

- Graceful handling of missing external ID values
- Fallback mechanisms for field detection failures
- Comprehensive error logging

### 3. User Guidance

- Clear error messages explaining issues
- Specific recommendations for remediation
- Detailed logging for troubleshooting

## Benefits

1. **Automatic Detection**: No manual configuration required for most scenarios
2. **Robust Fallbacks**: Multiple fallback mechanisms ensure migration success
3. **Clear Validation**: Pre-migration checks catch issues early
4. **Comprehensive Logging**: Detailed information for troubleshooting
5. **Backward Compatible**: Existing migrations continue to work unchanged

## Testing Recommendations

1. **Environment Combinations**: Test all three supported scenarios
2. **Missing Data**: Test with missing external ID values
3. **Field Availability**: Test with different field availability combinations
4. **Error Scenarios**: Test error handling and fallback mechanisms
5. **Performance**: Verify no significant performance impact

## Future Enhancements

1. **UI Integration**: Add external ID validation to the migration UI
2. **Batch Optimisation**: Optimise queries for large datasets
3. **Custom Field Support**: Support for custom external ID fields
4. **Advanced Mapping**: Support for complex external ID transformations
