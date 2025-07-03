import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const calendarTemplate: MigrationTemplate = {
    id: "payroll-calendar",
    name: "Calendar",
    description: "Migrate calendar records with complete 1:1 field mapping and no transformation",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "calendarMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, OwnerId, RecordTypeId, CreatedDate, CreatedById, 
                    LastModifiedDate, LastModifiedById, SystemModstamp, LastActivityDate, 
                    LastViewedDate, LastReferencedDate,
                    tc9_pr__Description__c, tc9_pr__Type__c, tc9_pr__Is_Public_Holiday__c,
                    tc9_pr__Allow_Changes_To_Pay_Code__c, tc9_pr__Is_Payroll__c, 
                    tc9_pr__Country__c, tc9_pr__State_Province__c, tc9_pr__City__c,
                    tc9_pr__Display_Image_URL__c, tc9_pr__Number_of_Calendar_Periods__c,
                    tc9_pr__External_Id__c, tc9_pr__Public_Holiday_Date__c, 
                    tc9_pr__Display_Text__c, tc9_pr__Start_Date__c, tc9_pr__End_Date__c,
                    tc9_pr__Payroll_Multiplier__c, tc9_pr__Deduct_from_Accrual__c,
                    tc9_pr__Display_Text_2__c, tc9_pr__Display_Image_URL_2__c,
                    tc9_pr__Display_Text_3__c, tc9_pr__Display_Image_URL_3__c,
                    tc9_pr__Display_Text_4__c, tc9_pr__Display_Image_URL_4__c,
                    tc9_pr__Display_Text_5__c, tc9_pr__Display_Image_URL_5__c,
                    tc9_pr__Display_Text_6__c, tc9_pr__Display_Image_URL_6__c,
                    tc9_pr__Display_Text_7__c, tc9_pr__Display_Image_URL_7__c,
                    tc9_pr__Display_Text_8__c, tc9_pr__Display_Image_URL_8__c,
                    tc9_pr__Display_Text_9__c, tc9_pr__Display_Image_URL_9__c,
                    tc9_pr__Display_Text_10__c, tc9_pr__Display_Image_URL_10__c,
                    {externalIdField}
                    FROM tc9_pr__Calendar__c`,
                objectApiName: "tc9_pr__Calendar__c",
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
                    {
                        sourceField: "RecordTypeId",
                        targetField: "RecordTypeId",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Custom fields - Direct 1:1 mapping
                    {
                        sourceField: "tc9_pr__Description__c",
                        targetField: "tc9_pr__Description__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Type__c",
                        targetField: "tc9_pr__Type__c",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Is_Public_Holiday__c",
                        targetField: "tc9_pr__Is_Public_Holiday__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Allow_Changes_To_Pay_Code__c",
                        targetField: "tc9_pr__Allow_Changes_To_Pay_Code__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Is_Payroll__c",
                        targetField: "tc9_pr__Is_Payroll__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Country__c",
                        targetField: "tc9_pr__Country__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__State_Province__c",
                        targetField: "tc9_pr__State_Province__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__City__c",
                        targetField: "tc9_pr__City__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL__c",
                        targetField: "tc9_pr__Display_Image_URL__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Number_of_Calendar_Periods__c",
                        targetField: "tc9_pr__Number_of_Calendar_Periods__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__External_Id__c",
                        targetField: "tc9_pr__External_Id__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Public_Holiday_Date__c",
                        targetField: "tc9_pr__Public_Holiday_Date__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text__c",
                        targetField: "tc9_pr__Display_Text__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Start_Date__c",
                        targetField: "tc9_pr__Start_Date__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__End_Date__c",
                        targetField: "tc9_pr__End_Date__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Payroll_Multiplier__c",
                        targetField: "tc9_pr__Payroll_Multiplier__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Deduct_from_Accrual__c",
                        targetField: "tc9_pr__Deduct_from_Accrual__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Display Text fields 2-10
                    {
                        sourceField: "tc9_pr__Display_Text_2__c",
                        targetField: "tc9_pr__Display_Text_2__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_2__c",
                        targetField: "tc9_pr__Display_Image_URL_2__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_3__c",
                        targetField: "tc9_pr__Display_Text_3__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_3__c",
                        targetField: "tc9_pr__Display_Image_URL_3__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_4__c",
                        targetField: "tc9_pr__Display_Text_4__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_4__c",
                        targetField: "tc9_pr__Display_Image_URL_4__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_5__c",
                        targetField: "tc9_pr__Display_Text_5__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_5__c",
                        targetField: "tc9_pr__Display_Image_URL_5__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_6__c",
                        targetField: "tc9_pr__Display_Text_6__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_6__c",
                        targetField: "tc9_pr__Display_Image_URL_6__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_7__c",
                        targetField: "tc9_pr__Display_Text_7__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_7__c",
                        targetField: "tc9_pr__Display_Image_URL_7__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_8__c",
                        targetField: "tc9_pr__Display_Text_8__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_8__c",
                        targetField: "tc9_pr__Display_Image_URL_8__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_9__c",
                        targetField: "tc9_pr__Display_Text_9__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_9__c",
                        targetField: "tc9_pr__Display_Image_URL_9__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Text_10__c",
                        targetField: "tc9_pr__Display_Text_10__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Display_Image_URL_10__c",
                        targetField: "tc9_pr__Display_Image_URL_10__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                ] as FieldMapping[],
                lookupMappings: [],
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
                targetObject: "tc9_pr__Calendar__c",
                operation: "upsert",
                externalIdField: "{externalIdField}",
                useBulkApi: true,
                batchSize: 200,
                allowPartialSuccess: false,
                retryConfig: {
                    maxRetries: 3,
                    retryWaitSeconds: 5,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "REQUEST_LIMIT_EXCEEDED"]
                }
            },
            validationConfig: {
                dependencyChecks: [],
                dataIntegrityChecks: [
                    {
                        checkName: "name-required",
                        description: "Ensure Calendar Name is provided",
                        validationQuery: "SELECT Id FROM tc9_pr__Calendar__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Calendar Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "type-required",
                        description: "Ensure Calendar Type is provided",
                        validationQuery: "SELECT Id FROM tc9_pr__Calendar__c WHERE tc9_pr__Type__c = null",
                        expectedResult: "empty",
                        errorMessage: "Calendar Type is required",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_pr__Calendar__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Calendar records missing external ID",
                        severity: "warning"
                    },
                    {
                        checkName: "date-range-validation",
                        description: "Validate Start Date is before End Date when both are provided",
                        validationQuery: `SELECT Id, Name, tc9_pr__Start_Date__c, tc9_pr__End_Date__c 
                            FROM tc9_pr__Calendar__c 
                            WHERE tc9_pr__Start_Date__c != null 
                            AND tc9_pr__End_Date__c != null 
                            AND tc9_pr__Start_Date__c > tc9_pr__End_Date__c`,
                        expectedResult: "empty",
                        errorMessage: "Found calendars where Start Date is after End Date",
                        severity: "error"
                    }
                ],
                picklistValidationChecks: [
                    {
                        checkName: "type-picklist",
                        description: "Validate Calendar Type picklist values",
                        fieldName: "tc9_pr__Type__c",
                        objectName: "tc9_pr__Calendar__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Calendar Type value",
                        severity: "error"
                    },
                    {
                        checkName: "country-picklist",
                        description: "Validate Country picklist values",
                        fieldName: "tc9_pr__Country__c",
                        objectName: "tc9_pr__Calendar__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Country value",
                        severity: "warning"
                    },
                    {
                        checkName: "state-province-picklist",
                        description: "Validate State/Province picklist values",
                        fieldName: "tc9_pr__State_Province__c",
                        objectName: "tc9_pr__Calendar__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid State/Province value",
                        severity: "warning"
                    }
                ],
                preValidationQueries: []
            },
            dependencies: []
        }
    ],
    executionOrder: ["calendarMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-01-03"),
        updatedAt: new Date("2025-01-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: ["tc9_pr__Calendar__c.Create", "tc9_pr__Calendar__c.Edit", "tc9_pr__Calendar__c.Read"],
        estimatedDuration: 15,
        complexity: "simple"
    }
};

// Export hooks separately to maintain consistency with other templates
export const calendarTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_pr__Calendar__c"
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
            
            // Update load config
            if (step.loadConfig?.externalIdField === "{externalIdField}") {
                step.loadConfig.externalIdField = externalIdField;
            }
            
            // Update validation queries
            if (step.validationConfig?.dataIntegrityChecks) {
                step.validationConfig.dataIntegrityChecks.forEach((check: any) => {
                    if (check.validationQuery) {
                        check.validationQuery = check.validationQuery.replace(
                            /{externalIdField}/g,
                            externalIdField
                        );
                    }
                });
            }
        });
        
        console.log(`Using external ID field: ${externalIdField}`);
        return { success: true };
    },
    postExtract: async (data: any, context: any) => {
        console.log(`Extracted ${data.length} calendar records`);
        return data;
    },
    preLoad: async (data: any, context: any) => {
        console.log(`Preparing to load ${data.length} calendar records`);
        return data;
    },
    postMigration: async (results: any, context: any) => {
        console.log("Calendar migration completed");
        return { success: true };
    }
};