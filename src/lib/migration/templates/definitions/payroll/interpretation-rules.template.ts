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
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Break_Loading_Interpretation__c",
                        targetField: "tc9_et__Apply_Break_Loading_Interpretation__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Break_Time_Interpretation__c",
                        targetField: "tc9_et__Apply_Break_Time_Interpretation__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Casual_Loading__c",
                        targetField: "tc9_et__Apply_Casual_Loading__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Dual_Leave_Loading_Calculations__c",
                        targetField: "tc9_et__Apply_Dual_Leave_Loading_Calculations__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Excursion_Interpretation__c",
                        targetField: "tc9_et__Apply_Excursion_Interpretation__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Interpretation_Variations__c",
                        targetField: "tc9_et__Apply_Interpretation_Variations__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Minimum_Rest_Interpretation__c",
                        targetField: "tc9_et__Apply_Minimum_Rest_Interpretation__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Minimum_Rest_on_Overtime__c",
                        targetField: "tc9_et__Apply_Minimum_Rest_on_Overtime__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c",
                        targetField: "tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c",
                        isRequired: false,
                        transformationType: "boolean"
                    },
                    {
                        sourceField: "tc9_et__Apply_Overnight_Interpretation__c",
                        targetField: "tc9_et__Apply_Overnight_Interpretation__c",
                        isRequired: false,
                        transformationType: "boolean"
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
                        sourceField: "tc9_et__Total_Span_Hours__c",
                        targetField: "tc9_et__Total_Span_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Frequency_Standard_Hours__c",
                        targetField: "tc9_et__Frequency_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Has_Saturday_Rule__c",
                        targetField: "tc9_et__Has_Saturday_Rule__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Has_Sunday_Rule__c",
                        targetField: "tc9_et__Has_Sunday_Rule__c",
                        isRequired: false,
                        transformationType: "boolean",
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
                    // Removed payCodeExists validation per customer request - no longer needed
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "sourcePayCodeExternalIdValidation",
                        description: "Validate that all source pay codes referenced by interpretation rules have external ID values",
                        validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                            WHERE Id IN (
                                SELECT tc9_et__Pay_Code__c 
                                FROM tc9_et__Interpretation_Rule__c 
                                WHERE tc9_et__Pay_Code__c != null
                            )
                            AND ({externalIdField} = null)`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Found pay codes referenced by interpretation rules that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
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
                            AND (tc9_et__Monday_Standard_Hours__c = null 
                                OR tc9_et__Tuesday_Standard_Hours__c = null 
                                OR tc9_et__Wednesday_Standard_Hours__c = null
                                OR tc9_et__Thursday_Standard_Hours__c = null 
                                OR tc9_et__Friday_Standard_Hours__c = null 
                                OR tc9_et__Saturday_Standard_Hours__c = null
                                OR tc9_et__Sunday_Standard_Hours__c = null 
                                OR tc9_et__Public_Holiday_Standard_Hours__c = null)`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Standard Hours must be populated for every day on Active Interpretation Rules (except Daily_Rates record type)",
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
                                WHERE tc9_et__Interpretation_Rule__c != null
                            )`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Interpretation rules must have associated breakpoints. Found interpretation rules without any breakpoints",
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
                    tc9_et__Apply_4_Week_Frequency__c, tc9_et__Apply_Break_Loading_Interpretation__c,
                    tc9_et__Apply_Break_Time_Interpretation__c, tc9_et__Apply_Casual_Loading__c,
                    tc9_et__Apply_Dual_Leave_Loading_Calculations__c, tc9_et__Apply_Excursion_Interpretation__c,
                    tc9_et__Apply_Interpretation_Variations__c, tc9_et__Apply_Minimum_Rest_Interpretation__c,
                    tc9_et__Apply_Minimum_Rest_on_Overtime__c, tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c,
                    tc9_et__Apply_Overnight_Interpretation__c, tc9_et__Apply_Overnight_Majority_Friday__c,
                    tc9_et__Apply_Overnight_Majority_Monday__c, tc9_et__Apply_Overnight_Majority_Public_Holiday__c,
                    tc9_et__Apply_Overnight_Majority_Saturday__c, tc9_et__Apply_Overnight_Majority_Sunday__c,
                    tc9_et__Apply_Overnight_Majority_Thursday__c, tc9_et__Apply_Overnight_Majority_Tuesday__c,
                    tc9_et__Apply_Overnight_Majority_Wednesday__c, tc9_et__Apply_Overnight_Majority_Weekday__c,
                    tc9_et__Apply_Partial_Daily_Rates__c, tc9_et__Apply_Penalty_Loading__c,
                    tc9_et__Apply_Shift_End_Or_Start_Interpretation__c, tc9_et__Apply_Sleepover_Interpretation__c,
                    tc9_et__Apply_Split_Broken_Shift_Interpretation__c, tc9_et__Apply_Wake_Up_Interpretation__c,
                    tc9_et__Assignment__c, tc9_et__Break_Loading_Hours_Exceeded__c,
                    tc9_et__Break_Loading_Unpaid_Break_Minutes__c, tc9_et__Broken_Shift_Breakpoint_Application__c,
                    tc9_et__Broken_Shift_Timesheet_Activity_Required__c, tc9_et__Days_Frequency_Breakpoints_Accrued__c,
                    tc9_et__Days_Frequency_Breakpoints_Apply__c, tc9_et__Days_Minimum_Rest_Hours_Apply2__c,
                    tc9_et__Days_Minimum_Rest_Hours_Apply__c, tc9_et__Days_Overtime_Breakpoints_Reset__c,
                    tc9_et__Days_Total_Span_Hours_Apply2__c, tc9_et__Days_Total_Span_Hours_Apply__c,
                    tc9_et__Exclude_Overtime_from_Frequency_Hours__c, tc9_et__Excursion_Standard_End_Time__c,
                    tc9_et__Excursion_Standard_Hours__c, tc9_et__Excursion_Standard_Start_Time__c,
                    tc9_et__Frequency_Standard_Hours__c, tc9_et__Friday_Interpretation_Type__c,
                    tc9_et__Friday_Standard_Hours__c, tc9_et__Has_Saturday_Rule__c, tc9_et__Has_Sunday_Rule__c,
                    tc9_et__Higher_Rate_Friday__c, tc9_et__Higher_Rate_Monday__c,
                    tc9_et__Higher_Rate_Public_Holiday__c, tc9_et__Higher_Rate_Saturday__c,
                    tc9_et__Higher_Rate_Sunday__c, tc9_et__Higher_Rate_Thursday__c,
                    tc9_et__Higher_Rate_Tuesday__c, tc9_et__Higher_Rate_Wednesday__c,
                    tc9_et__Higher_Rate_Weekday__c, tc9_et__Include_Break_Overtime_In_Overtime__c,
                    tc9_et__Include_Minimum_Rest_in_Daily_OT_Hours__c, tc9_et__Include_Paid_Breaks_in_Break_Loading__c,
                    tc9_et__Include_Time_Breakpoints_In_Overtime__c, tc9_et__Interpretation_Rule_Name__c,
                    tc9_et__Interpretation_Rule_Template_Group__c, tc9_et__Is_Standard_Time_for_Friday_Required__c,
                    tc9_et__Is_Standard_Time_for_Monday_Required__c, tc9_et__Is_Standard_Time_for_Public_Holidays_Req__c,
                    tc9_et__Is_Standard_Time_for_Saturday_Required__c, tc9_et__Is_Standard_Time_for_Sunday_Required__c,
                    tc9_et__Is_Standard_Time_for_Thursday_Required__c, tc9_et__Is_Standard_Time_for_Tuesday_Required__c,
                    tc9_et__Is_Standard_Time_for_Wednesday_Required__c, tc9_et__Is_Standard_Time_for_Weekdays_Required__c,
                    tc9_et__Long_Description__c, tc9_et__Minimum_Frequency_Paid_Hours__c,
                    tc9_et__Minimum_Friday_Paid_Hours__c, tc9_et__Minimum_Hours_Based_On__c,
                    tc9_et__Minimum_Monday_Paid_Hours__c, tc9_et__Minimum_OT_Round_Up_Shift_Paid_Hours__c,
                    tc9_et__Minimum_Public_Holiday_Paid_Hours__c, tc9_et__Minimum_Rest_Hours__c,
                    tc9_et__Minimum_Saturday_Paid_Hours__c, tc9_et__Minimum_Sunday_Paid_Hours__c,
                    tc9_et__Minimum_Thursday_Paid_Hours__c, tc9_et__Minimum_Tuesday_Paid_Hours__c,
                    tc9_et__Minimum_Wednesday_Paid_Hours__c, tc9_et__Minimum_Weekday_Paid_Hours__c,
                    tc9_et__Monday_Interpretation_Type__c, tc9_et__Monday_Standard_Hours__c,
                    tc9_et__Overnight_Based_on_Majority_of_Shift__c, tc9_et__Overnight_Based_on_Shift_Start_Range__c,
                    tc9_et__Overnight_Friday_Shift_Starting_from__c, tc9_et__Overnight_Monday_Shift_Starting_from__c,
                    tc9_et__Overnight_PH_Shift_Starting_from__c, tc9_et__Overnight_Saturday_Shift_Starting_from__c,
                    tc9_et__Overnight_Sunday_Shift_Starting_from__c, tc9_et__Overnight_Thursday_Shift_Starting_from__c,
                    tc9_et__Overnight_Tuesday_Shift_Starting_from__c, tc9_et__Overnight_Wednesday_Shift_Starting_from__c,
                    tc9_et__Overnight_Weekday_Shift_Starting_from__c, tc9_et__Pay_Code__c,
                    tc9_et__Pay_Code__r.{externalIdField}, tc9_et__Public_Holiday_Interpretation_Type__c,
                    tc9_et__Public_Holiday_Standard_Hours__c, tc9_et__Rate_Calculator_Update_Pending__c,
                    tc9_et__Reset_Frequency_Overtime_Daily__c, tc9_et__Saturday_Interpretation_Type__c,
                    tc9_et__Saturday_Standard_Hours__c, tc9_et__Short_Description__c,
                    tc9_et__Sleepover_Breakpoint_Application__c, tc9_et__Sleepover_Minimum_Rest_Hours__c,
                    tc9_et__Standard_Daily_End_Time__c, tc9_et__Standard_Daily_Start_Time__c,
                    tc9_et__Standard_Friday_End_Time__c, tc9_et__Standard_Friday_Start_Time__c,
                    tc9_et__Standard_Monday_End_Time__c, tc9_et__Standard_Monday_Start_Time__c,
                    tc9_et__Standard_Public_Holiday_End_Time__c, tc9_et__Standard_Public_Holiday_Start_Time__c,
                    tc9_et__Standard_Saturday_End_Time__c, tc9_et__Standard_Saturday_Start_Time__c,
                    tc9_et__Standard_Sunday_End_Time__c, tc9_et__Standard_Sunday_Start_Time__c,
                    tc9_et__Standard_Thursday_End_Time__c, tc9_et__Standard_Thursday_Start_Time__c,
                    tc9_et__Standard_Tuesday_End_Time__c, tc9_et__Standard_Tuesday_Start_Time__c,
                    tc9_et__Standard_Wednesday_End_Time__c, tc9_et__Standard_Wednesday_Start_Time__c,
                    tc9_et__Standard_Weekday_End_Time__c, tc9_et__Standard_Weekday_Start_Time__c,
                    tc9_et__Status__c, tc9_et__Sunday_Interpretation_Type__c, tc9_et__Sunday_Standard_Hours__c,
                    tc9_et__Thursday_Interpretation_Type__c, tc9_et__Thursday_Standard_Hours__c,
                    tc9_et__Timesheet_Frequency__c, tc9_et__Total_Span_Hours__c,
                    tc9_et__Tuesday_Interpretation_Type__c, tc9_et__Tuesday_Standard_Hours__c,
                    tc9_et__Wednesday_Interpretation_Type__c, tc9_et__Wednesday_Standard_Hours__c,
                    tc9_et__Weekday_Interpretation_Type__c, tc9_et__Weekday_Standard_Hours__c,
                    tc9_et__Apply_Casual_Loading_to_Overtime__c, tc9_et__Apply_Minimum_Rest_To_Same_Day_Entries__c,
                    tc9_et__Apply_Overtime_On_A_Shift_Basis__c, tc9_et__Apply_Penalty_Loading_to_Overtime__c,
                    tc9_et__Apply_Shift_Start_Time_BP__c, tc9_et__Calculate_Span_From_Previous_Shift__c,
                    tc9_et__Include_Time_BPs_in_OT_Daily_Std_Calcs__c, tc9_et__Sleepover_Minimum_Paid_Hours__c,
                    tc9_et__Split_Broken_Shift_Reset_Hours__c, tc9_et__Wake_Up_Minimum_Hours__c,
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
                    {
                        sourceField: "tc9_et__Status__c",
                        targetField: "tc9_et__Status__c",
                        isRequired: false,
                        transformationType: "direct",
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
                        sourceField: "tc9_et__Apply_4_Week_Frequency__c",
                        targetField: "tc9_et__Apply_4_Week_Frequency__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Break_Loading_Interpretation__c",
                        targetField: "tc9_et__Apply_Break_Loading_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Break_Time_Interpretation__c",
                        targetField: "tc9_et__Apply_Break_Time_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Casual_Loading__c",
                        targetField: "tc9_et__Apply_Casual_Loading__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Dual_Leave_Loading_Calculations__c",
                        targetField: "tc9_et__Apply_Dual_Leave_Loading_Calculations__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Excursion_Interpretation__c",
                        targetField: "tc9_et__Apply_Excursion_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Interpretation_Variations__c",
                        targetField: "tc9_et__Apply_Interpretation_Variations__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Minimum_Rest_Interpretation__c",
                        targetField: "tc9_et__Apply_Minimum_Rest_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Minimum_Rest_on_Overtime__c",
                        targetField: "tc9_et__Apply_Minimum_Rest_on_Overtime__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c",
                        targetField: "tc9_et__Apply_OT_Round_Up_Shift_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Overnight_Interpretation__c",
                        targetField: "tc9_et__Apply_Overnight_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Penalty_Loading__c",
                        targetField: "tc9_et__Apply_Penalty_Loading__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Sleepover_Interpretation__c",
                        targetField: "tc9_et__Apply_Sleepover_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Split_Broken_Shift_Interpretation__c",
                        targetField: "tc9_et__Apply_Split_Broken_Shift_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Wake_Up_Interpretation__c",
                        targetField: "tc9_et__Apply_Wake_Up_Interpretation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Assignment__c",
                        targetField: "tc9_et__Assignment__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Overnight_Based_on_Majority_of_Shift__c",
                        targetField: "tc9_et__Overnight_Based_on_Majority_of_Shift__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Overnight_Based_on_Shift_Start_Range__c",
                        targetField: "tc9_et__Overnight_Based_on_Shift_Start_Range__c",
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
                        sourceField: "tc9_et__Minimum_Hours_Based_On__c",
                        targetField: "tc9_et__Minimum_Hours_Based_On__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Days_Frequency_Breakpoints_Accrued__c",
                        targetField: "tc9_et__Days_Frequency_Breakpoints_Accrued__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Days_Frequency_Breakpoints_Apply__c",
                        targetField: "tc9_et__Days_Frequency_Breakpoints_Apply__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Days_Minimum_Rest_Hours_Apply2__c",
                        targetField: "tc9_et__Days_Minimum_Rest_Hours_Apply2__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Days_Overtime_Breakpoints_Reset__c",
                        targetField: "tc9_et__Days_Overtime_Breakpoints_Reset__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Include_Paid_Breaks_in_Break_Loading__c",
                        targetField: "tc9_et__Include_Paid_Breaks_in_Break_Loading__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Monday_Interpretation_Type__c",
                        targetField: "tc9_et__Monday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Tuesday_Interpretation_Type__c",
                        targetField: "tc9_et__Tuesday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Wednesday_Interpretation_Type__c",
                        targetField: "tc9_et__Wednesday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Thursday_Interpretation_Type__c",
                        targetField: "tc9_et__Thursday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Friday_Interpretation_Type__c",
                        targetField: "tc9_et__Friday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Saturday_Interpretation_Type__c",
                        targetField: "tc9_et__Saturday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Sunday_Interpretation_Type__c",
                        targetField: "tc9_et__Sunday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Public_Holiday_Interpretation_Type__c",
                        targetField: "tc9_et__Public_Holiday_Interpretation_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Weekday_Interpretation_Type__c",
                        targetField: "tc9_et__Weekday_Interpretation_Type__c",
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
                    {
                        sourceField: "tc9_et__Weekday_Standard_Hours__c",
                        targetField: "tc9_et__Weekday_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Frequency_Standard_Hours__c",
                        targetField: "tc9_et__Frequency_Standard_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Total_Span_Hours__c",
                        targetField: "tc9_et__Total_Span_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Rest_Hours__c",
                        targetField: "tc9_et__Minimum_Rest_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Weekday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Weekday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Monday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Monday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Tuesday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Tuesday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Wednesday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Wednesday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Thursday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Thursday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Friday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Friday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Saturday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Saturday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Sunday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Sunday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Public_Holiday_Paid_Hours__c",
                        targetField: "tc9_et__Minimum_Public_Holiday_Paid_Hours__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Break_Loading_Hours_Exceeded__c",
                        targetField: "tc9_et__Break_Loading_Hours_Exceeded__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Break_Loading_Unpaid_Break_Minutes__c",
                        targetField: "tc9_et__Break_Loading_Unpaid_Break_Minutes__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_et__Exclude_Overtime_from_Frequency_Hours__c",
                        targetField: "tc9_et__Exclude_Overtime_from_Frequency_Hours__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Include_Break_Overtime_In_Overtime__c",
                        targetField: "tc9_et__Include_Break_Overtime_In_Overtime__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Include_Time_Breakpoints_In_Overtime__c",
                        targetField: "tc9_et__Include_Time_Breakpoints_In_Overtime__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Reset_Frequency_Overtime_Daily__c",
                        targetField: "tc9_et__Reset_Frequency_Overtime_Daily__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Has_Saturday_Rule__c",
                        targetField: "tc9_et__Has_Saturday_Rule__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Has_Sunday_Rule__c",
                        targetField: "tc9_et__Has_Sunday_Rule__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Include_Time_BPs_in_OT_Daily_Std_Calcs__c",
                        targetField: "tc9_et__Include_Time_BPs_in_OT_Daily_Std_Calcs__c",
                        isRequired: false,
                        transformationType: "boolean",
                    },
                    {
                        sourceField: "tc9_et__Apply_Casual_Loading_to_Overtime__c",
                        targetField: "tc9_et__Apply_Casual_Loading_to_Overtime__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Apply_Penalty_Loading_to_Overtime__c",
                        targetField: "tc9_et__Apply_Penalty_Loading_to_Overtime__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Overnight_PH_Shift_Starting_from__c",
                        targetField: "tc9_et__Overnight_PH_Shift_Starting_from__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Overnight_Sunday_Shift_Starting_from__c",
                        targetField: "tc9_et__Overnight_Sunday_Shift_Starting_from__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Include_Minimum_Rest_in_Daily_OT_Hours__c",
                        targetField: "tc9_et__Include_Minimum_Rest_in_Daily_OT_Hours__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Monday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Monday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Tuesday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Tuesday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Wednesday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Wednesday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Thursday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Thursday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Friday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Friday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Saturday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Saturday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Sunday_Required__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Sunday_Required__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Is_Standard_Time_for_Public_Holidays_Req__c",
                        targetField: "tc9_et__Is_Standard_Time_for_Public_Holidays_Req__c",
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
                dependencyChecks: [],
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
                    {
                        sourceField: "tc9_et__Minimum_Qualifying_Threshold__c",
                        targetField: "tc9_et__Minimum_Qualifying_Threshold__c",
                        isRequired: false,
                        transformationType: "number" as const,
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
                        sourceField: "tc9_et__Interpretation_Variation_Rule__c",
                        targetField: "tc9_et__Interpretation_Variation_Rule__c",
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
                        lookupObject: "tc9_et__Interpretation_Breakpoint__c",
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
                    {
                        sourceField: "tc9_et__Public_Holiday_Overtime_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Public_Holiday_Overtime_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Public_Holiday_Penalty_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Public_Holiday_Penalty_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Saturday_Penalty_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Saturday_Penalty_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Sunday_Penalty_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Sunday_Penalty_Pay_Code__c",
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
                            soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Breakpoint_Type__c = 'Leave Header'",
                            cacheKey: "target_leave_headers",
                            description: "Cache all target org leave headers for validation",
                        },
                        {
                            queryName: "targetLeaveRules",
                            soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_pr__Leave_Rule__c",
                            cacheKey: "target_leave_rules",
                            description: "Cache all target org leave rules for validation",
                        },
                        {
                            queryName: "targetInterpretationBreakpoints",
                            soqlQuery: "SELECT Id, {externalIdField}, Name, RecordType.Name FROM tc9_et__Interpretation_Breakpoint__c",
                            cacheKey: "target_interpretation_breakpoints",
                            description: "Cache all target org interpretation breakpoints for validation",
                        },
                    ],
                    dependencyChecks: [
                        {
                            checkName: "payCodeExists",
                            description: "Verify referenced pay codes exist in target org",
                            sourceField: "tc9_et__Pay_Code__r.{externalIdField}",
                            targetObject: "tc9_pr__Pay_Code__c",
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Migration cannot proceed: Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org. All referenced pay codes must be migrated first",
                        },
                        {
                            checkName: "leaveHeaderExists",
                            description: "Verify referenced leave headers exist in target org",
                            sourceField: "tc9_et__Leave_Header__r.{externalIdField}",
                            targetObject: "tc9_et__Interpretation_Breakpoint__c",
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Migration cannot proceed: Leave Header '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org. All referenced leave headers must be migrated first",
                        },
                        {
                            checkName: "leaveRuleExists",
                            description: "Verify referenced leave rules exist in target org",
                            sourceField: "tc9_et__Leave_Rule__r.{externalIdField}",
                            targetObject: "tc9_pr__Leave_Rule__c",
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Migration cannot proceed: Leave Rule '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org. All referenced leave rules must be migrated first",
                        },
                        {
                            checkName: "overtimePayCodeExists",
                            description: "Verify referenced overtime pay codes exist in target org",
                            sourceField: "tc9_et__Overtime_Pay_Code__r.{externalIdField}",
                            targetObject: "tc9_pr__Pay_Code__c",
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Migration cannot proceed: Overtime Pay Code '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org. All referenced pay codes must be migrated first",
                        },
                        {
                            checkName: "dailyPayCodeCapRecordExists",
                            description: "Verify referenced daily pay code cap records exist in target org",
                            sourceField: "tc9_et__Daily_Pay_Code_Cap_Record__r.{externalIdField}",
                            targetObject: "tc9_et__Interpretation_Breakpoint__c",
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Migration cannot proceed: Daily Pay Code Cap Record '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org. Referenced breakpoints must be migrated first",
                        },
                        {
                            checkName: "frequencyPayCodeCapRecordExists",
                            description: "Verify referenced frequency pay code cap records exist in target org",
                            sourceField: "tc9_et__Frequency_Pay_Code_Cap_Record__r.{externalIdField}",
                            targetObject: "tc9_et__Interpretation_Breakpoint__c",
                            targetField: "{externalIdField}",
                            isRequired: true,
                            errorMessage: "Migration cannot proceed: Frequency Pay Code Cap Record '{sourceValue}' referenced by breakpoint '{recordName}' does not exist in target org. Referenced breakpoints must be migrated first",
                        },
                    ],
                    dataIntegrityChecks: [
                        {
                            checkName: "sourceLeaveRuleExternalIdValidation",
                            description: "Validate that all source leave rules referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Leave_Rule__c 
                                WHERE Id IN (
                                    SELECT tc9_et__Leave_Rule__c 
                                    FROM tc9_et__Interpretation_Breakpoint__c 
                                    WHERE tc9_et__Leave_Rule__c != null
                                )
                                AND ({externalIdField} = null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found leave rules referenced by interpretation breakpoints that are missing external ID values. All referenced leave rules must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourcePayCodeExternalIdValidation",
                            description: "Validate that all source pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourceCasualLoadingPayCodeExternalIdValidation",
                            description: "Validate that all source casual loading pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Casual_Loading_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Casual_Loading_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found casual loading pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourceLeaveLoadingPayCodeExternalIdValidation",
                            description: "Validate that all source leave loading pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Leave_Loading_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Leave_Loading_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found leave loading pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourceOvertimePayCodeExternalIdValidation",
                            description: "Validate that all source overtime pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Overtime_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Overtime_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found overtime pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourcePenaltyLoadingPayCodeExternalIdValidation",
                            description: "Validate that all source penalty loading pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Penalty_Loading_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Penalty_Loading_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found penalty loading pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourcePublicHolidayPayCodeExternalIdValidation",
                            description: "Validate that all source public holiday pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Public_Holiday_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Public_Holiday_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found public holiday pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourceSaturdayPayCodeExternalIdValidation",
                            description: "Validate that all source Saturday pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Saturday_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Saturday_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found Saturday pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                            severity: "error" as const,
                        },
                        {
                            checkName: "sourceSundayPayCodeExternalIdValidation",
                            description: "Validate that all source Sunday pay codes referenced by interpretation breakpoints have external ID values",
                            validationQuery: `SELECT Id, Name FROM tc9_pr__Pay_Code__c 
                                WHERE {externalIdField} = null
                                AND Id IN (SELECT tc9_et__Sunday_Pay_Code__c FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Sunday_Pay_Code__c != null)`,
                            expectedResult: "empty" as const,
                            errorMessage: "Migration cannot proceed: Found Sunday pay codes referenced by interpretation breakpoints that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
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
                            tc9_et__Sunday_Pay_Code__r.{externalIdField}, tc9_et__Variation_Type__c, 
                            tc9_et__Interpretation_Variation_Rule__c, tc9_et__Minimum_Qualifying_Threshold__c,
                            tc9_et__Public_Holiday_Overtime_Pay_Code__r.{externalIdField}, tc9_et__Public_Holiday_Penalty_Pay_Code__r.{externalIdField},
                            tc9_et__Saturday_Penalty_Pay_Code__r.{externalIdField}, tc9_et__Sunday_Penalty_Pay_Code__r.{externalIdField},
                            {externalIdField}
                            FROM tc9_et__Interpretation_Breakpoint__c 
                            WHERE RecordType.Name = 'Leave Breakpoint' 
                            AND tc9_et__Breakpoint_Type__c = 'Leave Header'
`,
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
                            tc9_et__Sunday_Pay_Code__r.{externalIdField}, tc9_et__Variation_Type__c, 
                            tc9_et__Interpretation_Variation_Rule__c, tc9_et__Minimum_Qualifying_Threshold__c,
                            tc9_et__Public_Holiday_Overtime_Pay_Code__r.{externalIdField}, tc9_et__Public_Holiday_Penalty_Pay_Code__r.{externalIdField},
                            tc9_et__Saturday_Penalty_Pay_Code__r.{externalIdField}, tc9_et__Sunday_Penalty_Pay_Code__r.{externalIdField},
                            {externalIdField}
                            FROM tc9_et__Interpretation_Breakpoint__c 
                            WHERE (RecordType.Name = 'Pay Code Cap' OR RecordType.Name = 'Leave Breakpoint') 
                            AND tc9_et__Breakpoint_Type__c != 'Leave Header'
