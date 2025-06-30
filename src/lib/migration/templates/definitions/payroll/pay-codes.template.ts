import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const payCodesTemplate: MigrationTemplate = {
    id: "payroll-pay-codes",
    name: "Pay Codes",
    description: "Migrate pay codes with essential validation",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "payCodeMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, tc9_pr__Description__c, 
                    tc9_pr__Pay_Rate_Multiplier__c, tc9_pr__STP_Payment_Type__c, 
                    tc9_pr__External_ID__c, {externalIdField} 
                    FROM tc9_pr__Pay_Code__c`,
                objectApiName: "tc9_pr__Pay_Code__c",
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
                        sourceField: "tc9_pr__Description__c",
                        targetField: "tc9_pr__Description__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Pay_Rate_Multiplier__c",
                        targetField: "tc9_pr__Pay_Rate_Multiplier__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__STP_Payment_Type__c",
                        targetField: "tc9_pr__STP_Payment_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__External_ID__c",
                        targetField: "tc9_pr__External_ID__c",
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
                targetObject: "tc9_pr__Pay_Code__c",
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
                        description: "Ensure Pay Code Name is provided",
                        validationQuery: "SELECT Id FROM tc9_pr__Pay_Code__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Pay Code Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_pr__Pay_Code__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Pay Code records missing external ID",
                        severity: "warning"
                    }
                ],
                picklistValidationChecks: [
                    {
                        checkName: "payment-type-picklist",
                        description: "Validate STP Payment Type picklist values",
                        fieldName: "tc9_pr__STP_Payment_Type__c",
                        objectName: "tc9_pr__Pay_Code__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid STP Payment Type value",
                        severity: "warning"
                    }
                ],
                preValidationQueries: []
            },
            dependencies: []
        }
    ],
    executionOrder: ["payCodeMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: ["tc9_pr__Pay_Code__c.Create", "tc9_pr__Pay_Code__c.Edit"],
        estimatedDuration: 10,
        complexity: "simple"
    }
};

// Export hooks separately to maintain existing functionality
export const payCodesTemplateHooks = {
        preMigration: async (context: any) => {
            // Set external ID field based on org configuration
            const externalIdField = await ExternalIdUtils.getExternalIdField(
                context.targetOrgConnection,
                "tc9_pr__Pay_Code__c"
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
                
                // Update field permission checks
                if (step.loadConfig?.fieldPermissionChecks) {
                    // Field permission checks removed from LoadConfig interface
                }
            });
            
            console.log(`Using external ID field: ${externalIdField}`);
            return { success: true };
        },
        postExtract: async (data: any, context: any) => {
            console.log(`Extracted ${data.length} pay codes`);
            return data;
        },
        preLoad: async (data: any, context: any) => {
            console.log(`Preparing to load ${data.length} pay codes`);
            return data;
        },
        postMigration: async (results: any, context: any) => {
            console.log("Pay code migration completed");
            return { success: true };
        }
};