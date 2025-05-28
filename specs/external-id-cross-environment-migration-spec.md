# External ID Cross-Environment Migration Specification

## Problem Statement

When migrating data between Salesforce environments with different package types
(managed vs unmanaged), external ID field names differ, causing lookup failures
and data integrity issues.

### Current Issue

- **Source**: Unmanaged environment uses `External_ID_Data_Creation__c`
- **Target**: Managed environment uses `tc9_edc__External_ID_Data_Creation__c`
- **Result**: Lookup mappings fail because source external IDs are not being
  queried with the correct field name

### Scenarios to Support

1. **Unmanaged → Managed**: Source uses `External_ID_Data_Creation__c`, target
   uses `tc9_edc__External_ID_Data_Creation__c`
2. **Managed → Managed**: Both use `tc9_edc__External_ID_Data_Creation__c`
3. **Managed → Unmanaged**: Source uses `tc9_edc__External_ID_Data_Creation__c`,
   target uses `External_ID_Data_Creation__c`

## Solution Architecture

### 1. Enhanced External ID Configuration

```typescript
export interface ExternalIdConfig {
    sourceField: string; // Detected or specified source external ID field
    targetField: string; // Detected or specified target external ID field
    managedField: string; // tc9_edc__External_ID_Data_Creation__c
    unmanagedField: string; // External_ID_Data_Creation__c
    fallbackField: string; // External_Id__c
    strategy: "auto-detect" | "manual" | "cross-environment";
    crossEnvironmentMapping?: {
        sourcePackageType: "managed" | "unmanaged";
        targetPackageType: "managed" | "unmanaged";
    };
}
```

### 2. Dual External ID Field Detection

The system must detect external ID fields for both source and target
environments independently:

```typescript
export interface EnvironmentExternalIdInfo {
    packageType: "managed" | "unmanaged";
    externalIdField: string;
    detectedFields: string[];
    fallbackUsed: boolean;
}
```

### 3. Enhanced Lookup Mapping Strategy

Lookup mappings must support different external ID fields for source and target:

```typescript
export interface EnhancedLookupMapping extends LookupMapping {
    sourceExternalIdField?: string; // Override for source external ID field
    targetExternalIdField?: string; // Override for target external ID field
    crossEnvironmentMapping?: boolean; // Flag for cross-environment scenarios
}
```

## Implementation Plan

### Phase 1: Core Infrastructure Enhancement

#### 1.1 Update ExternalIdUtils Class

**File**: `src/lib/migration/templates/utils/external-id-utils.ts`

**Changes**:

- Add dual environment detection
- Support cross-environment mapping
- Enhanced validation and error handling

#### 1.2 Update Core Interfaces

**File**: `src/lib/migration/templates/core/interfaces.ts`

**Changes**:

- Extend `ExternalIdConfig` interface
- Add `EnvironmentExternalIdInfo` interface
- Update `LookupMapping` interface

#### 1.3 Update Execution Engine

**File**: `src/lib/migration/templates/core/execution-engine.ts`

**Changes**:

- Support dual external ID field resolution
- Enhanced lookup resolution logic
- Improved error handling for missing external IDs

### Phase 2: Validation Enhancement

#### 2.1 Pre-Migration Validation

Add comprehensive validation to catch external ID mismatches before migration
starts:

```typescript
export interface ExternalIdValidationResult {
    sourceEnvironment: EnvironmentExternalIdInfo;
    targetEnvironment: EnvironmentExternalIdInfo;
    crossEnvironmentDetected: boolean;
    potentialIssues: ExternalIdIssue[];
    recommendations: string[];
}

export interface ExternalIdIssue {
    severity: "error" | "warning" | "info";
    message: string;
    affectedObjects: string[];
    suggestedAction: string;
}
```

#### 2.2 Enhanced Dependency Checks

Update validation engine to verify external ID field availability:

```typescript
export interface ExternalIdDependencyCheck {
    checkName: string;
    sourceObject: string;
    targetObject: string;
    sourceExternalIdField: string;
    targetExternalIdField: string;
    validationQuery: string;
    expectedBehaviour: "match" | "transform" | "fallback";
}
```

### Phase 3: Template Updates

#### 3.1 Update Migration Templates

**Files**: All template files in `src/lib/migration/templates/definitions/`

**Changes**:

- Replace hardcoded `{externalIdField}` with dynamic resolution
- Add cross-environment lookup mappings
- Enhanced validation configurations

#### 3.2 Query Enhancement