`,
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
                            tc9_et__Sunday_Pay_Code__r.{externalIdField}, tc9_et__Variation_Type__c, 
                            tc9_et__Interpretation_Variation_Rule__c, tc9_et__Minimum_Qualifying_Threshold__c,
                            tc9_et__Public_Holiday_Overtime_Pay_Code__r.{externalIdField}, tc9_et__Public_Holiday_Penalty_Pay_Code__r.{externalIdField},
                            tc9_et__Saturday_Penalty_Pay_Code__r.{externalIdField}, tc9_et__Sunday_Penalty_Pay_Code__r.{externalIdField},
                            {externalIdField}
                            FROM tc9_et__Interpretation_Breakpoint__c 
                            WHERE RecordType.Name != 'Pay Code Cap' AND RecordType.Name != 'Leave Breakpoint'
`,
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
                                validationQuery: "SELECT Id, Name FROM tc9_et__Interpretation_Breakpoint__c WHERE tc9_et__Pay_Code__c != null AND tc9_et__Pay_Code__r.{externalIdField} = null",
                                expectedResult: "empty" as const,
                                errorMessage: "Migration cannot proceed: Found breakpoints with pay codes that have null external IDs. All referenced pay codes must have external IDs for cross-environment migration",
                                severity: "error" as const,
                            },
                            {
                                checkName: "recordTypeMappingCoverage",
                                description: "Identify source record types that are not mapped in the template",
                                validationQuery: `SELECT RecordType.Name, COUNT(Id) recordCount FROM tc9_et__Interpretation_Breakpoint__c 
                                    WHERE RecordType.Name != 'Pay Code Cap' 
                                    AND RecordType.Name != 'Leave Breakpoint' 
                                    AND RecordType.Name NOT IN (
                                        'Allowance Breakpoint', 'Break Loading Overtime', 'Daily Hours Breakpoint', 
                                        'Daily Rate', 'Frequency Hours Breakpoint', 'Interpretation Breakpoint Junction',
                                        'Minimum Rest', 'Overtime Round Up Shift', 'Shift End Time Breakpoint',
                                        'Shift Start Time Breakpoint', 'Sleepover', 'Split/Broken Shift',
                                        'Time Breakpoint', 'Standard Breakpoint', 'Overtime Breakpoint'
                                    ) GROUP BY RecordType.Name`,
                                expectedResult: "empty" as const,
                                errorMessage: "Migration cannot proceed: Found source record types that are not mapped in the template. Please update the recordTypeMapping to include all source record types",
                                severity: "warning" as const,
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