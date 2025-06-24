## SOQL syntax

- IS NOT NULL with != null
- IS NULL with = null

## Logs

- /Users/jessewindebank/Documents/code/salesforce/tc9-migration-tool/migration-output.log stores the output of migration runs

## CLI Commands

- 'npm run dev:fresh:env' - to run local server

## Testing Migration Process

### Test the Validation Step
Use the validate endpoint to test validation without performing migration:
```bash
curl -X POST http://localhost:3000/api/migrations/validate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceOrgId": "359769d1-d0a5-425f-8d56-ed0c90992140",
    "targetOrgId": "741427e6-dfe8-4068-b96c-7ea4809916f5",
    "templateId": "payroll-interpretation-rules",
    "selectedRecordIds": ["a5Y9r0000005siwEAA"]
  }' | jq .
```

### Test the Migration Step
Use the test-execute endpoint to test migration with real data:
```bash
curl -X POST http://localhost:3000/api/migrations/test-execute \
  -H "Content-Type: application/json" \
  -d '{
    "sourceOrgId": "359769d1-d0a5-425f-8d56-ed0c90992140",
    "targetOrgId": "741427e6-dfe8-4068-b96c-7ea4809916f5",
    "templateId": "payroll-interpretation-rules",
    "selectedRecords": ["a5Y9r0000005siwEAA"]
  }' | jq .
```

### Check Datasets Using SF CLI

1. Query source org data:
```bash
# Check interpretation rules in source org (use appropriate alias like 'migrationToolFull' or email)
sf data query --query "SELECT Id, Name, tc9_et__Pay_Code__c, tc9_et__Pay_Code__r.tc9_edc__External_ID_Data_Creation__c FROM tc9_et__Interpretation_Rule__c WHERE Id = 'a5Y9r0000005siwEAA'" --target-org migrationToolFull

# Check related breakpoints in source org
sf data query --query "SELECT Id, Name, tc9_et__Interpretation_Rule__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = 'a5Y9r0000005siwEAA'" --target-org migrationToolFull
```

2. Query target org data (after migration):
```bash
# Check migrated interpretation rule in target org
sf data query --query "SELECT Id, Name, tc9_edc__External_ID_Data_Creation__c, tc9_et__Pay_Code__c FROM tc9_et__Interpretation_Rule__c WHERE tc9_edc__External_ID_Data_Creation__c = 'a5Y9r0000005siwEAA'" --target-org migrationTool

# Check migrated breakpoints in target org
sf data query --query "SELECT Id, Name, tc9_et__Interpretation_Rule__c, tc9_edc__External_ID_Data_Creation__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__r.tc9_edc__External_ID_Data_Creation__c = 'a5Y9r0000005siwEAA'" --target-org migrationTool
```

3. Verify pay code references:
```bash
# Check pay codes in source org
sf data query --query "SELECT Id, Name, tc9_edc__External_ID_Data_Creation__c FROM tc9_pr__Pay_Code__c LIMIT 10" --target-org migrationToolFull

# Check pay codes in target org
sf data query --query "SELECT Id, Name, tc9_edc__External_ID_Data_Creation__c FROM tc9_pr__Pay_Code__c LIMIT 10" --target-org migrationTool

# List all available orgs
sf org list
```

### Verify Record and Field Mapping

1. Compare interpretation rule fields:
```bash
# Source interpretation rule with all fields
sf data query --query "SELECT Id, Name, tc9_et__Pay_Code__c, tc9_et__Status__c, tc9_et__Monday_Standard_Hours__c, tc9_et__Tuesday_Standard_Hours__c, tc9_et__Wednesday_Standard_Hours__c, tc9_et__Thursday_Standard_Hours__c, tc9_et__Friday_Standard_Hours__c, tc9_et__Saturday_Standard_Hours__c, tc9_et__Sunday_Standard_Hours__c FROM tc9_et__Interpretation_Rule__c WHERE Id = 'a5Y9r0000005siwEAA'" --target-org <source-org-alias>

# Target interpretation rule with external ID
sf data query --query "SELECT Id, Name, tc9_edc__External_ID_Data_Creation__c, tc9_et__Pay_Code__c, tc9_et__Status__c, tc9_et__Monday_Standard_Hours__c, tc9_et__Tuesday_Standard_Hours__c, tc9_et__Wednesday_Standard_Hours__c, tc9_et__Thursday_Standard_Hours__c, tc9_et__Friday_Standard_Hours__c, tc9_et__Saturday_Standard_Hours__c, tc9_et__Sunday_Standard_Hours__c FROM tc9_et__Interpretation_Rule__c WHERE tc9_edc__External_ID_Data_Creation__c = 'a5Y9r0000005siwEAA'" --target-org <target-org-alias>
```

2. Compare breakpoint fields:
```bash
# Source breakpoint with numeric fields
sf data query --query "SELECT Id, Name, tc9_et__Breakpoint_Type__c, tc9_et__Start_Threshold__c, tc9_et__End_Threshold__c, tc9_et__Pay_Code_Cap__c, tc9_et__Minimum_Paid_Hours__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = 'a5Y9r0000005siwEAA' AND Name = 'Daily Pay Code Cap 1' LIMIT 1" --target-org <source-org-alias>

# Target breakpoint using external ID
sf data query --query "SELECT Id, Name, tc9_edc__External_ID_Data_Creation__c, tc9_et__Breakpoint_Type__c, tc9_et__Start_Threshold__c, tc9_et__End_Threshold__c, tc9_et__Pay_Code_Cap__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_edc__External_ID_Data_Creation__c = '<source-breakpoint-id>'" --target-org <target-org-alias>
```

3. Count records:
```bash
# Count breakpoints in source
sf data query --query "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = 'a5Y9r0000005siwEAA'" --target-org <source-org-alias>

# Count breakpoints in target (use the migrated interpretation rule ID)
sf data query --query "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = '<target-interpretation-rule-id>'" --target-org <target-org-alias>
```

4. Check breakpoint type distribution:
```bash
# Group by breakpoint type in source
sf data query --query "SELECT tc9_et__Breakpoint_Type__c, COUNT(Id) cnt FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Interpretation_Rule__c = 'a5Y9r0000005siwEAA' GROUP BY tc9_et__Breakpoint_Type__c" --target-org <source-org-alias>
```

### Common Test Org Aliases
- Source: `affinitynursingrecruitment.support@2cloudnine.com.affdev`
- Target: `affinitynursingrecruitment.support@2cloudnine.com.uat`