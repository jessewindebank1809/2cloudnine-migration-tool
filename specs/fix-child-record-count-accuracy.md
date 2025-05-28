# Fix Child Record Count Accuracy Specification

## Issue Summary

The migration tool is displaying incorrect child record counts in the detailed
results section. The issue stems from queries attempting to fetch child record
counts from the target organisation but failing due to incorrect field names and
query structure.

## Current Behaviour

- Migration shows 0 child records for all parent records
- The debugging output shows empty child counts map: `{}`
- All child record queries are returning no results

## Root Cause Analysis

### 1. Incorrect Field Name

The queries are using `tc9_et__Type__c` but the actual field name is
`tc9_et__Breakpoint_Type__c`.

**Current Query:**

```sql
SELECT tc9_et__Interpretation_Rule__c, COUNT(Id) 
FROM tc9_et__Interpretation_Breakpoint__c 
WHERE tc9_et__Interpretation_Rule__c IN ('a149j00000jcCxVAAU','a149j00000ji3ZRAAY') 
AND tc9_et__Type__c = 'Leave Header'
GROUP BY tc9_et__Interpretation_Rule__c
```

**Should Be:**

```sql
SELECT tc9_et__Interpretation_Rule__c, COUNT(Id) 
FROM tc9_et__Interpretation_Breakpoint__c 
WHERE tc9_et__Interpretation_Rule__c IN ('a14QE000003X6UjYAK','a14QE000003X6XxYAK') 
AND tc9_et__Breakpoint_Type__c = 'Leave Header'
GROUP BY tc9_et__Interpretation_Rule__c
```

### 2. Using Source IDs Instead of Target IDs

The queries are using source organisation IDs instead of target organisation IDs
when querying the target org.

## Expected Behaviour

Based on the migration output:

- Record 1 (MA000100: SCHADS Care CAS Non Shift) should show 94 total child
  records
- Record 2 (MA000100: SCHADS Care CAS Shift) should show 108 total child records

## Detailed Fix Requirements

### 1. Update Field References

In `src/app/api/migrations/[id]/execute/route.ts`, update the
`childObjectQueries` array:

```typescript
const childObjectQueries = [
    {
        stepName: "interpretationBreakpointLeaveHeader",
        objectType: "tc9_et__Interpretation_Breakpoint__c",
        parentField: "tc9_et__Interpretation_Rule__c",
        whereClause: `tc9_et__Breakpoint_Type__c = 'Leave Header'`, // Changed from tc9_et__Type__c
    },
    {
        stepName: "interpretationBreakpointPayCodeCap",
        objectType: "tc9_et__Interpretation_Breakpoint__c",
        parentField: "tc9_et__Interpretation_Rule__c",
        whereClause: `tc9_et__Breakpoint_Type__c = 'Pay Code Cap'`, // Changed from tc9_et__Type__c
    },
    {
        stepName: "interpretationBreakpointOther",
        objectType: "tc9_et__Interpretation_Breakpoint__c",
        parentField: "tc9_et__Interpretation_Rule__c",
        whereClause:
            `tc9_et__Breakpoint_Type__c NOT IN ('Leave Header', 'Pay Code Cap')`, // Changed from tc9_et__Type__c
    },
];
```

### 2. Ensure Correct Target Client Usage

Verify that `targetClient` is being used for queries, not `sourceClient`.

### 3. Add Error Handling

Add proper error handling for the SOQL queries to catch and log any
field-related errors:

```typescript
try {
    const result = await targetClient.query(query);
    // ... existing logic
} catch (error) {
    console.error(`Error querying ${queryConfig.stepName}:`, error);
    // Log the specific error message which might indicate field name issues
    if (error.message?.includes("No such column")) {
        console.error("Field name issue detected. Query:", query);
    }
}
```

### 4. Validate Query Results

Add validation to ensure the queries are returning expected data structure:

```typescript
if (
    result.success && result.data && Array.isArray(result.data) &&
    result.data.length > 0
) {
    result.data.forEach((record: any) => {
        // Validate the record structure
        if (!record[queryConfig.parentField] || record.expr0 === undefined) {
            console.warn(
                `Unexpected record structure for ${queryConfig.stepName}:`,
                record,
            );
        }
        // ... existing logic
    });
}
```

## Testing Requirements

### 1. Unit Tests

- Test query generation with correct field names
- Test handling of empty results
- Test error scenarios (field not found, etc.)

### 2. Integration Tests

- Test with actual Salesforce orgs
- Verify counts match expected values
- Test with different record types and configurations

### 3. Manual Testing

- Run migration with 2 interpretation rules
- Verify child counts display correctly:
  - Record 1: 94 total (5 Leave Header, 41 Pay Code Cap, 48 Other)
  - Record 2: 108 total (6 Leave Header, 41 Pay Code Cap, 61 Other)

## Implementation Steps

1. **Update Field Names** (Priority: High)
   - Change `tc9_et__Type__c` to `tc9_et__Breakpoint_Type__c` in all queries
   - Update any related documentation

2. **Add Debugging** (Priority: Medium)
   - Add more detailed logging for query execution
   - Log the exact queries being executed
   - Log the raw response from Salesforce

3. **Improve Error Handling** (Priority: Medium)
   - Catch and handle field-not-found errors gracefully
   - Provide meaningful error messages to help diagnose issues

4. **Add Query Validation** (Priority: Low)
   - Validate that required fields exist before querying
   - Add a pre-flight check for field availability

## Success Criteria

1. Child record counts display accurately for each parent record
2. No errors in console related to field names
3. Debugging output shows populated child counts map
4. UI displays correct totals and breakdowns per parent record

## Risk Mitigation

1. **Backward Compatibility**: Ensure changes work with both old and new field
   names if needed
2. **Performance**: Ensure additional queries don't significantly impact
   performance
3. **Error Recovery**: Gracefully handle cases where counts cannot be retrieved

## Future Improvements

1. Cache field metadata to avoid repeated field name issues
2. Add configuration for field name mappings
3. Implement a field discovery mechanism for dynamic field resolution
