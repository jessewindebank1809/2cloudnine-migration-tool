import { MigrationTemplate, FieldMapping, LookupMapping, LoadConfig, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const leaveRulesTemplate: MigrationTemplate = {
    id: "payroll-leave-rules",
    name: "Leave Rules",
    description: "Migrate leave rules with essential validations",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "leaveRuleMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, tc9_pr__Effective_Date__c, tc9_pr__Status__c,
                    tc9_pr__Pay_Code__c, tc9_pr__Pay_Code__r.{externalIdField},
                    tc9_pr__Unpaid_Pay_Code__c, tc9_pr__Unpaid_Pay_Code__r.{externalIdField},
                    tc9_pr__Available_Pay_Rates__c, tc9_pr__Allow_Pay_in_Advance__c,
                    tc9_pr__Skip_Manager_Approval__c, {externalIdField}
                    FROM tc9_pr__Leave_Rule__c`,
                objectApiName: "tc9_pr__Leave_Rule__c",
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
                        sourceField: "tc9_pr__Effective_Date__c",
                        targetField: "tc9_pr__Effective_Date__c",
                        isRequired: true,
                        transformationType: "date",
                    },
                    {
                        sourceField: "tc9_pr__Status__c",
                        targetField: "tc9_pr__Status__c",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Available_Pay_Rates__c",
                        targetField: "tc9_pr__Available_Pay_Rates__c",
                        isRequired: false,
                        transformationType: "number",
                    },
                    {
                        sourceField: "tc9_pr__Allow_Pay_in_Advance__c",
                        targetField: "tc9_pr__Allow_Pay_in_Advance__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Skip_Manager_Approval__c",
                        targetField: "tc9_pr__Skip_Manager_Approval__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                ],
                lookupMappings: [
                    {
                        sourceField: "tc9_pr__Pay_Code__r.{externalIdField}",
                        targetField: "tc9_pr__Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_pr__Unpaid_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_pr__Unpaid_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                ],
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
            },
            loadConfig: {
                targetObject: "tc9_pr__Leave_Rule__c",
                loadType: "UPSERT",
                externalIdField: "{externalIdField}",
                batchSize: 200,
                concurrencyLimit: 1,
                retryConfig: {
                    maxRetries: 3,
                    retryDelayMs: 1000,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY"],
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
                        description: "Verify referenced pay code exists in target org",
                        sourceField: "tc9_pr__Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_pr__Pay_Code__c",
                        targetField: "{externalIdField}",
                        isRequired: false, // Pay Code is optional
                        errorMessage: "Migration cannot proceed: Pay Code '{sourceValue}' referenced by leave rule '{recordName}' does not exist in target org. All referenced pay codes must be migrated first",
                    },
                    {
                        checkName: "unpaidPayCodeExists",
                        description: "Verify referenced unpaid pay code exists in target org",
                        sourceField: "tc9_pr__Unpaid_Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_pr__Pay_Code__c",
                        targetField: "{externalIdField}",
                        isRequired: false, // Unpaid Pay Code is optional
                        errorMessage: "Migration cannot proceed: Unpaid Pay Code '{sourceValue}' referenced by leave rule '{recordName}' does not exist in target org. All referenced pay codes must be migrated first",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "requiredFieldsValidation",
                        description: "Validate that required fields are populated",
                        validationQuery: `SELECT Id, Name, tc9_pr__Effective_Date__c, tc9_pr__Status__c
                            FROM tc9_pr__Leave_Rule__c 
                            WHERE Name = null 
                            OR tc9_pr__Effective_Date__c = null 
                            OR tc9_pr__Status__c = null`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Found leave rules with missing required fields (Name, Effective Date, or Status)",
                        severity: "error",
                    },
                    {
                        checkName: "sourcePayCodeExternalIdValidation",
                        description: "Validate that all source pay codes referenced by leave rules have external ID values",
                        validationQuery: `SELECT COUNT() FROM tc9_pr__Pay_Code__c 
                            WHERE Id IN (
                                SELECT tc9_pr__Pay_Code__c 
                                FROM tc9_pr__Leave_Rule__c 
                                WHERE tc9_pr__Pay_Code__c != null
                                UNION
                                SELECT tc9_pr__Unpaid_Pay_Code__c 
                                FROM tc9_pr__Leave_Rule__c 
                                WHERE tc9_pr__Unpaid_Pay_Code__c != null
                            )
                            AND {externalIdField} = null`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Found pay codes referenced by leave rules that are missing external ID values. All referenced pay codes must have external IDs for cross-environment migration",
                        severity: "error",
                    },
                    {
                        checkName: "effectiveDateValidation",
                        description: "Validate that Effective Date is not in the past (warning only)",
                        validationQuery: `SELECT Id, Name, tc9_pr__Effective_Date__c
                            FROM tc9_pr__Leave_Rule__c 
                            WHERE tc9_pr__Effective_Date__c < TODAY`,
                        expectedResult: "empty",
                        errorMessage: "Warning: Found leave rules with Effective Date in the past. Consider updating these dates",
                        severity: "warning",
                    },
                ],
                picklistValidations: [
                    {
                        fieldName: "tc9_pr__Status__c",
                        allowedValues: ["Active", "Inactive"],
                        isRestricted: true,
                        errorMessage: "Invalid Status value. Allowed values are: Active, Inactive",
                    },
                ],
                postLoadValidationQueries: [
                    {
                        queryName: "verifyLeaveRulesMigrated",
                        soqlQuery: `SELECT COUNT() FROM tc9_pr__Leave_Rule__c WHERE {externalIdField} IN ({sourceRecordIds})`,
                        expectedCount: "{expectedRecordCount}",
                        description: "Verify all leave rules were successfully migrated",
                    },
                    {
                        queryName: "verifyPayCodeReferences",
                        soqlQuery: `SELECT Id, Name, tc9_pr__Pay_Code__c, tc9_pr__Unpaid_Pay_Code__c
                            FROM tc9_pr__Leave_Rule__c 
                            WHERE {externalIdField} IN ({sourceRecordIds})
                            AND (tc9_pr__Pay_Code__c = null OR tc9_pr__Unpaid_Pay_Code__c = null)`,
                        expectedResult: "matches_source",
                        description: "Verify pay code references were correctly established",
                    },
                ],
            },
        },
    ],
    supportedOrgs: ["sandbox", "production"],
    requiredPermissions: [
        "tc9_pr__Leave_Rule__c.Read",
        "tc9_pr__Leave_Rule__c.Create",
        "tc9_pr__Leave_Rule__c.Edit",
        "tc9_pr__Pay_Code__c.Read",
    ],
    estimatedDuration: "5-10 minutes for 100 records",
    rollbackSupported: false,
    tags: ["payroll", "leave-rules", "hr-data"],
};