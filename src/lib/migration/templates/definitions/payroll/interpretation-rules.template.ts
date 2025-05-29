import { MigrationTemplate, FieldMapping, LookupMapping, LoadConfig, ValidationConfig, DataIntegrityCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const interpretationRulesTemplate: MigrationTemplate = {
    id: "payroll-interpretation-rules",
    name: "Interpretation Rules",
    description: "Migrate interpretation rules with breakpoints",
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
                    tc9_et__Pay_Code__c, tc9_et__Pay_Code__r.{externalIdField}, tc9_et__Status__c, tc9_et__Short_Description__c,
                    tc9_et__Long_Description__c, tc9_et__Timesheet_Frequency__c, tc9_et__Total_Span_Hours__c,
                    tc9_et__Frequency_Standard_Hours__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c,
                    tc9_et__Monday_Standard_Hours__c, tc9_et__Tuesday_Standard_Hours__c, tc9_et__Wednesday_Standard_Hours__c,
                    tc9_et__Thursday_Standard_Hours__c, tc9_et__Friday_Standard_Hours__c, tc9_et__Saturday_Standard_Hours__c,
                    tc9_et__Sunday_Standard_Hours__c, tc9_et__Public_Holiday_Standard_Hours__c,
                    {externalIdField} FROM tc9_et__Interpretation_Rule__c 
                    WHERE RecordType.Name != 'Interpretation Variation Rule'`,
                objectApiName: "tc9_et__Interpretation_Rule__c",
                batchSize: 200,
            },
            transformConfig: {
                fieldMappings: [
                    {
                        sourceField: "Id",
                        targetField: "{externalIdField}",
                        isRequired: true,
                        transformationType: "direct",
                    },
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
                        transformationType: "direct"

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
                    {
                        sourceField: "tc9_et__Monday_Standard_Hours__c",
                        targetField: "tc9_et__Monday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Tuesday_Standard_Hours__c",
                        targetField: "tc9_et__Tuesday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Wednesday_Standard_Hours__c",
                        targetField: "tc9_et__Wednesday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Thursday_Standard_Hours__c",
                        targetField: "tc9_et__Thursday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Friday_Standard_Hours__c",
                        targetField: "tc9_et__Friday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Saturday_Standard_Hours__c",
                        targetField: "tc9_et__Saturday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Sunday_Standard_Hours__c",
                        targetField: "tc9_et__Sunday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Public_Holiday_Standard_Hours__c",
                        targetField: "tc9_et__Public_Holiday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                ],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                ],
                recordTypeMapping: {
                    sourceField: "RecordType.Name",
                    targetField: "RecordTypeId",
                    mappingDictionary: {
                        // Direct 1:1 mapping since record types are identical across systems
                        "Daily Rates": "{targetRecordTypeId}",
                        "Hourly Rates": "{targetRecordTypeId}",
                        "Interpretation Variation Rule": "{targetRecordTypeId}",
                        "Shift End Time": "{targetRecordTypeId}",
                        "Shift Start Time": "{targetRecordTypeId}",
                        
                        // Legacy mappings for any older record type names
                        "Master Interpretation Rule": "{targetRecordTypeId}",
                        "Standard Interpretation Rule": "{targetRecordTypeId}",
                    },
                },
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
            },
            loadConfig: {
                targetObject: "tc9_et__Interpretation_Rule__c",
                operation: "upsert",
                externalIdField: "{externalIdField}",
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
                        soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_pr__Pay_Code__c",
                        cacheKey: "target_pay_codes",
                        description: "Cache all target org pay codes for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "payCodeExists",
                        description: "Verify all referenced pay codes exist in target org",
                        sourceField: "tc9_et__Pay_Code__c",
                        targetObject: "tc9_pr__Pay_Code__c",
                        targetField: "{externalIdField}",
                        isRequired: false,
                        errorMessage: "Pay Code '{sourceValue}' referenced by Interpretation Rule '{recordName}' does not exist in target org",
                        warningMessage: "Pay Code '{sourceValue}' will need to be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "payCodeNotNull",
                        description: "Ensure pay code references are not null",
                        validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Rule__c WHERE tc9_et__Pay_Code__c IS NULL",
                        expectedResult: "empty",
                        errorMessage: "Found interpretation rules with null pay code references",
                        severity: "warning",
                    },
                    {
                        checkName: "crossEnvironmentExternalIdValidation",
                        description: "Validate external ID fields exist for cross-environment migration",
                        validationQuery: `SELECT COUNT() FROM tc9_pr__Pay_Code__c WHERE 
                            (External_ID_Data_Creation__c IS NULL AND tc9_edc__External_ID_Data_Creation__c IS NULL AND External_Id__c IS NULL)`,
                        expectedResult: "empty",
                        errorMessage: "Found pay codes without any external ID values. Cross-environment migration requires external IDs to be populated",
                        severity: "error",
                    },
                    {
                        checkName: "standardHoursValidation",
                        description: "Validate that Active interpretation rules (except Daily_Rates record type) have all standard hours populated",
                        validationQuery: `SELECT Id, Name, tc9_et__Status__c, RecordType.DeveloperName,
                            tc9_et__Monday_Standard_Hours__c, tc9_et__Tuesday_Standard_Hours__c, tc9_et__Wednesday_Standard_Hours__c,
                            tc9_et__Thursday_Standard_Hours__c, tc9_et__Friday_Standard_Hours__c, tc9_et__Saturday_Standard_Hours__c,
                            tc9_et__Sunday_Standard_Hours__c, tc9_et__Public_Holiday_Standard_Hours__c
                            FROM tc9_et__Interpretation_Rule__c 
                            WHERE tc9_et__Status__c = 'Active' 
                            AND RecordType.DeveloperName != 'Daily_Rates'
                            AND (tc9_et__Monday_Standard_Hours__c IS NULL 
                                OR tc9_et__Tuesday_Standard_Hours__c IS NULL 
                                OR tc9_et__Wednesday_Standard_Hours__c IS NULL
                                OR tc9_et__Thursday_Standard_Hours__c IS NULL 
                                OR tc9_et__Friday_Standard_Hours__c IS NULL 
                                OR tc9_et__Saturday_Standard_Hours__c IS NULL
                                OR tc9_et__Sunday_Standard_Hours__c IS NULL 
                                OR tc9_et__Public_Holiday_Standard_Hours__c IS NULL)`,
                        expectedResult: "empty",
                        errorMessage: "Unable to finalise rule. Standard Hours must be populated for every day on the Interpretation Rule",
                        severity: "error",
                    },
                    {
                        checkName: "interpretationRuleBreakpointsExist",
                        description: "Validate that each interpretation rule has associated breakpoints",
                        validationQuery: `SELECT ir.Id, ir.Name 
                            FROM tc9_et__Interpretation_Rule__c ir 
                            WHERE ir.RecordType.Name != 'Interpretation Variation Rule'
                            AND ir.Id NOT IN (
                                SELECT tc9_et__Interpretation_Rule__c 
                                FROM tc9_et__Interpretation_Breakpoint__c 
                                WHERE tc9_et__Interpretation_Rule__c IS NOT NULL
                            )`,
                        expectedResult: "empty",
                        errorMessage: "Interpretation rules must have associated breakpoints. Found interpretation rules without any breakpoints",
                        severity: "error",
                    },
                ],
            },
            dependencies: ["tc9_pr__Pay_Code__c"],
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
                        sourceField: "Id",
                        targetField: "{externalIdField}",
                        isRequired: true,
                        transformationType: "direct",
                    },
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
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                ],
                recordTypeMapping: {
                    sourceField: "RecordType.Name",
                    targetField: "RecordTypeId",
                    mappingDictionary: {
                        // Direct 1:1 mapping since record types are identical across systems
                        "Daily Rates": "{targetRecordTypeId}",
                        "Hourly Rates": "{targetRecordTypeId}",
                        "Interpretation Variation Rule": "{targetRecordTypeId}",
                        "Shift End Time": "{targetRecordTypeId}",
                        "Shift Start Time": "{targetRecordTypeId}",
                        
                        // Legacy mappings for any older record type names
                        "Master Interpretation Rule": "{targetRecordTypeId}",
                        "Standard Interpretation Rule": "{targetRecordTypeId}",
                    },
                },
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
            },
            loadConfig: {
                targetObject: "tc9_et__Interpretation_Rule__c",
                operation: "upsert",
                externalIdField: "{externalIdField}",
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
                        soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_et__Interpretation_Rule__c",
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
                        targetField: "{externalIdField}",
                        isRequired: true,
                        errorMessage: "Parent Interpretation Rule '{sourceValue}' for variation '{recordName}' does not exist in target org",
                    },
                ],
                dataIntegrityChecks: [],
            },
            dependencies: ["interpretationRuleMaster"],
        },
        // Shared configuration for interpretation breakpoint steps
        ...((): typeof interpretationRulesTemplate.etlSteps => {
            const interpretationBreakpointCommonConfig = {
                fieldMappings: [
                    {
                        sourceField: "Id",
                        targetField: "{externalIdField}",
                        isRequired: true,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "Name",
                        targetField: "Name",
                        isRequired: true,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Breakpoint_Type__c",
                        targetField: "tc9_et__Breakpoint_Type__c",
                        isRequired: true,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Additional_Interpretation_BP_Details__c",
                        targetField: "tc9_et__Additional_Interpretation_BP_Details__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Allowance_Type__c",
                        targetField: "tc9_et__Allowance_Type__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Daily_Quantity__c",
                        targetField: "tc9_et__Daily_Quantity__c",
                        isRequired: false,
                        transformationType: "number" as const,
                    },
                    {
                        sourceField: "tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c",
                        targetField: "tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__End_Threshold__c",
                        targetField: "tc9_et__End_Threshold__c",
                        isRequired: false,
                        transformationType: "number" as const,
                    },
                    {
                        sourceField: "tc9_et__End_Time__c",
                        targetField: "tc9_et__End_Time__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Has_Saturday_Rule__c",
                        targetField: "tc9_et__Has_Saturday_Rule__c",
                        isRequired: false,
                        transformationType: "boolean" as const,
                    },
                    {
                        sourceField: "tc9_et__Has_Sunday_Rule__c",
                        targetField: "tc9_et__Has_Sunday_Rule__c",
                        isRequired: false,
                        transformationType: "boolean" as const,
                    },
                    {
                        sourceField: "tc9_et__Minimum_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number" as const,
                    },
                    {
                        sourceField: "tc9_et__No_Cap_Required__c",
                        targetField: "tc9_et__No_Cap_Required__c",
                        isRequired: false,
                        transformationType: "boolean" as const,
                    },
                    {
                        sourceField: "tc9_et__Overtime_Breakpoint__c",
                        targetField: "tc9_et__Overtime_Breakpoint__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Pay_Code_Cap__c",
                        targetField: "tc9_et__Pay_Code_Cap__c",
                        isRequired: false,
                        transformationType: "number" as const,
                    },
                    {
                        sourceField: "tc9_et__Pay_Partial_Quantity__c",
                        targetField: "tc9_et__Pay_Partial_Quantity__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Primary_Interpretation_Breakpoint__c",
                        targetField: "tc9_et__Primary_Interpretation_Breakpoint__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Reset_After_Payment__c",
                        targetField: "tc9_et__Reset_After_Payment__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Secondary_Interpretation_Breakpoint__c",
                        targetField: "tc9_et__Secondary_Interpretation_Breakpoint__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Start_Threshold__c",
                        targetField: "tc9_et__Start_Threshold__c",
                        isRequired: false,
                        transformationType: "number" as const,
                    },
                    {
                        sourceField: "tc9_et__Start_Threshold_Type__c",
                        targetField: "tc9_et__Start_Threshold_Type__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Start_Time__c",
                        targetField: "tc9_et__Start_Time__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                    {
                        sourceField: "tc9_et__Variation_Type__c",
                        targetField: "tc9_et__Variation_Type__c",
                        isRequired: false,
                        transformationType: "direct" as const,
                    },
                ] as FieldMapping[],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Interpretation_Rule__c",
                        targetField: "tc9_et__Interpretation_Rule__c",
                        lookupObject: "tc9_et__Interpretation_Rule__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Casual_Loading_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Casual_Loading_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Daily_Pay_Code_Cap_Record__r.{externalIdField}",
                        targetField: "tc9_et__Daily_Pay_Code_Cap_Record__c",
                        lookupObject: "tc9_et__Interpretation_Breakpoint__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Frequency_Pay_Code_Cap_Record__r.{externalIdField}",
                        targetField: "tc9_et__Frequency_Pay_Code_Cap_Record__c",
                        lookupObject: "tc9_et__Interpretation_Breakpoint__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Leave_Header__r.{externalIdField}",
                        targetField: "tc9_et__Leave_Header__c",
                        lookupObject: "tc9_et__Leave_Header__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Leave_Loading_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Leave_Loading_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Leave_Rule__r.{externalIdField}",
                        targetField: "tc9_et__Leave_Rule__c",
                        lookupObject: "tc9_pr__Leave_Rule__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Overtime_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Penalty_Loading_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Penalty_Loading_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Public_Holiday_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Public_Holiday_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Saturday_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Saturday_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Sunday_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Sunday_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                ] as LookupMapping[],
                loadConfig: {
                    targetObject: "tc9_et__Interpretation_Breakpoint__c",
                    operation: "upsert" as const,
                    externalIdField: "{externalIdField}",
                    useBulkApi: true,
                    batchSize: 200,
                    allowPartialSuccess: false,
                    retryConfig: {
                        maxRetries: 3,
                        retryWaitSeconds: 30,
                        retryableErrors: ["UNABLE_TO_LOCK_ROW", "TIMEOUT"],
                    },
                } as LoadConfig,
                validationConfig: {
                    preValidationQueries: [
                        {
                            queryName: "targetPayCodes",
                            soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_pr__Pay_Code__c",
                            cacheKey: "target_pay_codes",
                            description: "Cache all target org pay codes for validation",
                        },
                        {
                            queryName: "targetLeaveHeaders",
                            soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_et__Leave_Header__c",
                            cacheKey: "target_leave_headers",
                            description: "Cache all target org leave headers for validation",
                        },
                        {
                            queryName: "targetLeaveRules",
                            soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_pr__Leave_Rule__c",
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
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Parent Interpretation Rule '{sourceValue}' for breakpoint '{recordName}' does not exist in target org",
                        },
                        {
                            checkName: "payCodeExists",
                            description: "Verify referenced pay codes exist in target org",
                            sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                            targetObject: "tc9_pr__Pay_Code__c",
                            targetField: "{externalIdField}",
                            isRequired: false,
                            errorMessage: "Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                            warningMessage: "Pay Code '{sourceValue}' will need to be migrated first",
                        },
                        {
                            checkName: "leaveHeaderExists",
                            description: "Verify referenced leave headers exist in target org",
                            sourceField: "tc9_et__Leave_Header__r.{externalIdField}",
                            targetObject: "tc9_et__Leave_Header__c",
                            targetField: "{externalIdField}",
                            isRequired: false,
                            errorMessage: "Leave Header '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                            warningMessage: "Leave Header '{sourceValue}' will need to be migrated first",
                        },
                        {
                            checkName: "leaveRuleExists",
                            description: "Verify referenced leave rules exist in target org",
                            sourceField: "tc9_et__Leave_Rule__r.{externalIdField}",
                            targetObject: "tc9_pr__Leave_Rule__c",
                            targetField: "{externalIdField}",
                            isRequired: false,
                            errorMessage: "Leave Rule '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                            warningMessage: "Leave Rule '{sourceValue}' will need to be migrated first",
                        },
                        {
                            checkName: "overtimePayCodeExists",
                            description: "Verify referenced overtime pay codes exist in target org",
                            sourceField: "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                            targetObject: "tc9_pr__Pay_Code__c",
                            targetField: "{externalIdField}",
                            isRequired: false,
                            errorMessage: "Overtime Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org",
                            warningMessage: "Overtime Pay Code '{sourceValue}' will need to be migrated first",
                        },
                    ],
                    dataIntegrityChecks: [
                        {
                            checkName: "payCodeCapIntegrity",
                            description: "Verify pay code cap breakpoints have required references",
                            validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE RecordType.Name = 'Pay Code Cap' AND tc9_et__Pay_Code__c IS NULL",
                            expectedResult: "empty" as const,
                            errorMessage: "Found pay code cap breakpoints missing required pay code references",
                            severity: "warning" as const,
                        },
                        {
                            checkName: "leaveBreakpointIntegrity",
                            description: "Verify leave breakpoints have required leave references",
                            validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE RecordType.Name = 'Leave Breakpoint' AND tc9_et__Breakpoint_Type__c = 'Leave Header' AND (tc9_et__Leave_Header__c IS NULL OR tc9_et__Leave_Rule__c IS NULL)",
                            expectedResult: "empty" as const,
                            errorMessage: "Found leave breakpoints missing required leave header or leave rule references",
                            severity: "error" as const,
                        },
                    ] as DataIntegrityCheck[],
                } as ValidationConfig,
            };

            return [
                {
                    stepName: "interpretationBreakpointLeaveHeader",
                    stepOrder: 3,
                    extractConfig: {
                        soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
                            tc9_et__Breakpoint_Type__c, tc9_et__Additional_Interpretation_BP_Details__c,
                            tc9_et__Allowance_Type__c, tc9_et__Casual_Loading_Pay_Code__r.{externalIdField},
                            tc9_et__Daily_Pay_Code_Cap_Record__r.{externalIdField}, tc9_et__Daily_Pay_Code_Cap_Value__c,
                            tc9_et__Daily_Quantity__c, tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c,
                            tc9_et__End_Threshold__c, tc9_et__End_Time__c, tc9_et__Frequency_Pay_Code_Cap_Record__r.{externalIdField},
                            tc9_et__Frequency_Pay_Code_Cap_Value__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c,
                            tc9_et__Leave_Header__r.{externalIdField}, tc9_et__Leave_Loading_Pay_Code__r.{externalIdField},
                            tc9_et__Leave_Rule__r.{externalIdField}, tc9_et__Minimum_Paid_Hours__c, tc9_et__No_Cap_Required__c,
                            tc9_et__Overtime_Breakpoint__c, tc9_et__Overtime_Pay_Code__r.{externalIdField},
                            tc9_et__Pay_Code__r.{externalIdField}, tc9_et__Pay_Code_Cap__c, tc9_et__Pay_Partial_Quantity__c,
                            tc9_et__Penalty_Loading_Pay_Code__r.{externalIdField}, tc9_et__Primary_Interpretation_Breakpoint__c,
                            tc9_et__Public_Holiday_Pay_Code__r.{externalIdField}, tc9_et__Reset_After_Payment__c,
                            tc9_et__Saturday_Pay_Code__r.{externalIdField}, tc9_et__Secondary_Interpretation_Breakpoint__c,
                            tc9_et__Start_Threshold__c, tc9_et__Start_Threshold_Type__c, tc9_et__Start_Time__c,
                            tc9_et__Sunday_Pay_Code__r.{externalIdField}, tc9_et__Variation_Type__c, {externalIdField}
                            FROM tc9_et__Interpretation_Breakpoint__c 
                            WHERE RecordType.Name = 'Leave Breakpoint' 
                            AND tc9_et__Breakpoint_Type__c = 'Leave Header'
                            AND tc9_et__Interpretation_Rule__c IN (SELECT Id FROM tc9_et__Interpretation_Rule__c WHERE Id IN ({selectedRecordIds}))`,
                        objectApiName: "tc9_et__Interpretation_Breakpoint__c",
                        batchSize: 200,
                    },
                    transformConfig: {
                        fieldMappings: interpretationBreakpointCommonConfig.fieldMappings,
                        lookupMappings: interpretationBreakpointCommonConfig.lookupMappings,
                        recordTypeMapping: {
                            sourceField: "RecordType.Name",
                            targetField: "RecordTypeId",
                            mappingDictionary: {
                                "Leave Breakpoint": "{targetRecordTypeId}",
                            },
                        },
                        externalIdHandling: ExternalIdUtils.createDefaultConfig(),
                    },
                    loadConfig: interpretationBreakpointCommonConfig.loadConfig,
                    validationConfig: interpretationBreakpointCommonConfig.validationConfig,
                    dependencies: ["interpretationRuleMaster", "interpretationRuleVariation"],
                },
                {
                    stepName: "interpretationBreakpointPayCodeCap",
                    stepOrder: 4,
                    extractConfig: {
                        soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
                            tc9_et__Breakpoint_Type__c, tc9_et__Additional_Interpretation_BP_Details__c,
                            tc9_et__Allowance_Type__c, tc9_et__Casual_Loading_Pay_Code__r.{externalIdField},
                            tc9_et__Daily_Pay_Code_Cap_Record__r.{externalIdField}, tc9_et__Daily_Pay_Code_Cap_Value__c,
                            tc9_et__Daily_Quantity__c, tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c,
                            tc9_et__End_Threshold__c, tc9_et__End_Time__c, tc9_et__Frequency_Pay_Code_Cap_Record__r.{externalIdField},
                            tc9_et__Frequency_Pay_Code_Cap_Value__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c,
                            tc9_et__Leave_Header__r.{externalIdField}, tc9_et__Leave_Loading_Pay_Code__r.{externalIdField},
                            tc9_et__Leave_Rule__r.{externalIdField}, tc9_et__Minimum_Paid_Hours__c, tc9_et__No_Cap_Required__c,
                            tc9_et__Overtime_Breakpoint__c, tc9_et__Overtime_Pay_Code__r.{externalIdField},
                            tc9_et__Pay_Code__r.{externalIdField}, tc9_et__Pay_Code_Cap__c, tc9_et__Pay_Partial_Quantity__c,
                            tc9_et__Penalty_Loading_Pay_Code__r.{externalIdField}, tc9_et__Primary_Interpretation_Breakpoint__c,
                            tc9_et__Public_Holiday_Pay_Code__r.{externalIdField}, tc9_et__Reset_After_Payment__c,
                            tc9_et__Saturday_Pay_Code__r.{externalIdField}, tc9_et__Secondary_Interpretation_Breakpoint__c,
                            tc9_et__Start_Threshold__c, tc9_et__Start_Threshold_Type__c, tc9_et__Start_Time__c,
                            tc9_et__Sunday_Pay_Code__r.{externalIdField}, tc9_et__Variation_Type__c, {externalIdField}
                            FROM tc9_et__Interpretation_Breakpoint__c 
                            WHERE (RecordType.Name = 'Pay Code Cap' OR RecordType.Name = 'Leave Breakpoint') 
                            AND tc9_et__Breakpoint_Type__c != 'Leave Header'
                            AND tc9_et__Interpretation_Rule__c IN (SELECT Id FROM tc9_et__Interpretation_Rule__c WHERE Id IN ({selectedRecordIds}))`,
                        objectApiName: "tc9_et__Interpretation_Breakpoint__c",
                        batchSize: 200,
                    },
                    transformConfig: {
                        fieldMappings: interpretationBreakpointCommonConfig.fieldMappings,
                        lookupMappings: interpretationBreakpointCommonConfig.lookupMappings,
                        recordTypeMapping: {
                            sourceField: "RecordType.Name",
                            targetField: "RecordTypeId",
                            mappingDictionary: {
                                "Pay Code Cap": "{targetRecordTypeId}",
                                "Leave Breakpoint": "{targetRecordTypeId}",
                            },
                        },
                        externalIdHandling: ExternalIdUtils.createDefaultConfig(),
                    },
                    loadConfig: interpretationBreakpointCommonConfig.loadConfig,
                    validationConfig: interpretationBreakpointCommonConfig.validationConfig,
                    dependencies: ["interpretationBreakpointLeaveHeader"],
                },
                {
                    stepName: "interpretationBreakpointOther",
                    stepOrder: 5,
                    extractConfig: {
                        soqlQuery: `SELECT Id, Name, RecordType.Name, tc9_et__Interpretation_Rule__c,
                            tc9_et__Breakpoint_Type__c, tc9_et__Additional_Interpretation_BP_Details__c,
                            tc9_et__Allowance_Type__c, tc9_et__Casual_Loading_Pay_Code__r.{externalIdField},
                            tc9_et__Daily_Pay_Code_Cap_Record__r.{externalIdField}, tc9_et__Daily_Pay_Code_Cap_Value__c,
                            tc9_et__Daily_Quantity__c, tc9_et__Days_Leave_Applies_To_OT_And_Frequency__c,
                            tc9_et__End_Threshold__c, tc9_et__End_Time__c, tc9_et__Frequency_Pay_Code_Cap_Record__r.{externalIdField},
                            tc9_et__Frequency_Pay_Code_Cap_Value__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c,
                            tc9_et__Leave_Header__r.{externalIdField}, tc9_et__Leave_Loading_Pay_Code__r.{externalIdField},
                            tc9_et__Leave_Rule__r.{externalIdField}, tc9_et__Minimum_Paid_Hours__c, tc9_et__No_Cap_Required__c,
                            tc9_et__Overtime_Breakpoint__c, tc9_et__Overtime_Pay_Code__r.{externalIdField},
                            tc9_et__Pay_Code__r.{externalIdField}, tc9_et__Pay_Code_Cap__c, tc9_et__Pay_Partial_Quantity__c,
                            tc9_et__Penalty_Loading_Pay_Code__r.{externalIdField}, tc9_et__Primary_Interpretation_Breakpoint__c,
                            tc9_et__Public_Holiday_Pay_Code__r.{externalIdField}, tc9_et__Reset_After_Payment__c,
                            tc9_et__Saturday_Pay_Code__r.{externalIdField}, tc9_et__Secondary_Interpretation_Breakpoint__c,
                            tc9_et__Start_Threshold__c, tc9_et__Start_Threshold_Type__c, tc9_et__Start_Time__c,
                            tc9_et__Sunday_Pay_Code__r.{externalIdField}, tc9_et__Variation_Type__c, {externalIdField}
                            FROM tc9_et__Interpretation_Breakpoint__c 
                            WHERE RecordType.Name != 'Pay Code Cap' AND RecordType.Name != 'Leave Breakpoint'
                            AND tc9_et__Interpretation_Rule__c IN (SELECT Id FROM tc9_et__Interpretation_Rule__c WHERE Id IN ({selectedRecordIds}))`,
                        objectApiName: "tc9_et__Interpretation_Breakpoint__c",
                        batchSize: 200,
                    },
                    transformConfig: {
                        fieldMappings: interpretationBreakpointCommonConfig.fieldMappings,
                        lookupMappings: interpretationBreakpointCommonConfig.lookupMappings,
                        recordTypeMapping: {
                            sourceField: "RecordType.Name",
                            targetField: "RecordTypeId",
                            mappingDictionary: {
                                // Direct 1:1 mapping since record types are identical across systems
                                "Allowance Breakpoint": "{targetRecordTypeId}",
                                "Break Loading Overtime": "{targetRecordTypeId}",
                                "Daily Hours Breakpoint": "{targetRecordTypeId}",
                                "Daily Rate": "{targetRecordTypeId}",
                                "Frequency Hours Breakpoint": "{targetRecordTypeId}",
                                "Interpretation Breakpoint Junction": "{targetRecordTypeId}",
                                "Leave Breakpoint": "{targetRecordTypeId}",
                                "Minimum Rest": "{targetRecordTypeId}",
                                "Overtime Round Up Shift": "{targetRecordTypeId}",
                                "Pay Code Cap": "{targetRecordTypeId}",
                                "Shift End Time Breakpoint": "{targetRecordTypeId}",
                                "Shift Start Time Breakpoint": "{targetRecordTypeId}",
                                "Sleepover": "{targetRecordTypeId}",
                                "Split/Broken Shift": "{targetRecordTypeId}",
                                "Time Breakpoint": "{targetRecordTypeId}",
                                
                                // Legacy mappings for any older record type names
                                "Standard Breakpoint": "{targetRecordTypeId}",
                                "Overtime Breakpoint": "{targetRecordTypeId}",
                            },
                        },
                        externalIdHandling: ExternalIdUtils.createDefaultConfig(),
                    },
                    loadConfig: interpretationBreakpointCommonConfig.loadConfig,
                    validationConfig: {
                        ...interpretationBreakpointCommonConfig.validationConfig,
                        dataIntegrityChecks: [
                            ...interpretationBreakpointCommonConfig.validationConfig.dataIntegrityChecks,
                            {
                                checkName: "payCodeExternalIdConsistency",
                                description: "Check for pay codes with missing external IDs",
                                validationQuery: "SELECT COUNT() FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Pay_Code__c IS NOT NULL AND tc9_et__Pay_Code__r.{externalIdField} IS NULL",
                                expectedResult: "empty" as const,
                                errorMessage: "Found breakpoints with pay codes that have null external IDs",
                                severity: "warning" as const,
                            },
                            {
                                checkName: "recordTypeMappingCoverage",
                                description: "Identify source record types that are not mapped in the template",
                                validationQuery: "SELECT RecordType.Name, COUNT(Id) recordCount FROM tc9_et__Interpretation_Breakpoint__c WHERE RecordType.Name != 'Pay Code Cap' AND RecordType.Name != 'Leave Breakpoint' AND RecordType.Name NOT IN ('Standard Breakpoint', 'Time Breakpoint', 'Overtime Breakpoint') GROUP BY RecordType.Name",
                                expectedResult: "empty" as const,
                                errorMessage: "Found source record types that are not mapped in the template. Please update the recordTypeMapping to include all source record types",
                                severity: "error" as const,
                            },
                        ] as DataIntegrityCheck[],
                    },
                    dependencies: ["interpretationBreakpointPayCodeCap"],
                },
            ];
        })(),
    ],
    executionOrder: [
        "interpretationRuleMaster",
        "interpretationRuleVariation",
        "interpretationBreakpointLeaveHeader",
        "interpretationBreakpointPayCodeCap",
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