# Migration Comparison Report: Interpretation Rule

## Overview
- **Source Record ID**: a5Y9r0000005zHNEAY (affdev sandbox)
- **Target Record ID**: a5Y9r0000006HHVEA2 (uat sandbox)
- **Record Name**: WA Casual Nurses
- **Record Type**: Shift Start Time

## Field Comparison

### Basic Information
| Field | Source (affdev) | Target (uat) | Match |
|-------|-----------------|--------------|-------|
| Name | WA Casual Nurses | WA Casual Nurses | ✅ |
| Record Type | Shift Start Time | Shift Start Time | ✅ |
| Status | Active | Active | ✅ |
| Short Description | WA Casual Nurses | WA Casual Nurses | ✅ |
| Long Description | WA Casual Nurses | WA Casual Nurses | ✅ |
| Timesheet Frequency | Weekly | Weekly | ✅ |

### Standard Hours Fields
| Field | Source (affdev) | Target (uat) | Match |
|-------|-----------------|--------------|-------|
| Monday Standard Hours | 24 | 24 | ✅ |
| Tuesday Standard Hours | 24 | 24 | ✅ |
| Wednesday Standard Hours | 24 | 24 | ✅ |
| Thursday Standard Hours | 24 | 24 | ✅ |
| Friday Standard Hours | 24 | 24 | ✅ |
| Saturday Standard Hours | 24 | 24 | ✅ |
| Sunday Standard Hours | 24 | 24 | ✅ |
| Public Holiday Standard Hours | 24 | 24 | ✅ |
| Frequency Standard Hours | 168 | null | ❌ |

### Configuration Fields
| Field | Source (affdev) | Target (uat) | Match |
|-------|-----------------|--------------|-------|
| Apply Break Loading Interpretation | No | null | ❌ |
| Apply Break Time Interpretation | Yes | null | ❌ |
| Apply Casual Loading | No | null | ❌ |
| Apply Dual Leave Loading Calculations | No | null | ❌ |
| Apply Excursion Interpretation | No | null | ❌ |
| Apply Interpretation Variations | Yes | null | ❌ |
| Apply Minimum Rest Interpretation | No | null | ❌ |
| Apply OT Round Up Shift Interpretation | No | null | ❌ |
| Apply Overnight Interpretation | Yes | null | ❌ |
| Has Saturday Rule | true | false | ❌ |
| Has Sunday Rule | true | false | ❌ |

### External ID
| Field | Source (affdev) | Target (uat) | Match |
|-------|-----------------|--------------|-------|
| External ID Data Creation | null | a5Y9r0000005zHNEAY | ✅ |

Note: The target record correctly has the source record's ID as its external ID, which confirms the migration relationship.

## Related Records

### Interpretation Breakpoints
- **Source**: 55 breakpoints found
- **Target**: 55 breakpoints found
- **Count Match**: ✅

The breakpoints include various types:
- Daily Pay Code Cap
- Frequency Pay Code Cap
- Frequency Standard Hours Breakpoint
- Day-specific Standard Hours Breakpoints (Monday-Sunday, Public Holiday)
- Day-specific Start Time Breakpoints
- Minimum Rest Breakpoint

### Interpretation Variation Rules
- **Source**: 4 variation rules found
  - WA Casual Nurses HD Overtime (Variation Type: HD Overtime)
  - WA Casual Nurses Recall (Variation Type: Recall)
  - WA Casual Nurses Higher Duties (Variation Type: Higher Duties)
  - WA Casual Nurses Overtime (Variation Type: Overtime)
- **Target**: 0 variation rules found
- **Count Match**: ❌

**Issue**: The interpretation variation rules were not migrated or not properly linked to the parent interpretation rule in the target org.

## Issues Found

### Critical Issues
1. **Missing Field Values**: Many boolean/picklist fields that have values in the source are null in the target:
   - All "Apply_*" configuration fields
   - Frequency Standard Hours (168 in source, null in target)
   - Has Saturday Rule (true → false)
   - Has Sunday Rule (true → false)

2. **Missing Interpretation Variation Rules**: 4 variation rules linked to the parent interpretation rule in the source were not found in the target org

### Possible Causes
1. **Field Mapping Issue**: The migration template may not be mapping these fields correctly
2. **Data Type Mismatch**: Boolean/picklist values might not be transforming properly
3. **Partial Migration**: Only certain fields were included in the migration scope

## Recommendations
1. Review the migration template field mappings for the missing fields
2. Check if there are any field-level security or permission issues in the target org
3. Consider re-running the migration with debug logging to identify transformation issues
4. Verify that all required fields are included in the migration template

## Summary
The core record structure and standard hours were migrated successfully, but many configuration fields are missing values in the target org. The related breakpoints were migrated with the correct count, but their field values should also be verified.