Update SOQL queries to handle missing external ID fields gracefully:

```sql
-- Before (fails if external ID field doesn't exist)
SELECT Id, Name, tc9_et__Pay_Code__r.{externalIdField} FROM tc9_et__Interpretation_Rule__c

-- After (conditional field inclusion)
SELECT Id, Name, 
    tc9_et__Pay_Code__r.External_ID_Data_Creation__c,
    tc9_et__Pay_Code__r.tc9_edc__External_ID_Data_Creation__c,
    tc9_et__Pay_Code__r.External_Id__c
FROM tc9_et__Interpretation_Rule__c
```

## Detailed Action Items

### Action Item 1: Enhanced ExternalIdUtils Implementation

**Priority**: High **Estimated Effort**: 2 days

```typescript
// New methods to add:
static async detectEnvironmentExternalIdInfo(objectApiName: string, orgConnection: any): Promise<EnvironmentExternalIdInfo>
static async detectCrossEnvironmentMapping(sourceInfo: EnvironmentExternalIdInfo, targetInfo: EnvironmentExternalIdInfo): Promise<ExternalIdConfig>
static validateCrossEnvironmentCompatibility(sourceInfo: EnvironmentExternalIdInfo, targetInfo: EnvironmentExternalIdInfo): ExternalIdValidationResult
static buildCrossEnvironmentQuery(baseQuery: string, sourceExternalIdField: string, targetExternalIdField: string): string
```

### Action Item 2: Execution Engine Updates

**Priority**: High **Estimated Effort**: 3 days

**Key Changes**:

1. Update `ExecutionContext` to include both source and target external ID info
2. Modify `resolveLookup` method to handle cross-environment scenarios
3. Add fallback mechanisms for missing external ID fields
4. Enhanced error reporting for external ID issues

### Action Item 3: Validation Engine Enhancement

**Priority**: Medium **Estimated Effort**: 2 days

**Key Changes**:

1. Pre-migration external ID compatibility checks
2. Runtime validation for missing external ID values
3. Comprehensive reporting of external ID issues
4. Suggested remediation actions

### Action Item 4: Template Migration

**Priority**: Medium **Estimated Effort**: 1 day per template

**For each template**:

1. Update SOQL queries to include all possible external ID fields
2. Add cross-environment lookup mappings
3. Update validation configurations
4. Test with different environment combinations

### Action Item 5: API Route Updates

**Priority**: Medium **Estimated Effort**: 1 day

**File**: `src/app/api/migrations/[id]/execute/route.ts`

**Changes**:

1. Detect external ID fields for both source and target
2. Pass dual external ID configuration to execution engine
3. Enhanced error handling and reporting

## Testing Strategy

### Test Scenarios

1. **Unmanaged → Managed**: Verify external ID field detection and lookup
   resolution
2. **Managed → Managed**: Ensure existing functionality remains intact
3. **Managed → Unmanaged**: Test reverse scenario
4. **Missing External IDs**: Verify graceful handling of missing external ID
   values
5. **Fallback Scenarios**: Test fallback to alternative external ID fields

### Test Data Requirements

- Source org with unmanaged package and populated external IDs
- Target org with managed package
- Test records with various external ID field combinations
- Records with missing external ID values

## Risk Mitigation

### Identified Risks

1. **Breaking Changes**: Updates might break existing migrations
2. **Performance Impact**: Additional field detection queries
3. **Complexity**: Increased configuration complexity

### Mitigation Strategies

1. **Backward Compatibility**: Maintain existing API while adding new features
2. **Caching**: Cache external ID field detection results
3. **Progressive Enhancement**: Add features incrementally with feature flags
4. **Comprehensive Testing**: Test all environment combinations thoroughly

## Success Criteria

1. **Functional**: All three environment combinations work correctly
2. **Validation**: Pre-migration validation catches external ID issues
3. **Performance**: No significant performance degradation
4. **Usability**: Clear error messages and remediation guidance
5. **Reliability**: Graceful handling of edge cases and missing data

## Implementation Timeline

- **Week 1**: Core infrastructure (Actions 1-2)
- **Week 2**: Validation enhancement (Action 3)
- **Week 3**: Template updates (Action 4)
- **Week 4**: API updates and testing (Action 5)
- **Week 5**: Integration testing and documentation

## Dependencies

1. Access to both managed and unmanaged Salesforce environments for testing
2. Sample data with various external ID field configurations
3. Coordination with existing migration processes
4. Documentation updates for new configuration options
