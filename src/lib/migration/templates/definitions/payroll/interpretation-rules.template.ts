import { MigrationTemplate } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const interpretationRulesTemplate: MigrationTemplate = {
    id: "payroll-interpretation-rules",
    name: "Interpretation Rules",
    description: "Migrate interpretation rules with breakpoints following exact legacy ETL pattern",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "interpretationRuleMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Apply_4_Week_Frequency__c,
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
                    {
                        sourceField: "tc9_et__Short_Description__c",
                        targetField: "tc9_et__Short_Description__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Long_Description__c",
                        targetField: "tc9_et__Long_Description__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Timesheet_Frequency__c",
                        targetField: "tc9_et__Timesheet_Frequency__c",
                        isRequired: false,
                        transformationType: "direct",
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
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
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
                        soqlQuery: "SELECT Id, External_Id__c, Name FROM tc9_et__Pay_Code__c",
                        cacheKey: "target_pay_codes",
                        description: "Cache all target org pay codes for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "payCodeExists",
                        description: "Verify all referenced pay codes exist in target org",
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_et__Pay_Code__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage: "Pay Code '{sourceValue}' referenced by Interpretation Rule '{recordName}' does not exist in target org",
                        warningMessage: "Pay Code '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "payCodeExternalIdNotNull",
                        description: "Ensure pay code external IDs are not null",
                        validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Rule__c WHERE tc9_et__Pay_Code__r.{externalIdField} = null AND tc9_et__Pay_Code__c != null",
                        expectedResult: "empty",
                        errorMessage: "Found interpretation rules with pay codes that have null external IDs",
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
                soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
                    tc9_et__Variation_Type__c, tc9_et__Variation_Record_Type__c,
                    {externalIdField} FROM tc9_et__Interpretation_Rule__c 
                    WHERE RecordType.Name = 'Interpretation Variation Rule'`,
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
                        sourceField: "tc9_et__Variation_Type__c",
                        targetField: "tc9_et__Variation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Variation_Record_Type__c",
                        targetField: "tc9_et__Variation_Record_Type__c",
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
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
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
                        queryName: "targetInterpretationRules",
                        soqlQuery: "SELECT Id, External_Id__c, Name FROM tc9_et__Interpretation_Rule__c",
                        cacheKey: "target_interpretation_rules",
                        description: "Cache all target org interpretation rules for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "interpretationRuleExists",
                        description: "Verify parent interpretation rule exists in target org",
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetObject: "tc9_et__Interpretation_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage: "Parent Interpretation Rule '{sourceValue}' for variation '{recordName}' does not exist in target org",
                    },
                ],
                dataIntegrityChecks: [],
            },
            dependencies: ["interpretationRuleMaster"],
        },
        {
            stepName: "interpretationBreakpointLeaveHeader",
            stepOrder: 3,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
                    tc9_et__Breakpoint_Type__c, tc9_et__Leave_Header__r.{externalIdField},
                    tc9_et__Leave_Rule__r.{externalIdField}, tc9_et__Start_Threshold__c,
                    tc9_et__End_Threshold__c, tc9_et__Daily_Quantity__c, {externalIdField}
                    FROM tc9_et__Interpretation_Breakpoint__c 
                    WHERE RecordType.Name = 'Leave Breakpoint' 
                    AND tc9_et__Breakpoint_Type__c = 'Leave Header'`,
                objectApiName: "tc9_et__Interpretation_Breakpoint__c",
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
                        sourceField: "tc9_et__Breakpoint_Type__c",
                        targetField: "tc9_et__Breakpoint_Type__c",
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
                        sourceField: "tc9_et__Leave_Header__r.{externalIdField}",
                        targetField: "tc9_et__Leave_Header__c",
                        lookupObject: "tc9_et__Leave_Header__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Leave_Rule__r.{externalIdField}",
                        targetField: "tc9_et__Leave_Rule__c",
                        lookupObject: "tc9_et__Leave_Rule__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                ],
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
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
                        soqlQuery: "SELECT Id, External_Id__c, Name FROM tc9_et__Leave_Header__c",
                        cacheKey: "target_leave_headers",
                        description: "Cache all target org leave headers for validation",
                    },
                    {
                        queryName: "targetLeaveRules",
                        soqlQuery: "SELECT Id, External_Id__c, Name FROM tc9_et__Leave_Rule__c",
                        cacheKey: "target_leave_rules",
                        description: "Cache all target org leave rules for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "interpretationRuleExists",
                        description: "Verify parent interpretation rule exists in target org",
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetObject: "tc9_et__Interpretation_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage: "Parent Interpretation Rule '{sourceValue}' for leave breakpoint '{recordName}' does not exist in target org",
                    },
                    {
                        checkName: "leaveHeaderExists",
                        description: "Verify referenced leave headers exist in target org",
                        sourceField: "tc9_et__Leave_Header__r.{externalIdField}",
                        targetObject: "tc9_et__Leave_Header__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage: "Leave Header '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage: "Leave Header '{sourceValue}' will need to be migrated first",
                    },
                    {
                        checkName: "leaveRuleExists",
                        description: "Verify referenced leave rules exist in target org",
                        sourceField: "tc9_et__Leave_Rule__r.{externalIdField}",
                        targetObject: "tc9_et__Leave_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage: "Leave Rule '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage: "Leave Rule '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "leaveBreakpointIntegrity",
                        description: "Verify leave breakpoints have required leave references",
                        validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE RecordType.Name = 'Leave Breakpoint' AND tc9_et__Breakpoint_Type__c = 'Leave Header' AND (tc9_et__Leave_Header__c = null OR tc9_et__Leave_Rule__c = null)",
                        expectedResult: "empty",
                        errorMessage: "Found leave breakpoints missing required leave header or leave rule references",
                        severity: "error",
                    },
                ],
            },
            dependencies: ["interpretationRuleMaster", "interpretationRuleVariation"],
        },
        {
            stepName: "interpretationBreakpointOther",
            stepOrder: 4,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
                    tc9_et__Breakpoint_Type__c, tc9_et__Pay_Code__r.{externalIdField},
                    tc9_et__Overtime_Pay_Code__r.{externalIdField}, tc9_et__Start_Threshold__c,
                    tc9_et__End_Threshold__c, tc9_et__Daily_Quantity__c, tc9_et__Minimum_Paid_Hours__c,
                    tc9_et__Pay_Code_Cap__c, {externalIdField}
                    FROM tc9_et__Interpretation_Breakpoint__c 
                    WHERE RecordType.Name != 'Pay Code Cap' AND RecordType.Name != 'Leave Breakpoint'`,
                objectApiName: "tc9_et__Interpretation_Breakpoint__c",
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
                        sourceField: "tc9_et__Breakpoint_Type__c",
                        targetField: "tc9_et__Breakpoint_Type__c",
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
                    {
                        sourceField: "tc9_et__Minimum_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Pay_Code_Cap__c",
                        targetField: "tc9_et__Pay_Code_Cap__c",
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
                        sourceField: "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Overtime_Pay_Code__c",
                        lookupObject: "tc9_et__Pay_Code__c",
                        lookupKeyField: "External_Id__c",
                        lookupValueField: "Id",
                        cacheResults: true,
                    },
                ],
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
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
                        soqlQuery: "SELECT Id, External_Id__c, Name FROM tc9_et__Pay_Code__c",
                        cacheKey: "target_pay_codes",
                        description: "Cache all target org pay codes for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "interpretationRuleExists",
                        description: "Verify parent interpretation rule exists in target org",
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetObject: "tc9_et__Interpretation_Rule__c",
                        targetField: "External_Id__c",
                        isRequired: true,
                        errorMessage: "Parent Interpretation Rule '{sourceValue}' for breakpoint '{recordName}' does not exist in target org",
                    },
                    {
                        checkName: "payCodeExists",
                        description: "Verify referenced pay codes exist in target org",
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_et__Pay_Code__c",
                        targetField: "External_Id__c",
                        isRequired: false,
                        errorMessage: "Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage: "Pay Code '{sourceValue}' will need to be migrated first",
                    },
                    {
                        checkName: "overtimePayCodeExists",
                        description: "Verify referenced overtime pay codes exist in target org",
                        sourceField: "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_et__Pay_Code__c",
                        targetField: "External_Id__c",
                        isRequired: false,
                        errorMessage: "Overtime Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                        warningMessage: "Overtime Pay Code '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "payCodeExternalIdConsistency",
                        description: "Check for pay codes with missing external IDs",
                        validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Pay_Code__c != null AND tc9_et__Pay_Code__r.{externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Found breakpoints with pay codes that have null external IDs",
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