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
                soqlQuery: `SELECT Id, Name, tc9_pr__Code__c, tc9_pr__Type__c, 
                    tc9_pr__Status__c, tc9_pr__Rate__c, {externalIdField} 
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
                        sourceField: "tc9_pr__Code__c",
                        targetField: "tc9_pr__Code__c",
                        isRequired: true,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Type__c",
                        targetField: "tc9_pr__Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Status__c",
                        targetField: "tc9_pr__Status__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_pr__Rate__c",
                        targetField: "tc9_pr__Rate__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                ] as FieldMapping[],
                defaultValues: {},
                calculatedFields: {},
            },
            loadConfig: {
                targetObject: "tc9_pr__Pay_Code__c",
                operation: "upsert",
                externalIdField: "{externalIdField}",
                fieldPermissionChecks: [
                    "Name",
                    "tc9_pr__Code__c",
                    "tc9_pr__Type__c",
                    "tc9_pr__Status__c",
                    "tc9_pr__Rate__c",
                    "{externalIdField}"
                ],
            },
            validationConfig: {
                skipValidation: false,
                maxErrors: 100,
                dataIntegrityChecks: [
                    {
                        checkType: "required",
                        fieldName: "Name",
                        errorMessage: "Pay Code Name is required",
                        severity: "error",
                    },
                    {
                        checkType: "required",
                        fieldName: "tc9_pr__Code__c",
                        errorMessage: "Pay Code Code is required",
                        severity: "error",
                    },
                    {
                        checkType: "uniqueness",
                        fieldName: "tc9_pr__Code__c",
                        errorMessage: "Pay Code Code must be unique",
                        severity: "error",
                    },
                    {
                        checkType: "picklist",
                        fieldName: "tc9_pr__Type__c",
                        errorMessage: "Invalid Pay Code Type value",
                        severity: "warning",
                    },
                    {
                        checkType: "picklist",
                        fieldName: "tc9_pr__Status__c",
                        errorMessage: "Invalid Pay Code Status value",
                        severity: "warning",
                    },
                ] as DataIntegrityCheck[],
                customValidations: [],
            } as ValidationConfig,
        },
    ],
    executionOrder: ["payCodeMaster"],
    rollbackStrategy: {
        enabled: true,
        checkpointAfterEachStep: true,
    },
    errorHandling: {
        continueOnError: false,
        maxErrorsPerStep: 100,
        errorLogging: "detailed",
    },
    hooks: {
        preMigration: async (context) => {
            // Set external ID field based on org configuration
            const externalIdField = await ExternalIdUtils.getExternalIdField(
                context.targetOrgConnection,
                "tc9_pr__Pay_Code__c"
            );
            
            // Replace placeholders in all configurations
            context.template.etlSteps.forEach(step => {
                // Update SOQL query
                if (step.extractConfig?.soqlQuery) {
                    step.extractConfig.soqlQuery = step.extractConfig.soqlQuery.replace(
                        /{externalIdField}/g,
                        externalIdField
                    );
                }
                
                // Update field mappings
                if (step.transformConfig?.fieldMappings) {
                    step.transformConfig.fieldMappings.forEach(mapping => {
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
                    step.loadConfig.fieldPermissionChecks = step.loadConfig.fieldPermissionChecks.map(
                        field => field === "{externalIdField}" ? externalIdField : field
                    );
                }
            });
            
            console.log(`Using external ID field: ${externalIdField}`);
            return { success: true };
        },
        postExtract: async (data, context) => {
            console.log(`Extracted ${data.length} pay codes`);
            return data;
        },
        preLoad: async (data, context) => {
            console.log(`Preparing to load ${data.length} pay codes`);
            return data;
        },
        postMigration: async (results, context) => {
            console.log("Pay code migration completed");
            return { success: true };
        },
    },
};