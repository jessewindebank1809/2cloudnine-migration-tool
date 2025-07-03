import { MigrationTemplate, FieldMapping, LookupMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const minimumPayRateTemplate: MigrationTemplate = {
    id: "payroll-minimum-pay-rate",
    name: "Minimum Pay Rate",
    description: "Migrate minimum pay rate records with complete 1:1 field mapping and lookup relationships",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "minimumPayRateMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, OwnerId,
                    tc9_et__Annual_Rate_Change__c, tc9_et__Rate_Entered__c, tc9_et__Status__c,
                    tc9_et__Allowance_Pay_Code__c, tc9_et__Allowance_Pay_Code__r.{externalIdField},
                    tc9_et__Assignment_Rate_Template_Group__c, tc9_et__Assignment_Rate_Template_Group__r.{externalIdField},
                    tc9_et__Award_Classification__c, tc9_et__Award_Classification__r.{externalIdField},
                    tc9_et__Award_Level__c, tc9_et__Award_Level__r.{externalIdField},
                    tc9_et__Calculation_Method__c, tc9_et__Calculation_Method__r.{externalIdField},
                    tc9_et__Casual_Loading_Record__c, tc9_et__Casual_Loading_Record__r.{externalIdField},
                    tc9_et__Create_Related_Margin_Mark_Up_Records__c,
                    tc9_et__Custom_Pay_Rate_1__c, tc9_et__Custom_Pay_Rate_2__c,
                    tc9_et__Effective_Date__c, tc9_et__Expiry_Date__c,
                    tc9_et__Has_Pending_Assignment_to_be_processed__c,
                    tc9_et__Interpretation_Rule__c, tc9_et__Interpretation_Rule__r.{externalIdField},
                    tc9_et__Margin_Rate__c, tc9_et__Mark_Up_Rate__c, tc9_et__Pay_Rate__c,
                    tc9_et__Primary_Minimum_Pay_Rate__c, tc9_et__Primary_Minimum_Pay_Rate__r.{externalIdField},
                    tc9_et__Project_Code__c, tc9_et__Project_Code__r.{externalIdField},
                    tc9_et__Rate_Calculator_Template__c, tc9_et__Rate_Calculator_Template__r.{externalIdField},
                    tc9_et__Timesheet_Activity__c, tc9_et__Timesheet_Activity__r.{externalIdField},
                    tc9_et__Primary_MPR_Pay_Rate__c, {externalIdField}
                    FROM tc9_et__Minimum_Pay_Rate__c`,
                objectApiName: "tc9_et__Minimum_Pay_Rate__c",
                batchSize: 200,
            },
            transformConfig: {
                fieldMappings: [
                    // External ID mapping
                    {
                        sourceField: "Id",
                        targetField: "{externalIdField}",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    // Standard fields
                    {
                        sourceField: "Name",
                        targetField: "Name",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "OwnerId",
                        targetField: "OwnerId",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Picklist fields
                    {
                        sourceField: "tc9_et__Annual_Rate_Change__c",
                        targetField: "tc9_et__Annual_Rate_Change__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Rate_Entered__c",
                        targetField: "tc9_et__Rate_Entered__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Status__c",
                        targetField: "tc9_et__Status__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Boolean fields
                    {
                        sourceField: "tc9_et__Create_Related_Margin_Mark_Up_Records__c",
                        targetField: "tc9_et__Create_Related_Margin_Mark_Up_Records__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Has_Pending_Assignment_to_be_processed__c",
                        targetField: "tc9_et__Has_Pending_Assignment_to_be_processed__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Number fields
                    {
                        sourceField: "tc9_et__Custom_Pay_Rate_1__c",
                        targetField: "tc9_et__Custom_Pay_Rate_1__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Custom_Pay_Rate_2__c",
                        targetField: "tc9_et__Custom_Pay_Rate_2__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Margin_Rate__c",
                        targetField: "tc9_et__Margin_Rate__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Mark_Up_Rate__c",
                        targetField: "tc9_et__Mark_Up_Rate__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Pay_Rate__c",
                        targetField: "tc9_et__Pay_Rate__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Primary_MPR_Pay_Rate__c",
                        targetField: "tc9_et__Primary_MPR_Pay_Rate__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Date fields
                    {
                        sourceField: "tc9_et__Effective_Date__c",
                        targetField: "tc9_et__Effective_Date__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Expiry_Date__c",
                        targetField: "tc9_et__Expiry_Date__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                ] as FieldMapping[],
                lookupMappings: [
                    {
                        sourceField: "tc9_et__Allowance_Pay_Code__r.{externalIdField}",
                        targetField: "tc9_et__Allowance_Pay_Code__c",
                        lookupObject: "tc9_pr__Pay_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Assignment_Rate_Template_Group__r.{externalIdField}",
                        targetField: "tc9_et__Assignment_Rate_Template_Group__c",
                        lookupObject: "tc9_pr__Template_Group__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Award_Classification__r.{externalIdField}",
                        targetField: "tc9_et__Award_Classification__c",
                        lookupObject: "tc9_et__Award_Classifications_and_Levels__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Award_Level__r.{externalIdField}",
                        targetField: "tc9_et__Award_Level__c",
                        lookupObject: "tc9_et__Award_Classifications_and_Levels__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Calculation_Method__r.{externalIdField}",
                        targetField: "tc9_et__Calculation_Method__c",
                        lookupObject: "tc9_et__Calculation_Method__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Casual_Loading_Record__r.{externalIdField}",
                        targetField: "tc9_et__Casual_Loading_Record__c",
                        lookupObject: "tc9_et__PayRate_Loading__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Interpretation_Rule__r.{externalIdField}",
                        targetField: "tc9_et__Interpretation_Rule__c",
                        lookupObject: "tc9_et__Interpretation_Rule__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Primary_Minimum_Pay_Rate__r.{externalIdField}",
                        targetField: "tc9_et__Primary_Minimum_Pay_Rate__c",
                        lookupObject: "tc9_et__Minimum_Pay_Rate__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Project_Code__r.{externalIdField}",
                        targetField: "tc9_et__Project_Code__c",
                        lookupObject: "tc9_pr__Project_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Rate_Calculator_Template__r.{externalIdField}",
                        targetField: "tc9_et__Rate_Calculator_Template__c",
                        lookupObject: "tc9_pr__Template_Group__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                    {
                        sourceField: "tc9_et__Timesheet_Activity__r.{externalIdField}",
                        targetField: "tc9_et__Timesheet_Activity__c",
                        lookupObject: "tc9_pr__Project_Code__c",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "{externalIdField}",
                        cacheResults: true,
                    },
                ] as LookupMapping[],
                externalIdHandling: {
                    sourceField: "Id",
                    targetField: "{externalIdField}",
                    managedField: "tc9_edc__External_ID_Data_Creation__c",
                    unmanagedField: "External_ID_Data_Creation__c",
                    fallbackField: "External_Id__c",
                    strategy: "auto-detect"
                }
            },
            loadConfig: {
                targetObject: "tc9_et__Minimum_Pay_Rate__c",
                operation: "upsert",
                externalIdField: "{externalIdField}",
                useBulkApi: true,
                batchSize: 200,
                allowPartialSuccess: false,
                retryConfig: {
                    maxRetries: 3,
                    retryWaitSeconds: 5,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "REQUEST_LIMIT_EXCEEDED", "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY"]
                }
            },
            validationConfig: {
                preValidationQueries: [
                    {
                        queryName: "targetPayCodes",
                        soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_pr__Pay_Code__c",
                        cacheKey: "target_pay_codes",
                        description: "Cache all target org pay codes for validation",
                    },
                    {
                        queryName: "targetAwardClassifications",
                        soqlQuery: "SELECT Id, {externalIdField}, Name FROM tc9_et__Award_Classifications_and_Levels__c",
                        cacheKey: "target_award_classifications",
                        description: "Cache all target org award classifications for validation",
                    },
                ],
                dependencyChecks: [
                    {
                        checkName: "payCodeExists",
                        description: "Verify referenced pay code exists in target org",
                        sourceField: "tc9_et__Allowance_Pay_Code__r.{externalIdField}",
                        targetObject: "tc9_pr__Pay_Code__c",
                        targetField: "{externalIdField}",
                        isRequired: false,
                        errorMessage: "Pay Code '{sourceValue}' referenced by minimum pay rate '{recordName}' does not exist in target org",
                    },
                    {
                        checkName: "awardClassificationExists",
                        description: "Verify referenced award classification exists in target org",
                        sourceField: "tc9_et__Award_Classification__r.{externalIdField}",
                        targetObject: "tc9_et__Award_Classifications_and_Levels__c",
                        targetField: "{externalIdField}",
                        isRequired: false,
                        errorMessage: "Award Classification '{sourceValue}' referenced by minimum pay rate '{recordName}' does not exist in target org",
                    },
                    {
                        checkName: "awardLevelExists",
                        description: "Verify referenced award level exists in target org",
                        sourceField: "tc9_et__Award_Level__r.{externalIdField}",
                        targetObject: "tc9_et__Award_Classifications_and_Levels__c",
                        targetField: "{externalIdField}",
                        isRequired: false,
                        errorMessage: "Award Level '{sourceValue}' referenced by minimum pay rate '{recordName}' does not exist in target org",
                    },
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "name-required",
                        description: "Ensure Minimum Pay Rate Name is provided",
                        validationQuery: "SELECT Id FROM tc9_et__Minimum_Pay_Rate__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Minimum Pay Rate Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_et__Minimum_Pay_Rate__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Minimum Pay Rate records missing external ID",
                        severity: "warning"
                    },
                    {
                        checkName: "date-range-validation",
                        description: "Validate Effective Date is before Expiry Date when both are provided",
                        validationQuery: `SELECT Id, Name, tc9_et__Effective_Date__c, tc9_et__Expiry_Date__c 
                            FROM tc9_et__Minimum_Pay_Rate__c 
                            WHERE tc9_et__Effective_Date__c != null 
                            AND tc9_et__Expiry_Date__c != null 
                            AND tc9_et__Effective_Date__c > tc9_et__Expiry_Date__c`,
                        expectedResult: "empty",
                        errorMessage: "Found minimum pay rates where Effective Date is after Expiry Date",
                        severity: "error"
                    }
                ],
                picklistValidationChecks: [
                    {
                        checkName: "annual-rate-change-picklist",
                        description: "Validate Annual Rate Change picklist values",
                        fieldName: "tc9_et__Annual_Rate_Change__c",
                        objectName: "tc9_et__Minimum_Pay_Rate__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Annual Rate Change value",
                        severity: "warning"
                    },
                    {
                        checkName: "rate-entered-picklist",
                        description: "Validate Rate Entered picklist values",
                        fieldName: "tc9_et__Rate_Entered__c",
                        objectName: "tc9_et__Minimum_Pay_Rate__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Rate Entered value",
                        severity: "warning"
                    },
                    {
                        checkName: "status-picklist",
                        description: "Validate Status picklist values",
                        fieldName: "tc9_et__Status__c",
                        objectName: "tc9_et__Minimum_Pay_Rate__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Status value",
                        severity: "warning"
                    }
                ],
            },
            dependencies: ["awardClassificationsAndLevelsMaster"]
        }
    ],
    executionOrder: ["minimumPayRateMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-01-03"),
        updatedAt: new Date("2025-01-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: [
            "tc9_et__Minimum_Pay_Rate__c.Create", 
            "tc9_et__Minimum_Pay_Rate__c.Edit", 
            "tc9_et__Minimum_Pay_Rate__c.Read",
            "tc9_pr__Pay_Code__c.Read",
            "tc9_et__Award_Classifications_and_Levels__c.Read"
        ],
        estimatedDuration: 20,
        complexity: "complex"
    }
};

// Export hooks separately to maintain consistency with other templates
export const minimumPayRateTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_et__Minimum_Pay_Rate__c"
        );
        
        // Replace placeholders in all configurations
        context.template.etlSteps.forEach((step: any) => {
            // Update SOQL query
            if (step.extractConfig?.soqlQuery) {
                step.extractConfig.soqlQuery = step.extractConfig.soqlQuery.replace(
                    /{externalIdField}/g,
                    externalIdField
                );
            }
            
            // Update field mappings
            if (step.transformConfig?.fieldMappings) {
                step.transformConfig.fieldMappings.forEach((mapping: any) => {
                    if (mapping.targetField === "{externalIdField}") {
                        mapping.targetField = externalIdField;
                    }
                });
            }
            
            // Update lookup mappings
            if (step.transformConfig?.lookupMappings) {
                step.transformConfig.lookupMappings.forEach((mapping: any) => {
                    mapping.sourceField = mapping.sourceField.replace(/{externalIdField}/g, externalIdField);
                    mapping.lookupKeyField = mapping.lookupKeyField.replace(/{externalIdField}/g, externalIdField);
                    mapping.lookupValueField = mapping.lookupValueField.replace(/{externalIdField}/g, externalIdField);
                });
            }
            
            // Update load config
            if (step.loadConfig?.externalIdField === "{externalIdField}") {
                step.loadConfig.externalIdField = externalIdField;
            }
            
            // Update validation queries and dependency checks
            if (step.validationConfig) {
                // Pre-validation queries
                if (step.validationConfig.preValidationQueries) {
                    step.validationConfig.preValidationQueries.forEach((query: any) => {
                        query.soqlQuery = query.soqlQuery.replace(/{externalIdField}/g, externalIdField);
                    });
                }
                
                // Data integrity checks
                if (step.validationConfig.dataIntegrityChecks) {
                    step.validationConfig.dataIntegrityChecks.forEach((check: any) => {
                        if (check.validationQuery) {
                            check.validationQuery = check.validationQuery.replace(/{externalIdField}/g, externalIdField);
                        }
                    });
                }
                
                // Dependency checks
                if (step.validationConfig.dependencyChecks) {
                    step.validationConfig.dependencyChecks.forEach((check: any) => {
                        check.sourceField = check.sourceField.replace(/{externalIdField}/g, externalIdField);
                        check.targetField = check.targetField.replace(/{externalIdField}/g, externalIdField);
                    });
                }
            }
        });
        
        console.log(`Using external ID field: ${externalIdField}`);
        return { success: true };
    },
    postExtract: async (data: any, context: any) => {
        console.log(`Extracted ${data.length} minimum pay rate records`);
        return data;
    },
    preLoad: async (data: any, context: any) => {
        console.log(`Preparing to load ${data.length} minimum pay rate records`);
        return data;
    },
    postMigration: async (results: any, context: any) => {
        console.log("Minimum pay rate migration completed");
        return { success: true };
    }
};