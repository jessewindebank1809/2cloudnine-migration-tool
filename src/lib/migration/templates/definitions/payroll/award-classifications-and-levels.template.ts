import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const awardClassificationsAndLevelsTemplate: MigrationTemplate = {
    id: "payroll-award-classifications-and-levels",
    name: "Award Classifications and Levels",
    description: "Migrate award classifications and levels records with complete 1:1 field mapping",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "awardClassificationsAndLevelsMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, OwnerId, RecordTypeId, 
                    tc9_et__Status__c, {externalIdField}
                    FROM tc9_et__Award_Classifications_and_Levels__c`,
                objectApiName: "tc9_et__Award_Classifications_and_Levels__c",
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
                    // Custom fields
                    {
                        sourceField: "tc9_et__Status__c",
                        targetField: "tc9_et__Status__c",
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
                targetObject: "tc9_et__Award_Classifications_and_Levels__c",
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
                        description: "Ensure Award Classification Name is provided",
                        validationQuery: "SELECT Id FROM tc9_et__Award_Classifications_and_Levels__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Award Classification Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_et__Award_Classifications_and_Levels__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Award Classification records missing external ID",
                        severity: "warning"
                    }
                ],
                picklistValidationChecks: [
                    {
                        checkName: "status-picklist",
                        description: "Validate Status picklist values",
                        fieldName: "tc9_et__Status__c",
                        objectName: "tc9_et__Award_Classifications_and_Levels__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Status value",
                        severity: "warning"
                    }
                ],
                preValidationQueries: []
            },
            dependencies: []
        }
    ],
    executionOrder: ["awardClassificationsAndLevelsMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-01-03"),
        updatedAt: new Date("2025-01-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: [
            "tc9_et__Award_Classifications_and_Levels__c.Create", 
            "tc9_et__Award_Classifications_and_Levels__c.Edit", 
            "tc9_et__Award_Classifications_and_Levels__c.Read"
        ],
        estimatedDuration: 5,
        complexity: "simple"
    }
};

// Export hooks separately to maintain consistency with other templates
export const awardClassificationsAndLevelsTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_et__Award_Classifications_and_Levels__c"
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
        console.log(`Extracted ${data.length} award classification records`);
        return data;
    },
    preLoad: async (data: any, context: any) => {
        console.log(`Preparing to load ${data.length} award classification records`);
        return data;
    },
    postMigration: async (results: any, context: any) => {
        console.log("Award classifications migration completed");
        return { success: true };
    }
};