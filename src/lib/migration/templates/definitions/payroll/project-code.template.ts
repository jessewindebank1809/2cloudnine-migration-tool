import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const projectCodeTemplate: MigrationTemplate = {
    id: "payroll-project-code",
    name: "Project Code",
    description: "Migrate Project Code records with comprehensive field mapping and validation",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "projectCodeMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, OwnerId, 
                    tc9_pr__Account__c, tc9_pr__Code__c, tc9_pr__Description__c, 
                    tc9_pr__Is_Activity__c, tc9_pr__Is_Charge_Against_Award_Budget__c, 
                    tc9_pr__Is_Default__c, tc9_pr__Levy_Type__c, 
                    tc9_pr__Pay_Type__c, tc9_pr__Time_Budget__c, 
                    tc9_pr__Type__c, tc9_pr__External_ID__c, {externalIdField}
                    FROM tc9_pr__Project_Code__c`,
                objectApiName: "tc9_pr__Project_Code__c",
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
                        sourceField: "OwnerId",
                        targetField: "OwnerId",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Account__c",
                        targetField: "tc9_pr__Account__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Code__c",
                        targetField: "tc9_pr__Code__c",
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
                        sourceField: "tc9_pr__Is_Activity__c",
                        targetField: "tc9_pr__Is_Activity__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Is_Charge_Against_Award_Budget__c",
                        targetField: "tc9_pr__Is_Charge_Against_Award_Budget__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Is_Default__c",
                        targetField: "tc9_pr__Is_Default__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Levy_Type__c",
                        targetField: "tc9_pr__Levy_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Pay_Type__c",
                        targetField: "tc9_pr__Pay_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Time_Budget__c",
                        targetField: "tc9_pr__Time_Budget__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Type__c",
                        targetField: "tc9_pr__Type__c",
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
                lookupMappings: [
                    {
                        sourceField: "tc9_pr__Account__c",
                        targetField: "tc9_pr__Account__c",
                        lookupObject: "Account",
                        lookupField: "Id",
                        lookupExternalIdField: "{accountExternalIdField}",
                        isRequired: false
                    }
                ],
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
                targetObject: "tc9_pr__Project_Code__c",
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
                        description: "Ensure Project Code Name is provided",
                        validationQuery: "SELECT Id FROM tc9_pr__Project_Code__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Project Code Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "code-required",
                        description: "Ensure Project Code is provided",
                        validationQuery: "SELECT Id FROM tc9_pr__Project_Code__c WHERE tc9_pr__Code__c = null",
                        expectedResult: "empty",
                        errorMessage: "Project Code is required",
                        severity: "error"
                    },
                    {
                        checkName: "unique-code",
                        description: "Ensure Project Code is unique",
                        validationQuery: "SELECT tc9_pr__Code__c, COUNT(Id) recordCount FROM tc9_pr__Project_Code__c GROUP BY tc9_pr__Code__c HAVING COUNT(Id) > 1",
                        expectedResult: "empty",
                        errorMessage: "Duplicate Project Codes found",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_pr__Project_Code__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Project Code records missing external ID",
                        severity: "warning"
                    },
                    {
                        checkName: "account-reference-valid",
                        description: "Ensure Account references are valid",
                        validationQuery: "SELECT Id FROM tc9_pr__Project_Code__c WHERE tc9_pr__Account__c != null AND tc9_pr__Account__c NOT IN (SELECT Id FROM Account)",
                        expectedResult: "empty",
                        errorMessage: "Invalid Account reference found",
                        severity: "error"
                    }
                ],
                picklistValidationChecks: [
                    {
                        checkName: "levy-type-picklist",
                        description: "Validate Levy Type picklist values",
                        fieldName: "tc9_pr__Levy_Type__c",
                        objectName: "tc9_pr__Project_Code__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Levy Type value",
                        severity: "warning"
                    },
                    {
                        checkName: "pay-type-picklist",
                        description: "Validate Pay Type picklist values",
                        fieldName: "tc9_pr__Pay_Type__c",
                        objectName: "tc9_pr__Project_Code__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Pay Type value",
                        severity: "warning"
                    },
                    {
                        checkName: "type-picklist",
                        description: "Validate Type picklist values",
                        fieldName: "tc9_pr__Type__c",
                        objectName: "tc9_pr__Project_Code__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Type value",
                        severity: "warning"
                    }
                ],
                preValidationQueries: []
            },
            dependencies: []
        }
    ],
    executionOrder: ["projectCodeMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-01-03"),
        updatedAt: new Date("2025-01-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: ["tc9_pr__Project_Code__c.Create", "tc9_pr__Project_Code__c.Edit"],
        estimatedDuration: 15,
        complexity: "medium"
    }
};

// Export hooks separately to maintain existing functionality
export const projectCodeTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_pr__Project_Code__c"
        );
        
        // Get Account external ID field
        const accountExternalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "Account"
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
                    if (mapping.lookupExternalIdField === "{accountExternalIdField}") {
                        mapping.lookupExternalIdField = accountExternalIdField;
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
        console.log(`Using Account external ID field: ${accountExternalIdField}`);
        return { success: true };
    },
    postExtract: async (data: any, context: any) => {
        console.log(`Extracted ${data.length} project codes`);
        return data;
    },
    preLoad: async (data: any, context: any) => {
        console.log(`Preparing to load ${data.length} project codes`);
        return data;
    },
    postMigration: async (results: any, context: any) => {
        console.log("Project Code migration completed");
        return { success: true };
    }
};