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
                lookupMappings: [],
                externalIdHandling: ExternalIdUtils.createDefaultConfig(),
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
                    retryWaitSeconds: 1,
                    retryableErrors: ["UNABLE_TO_LOCK_ROW", "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY"],
                },
            },
            validationConfig: {
                dependencyChecks: [],
                dataIntegrityChecks: [
                    {
                        checkName: "requiredFieldsValidation",
                        description: "Validate that required fields are populated",
                        validationQuery: `SELECT Id, Name, tc9_pr__Code__c FROM tc9_pr__Pay_Code__c WHERE Name = null OR tc9_pr__Code__c = null`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Found pay codes with missing required fields (Name or Code)",
                        severity: "error",
                    },
                    {
                        checkName: "uniqueCodeValidation",
                        description: "Validate that pay code codes are unique",
                        validationQuery: `SELECT tc9_pr__Code__c, COUNT(Id) FROM tc9_pr__Pay_Code__c GROUP BY tc9_pr__Code__c HAVING COUNT(Id) > 1`,
                        expectedResult: "empty",
                        errorMessage: "Migration cannot proceed: Found duplicate pay code codes. Each code must be unique",
                        severity: "error",
                    },
                ],
                picklistValidationChecks: [
                    {
                        checkName: "typePicklistValidation",
                        description: "Validate Type picklist values",
                        fieldName: "tc9_pr__Type__c",
                        objectName: "tc9_pr__Pay_Code__c",
                        validateAgainstTarget: true,
                        crossEnvironmentMapping: false,
                        errorMessage: "Invalid Pay Code Type value",
                        severity: "warning",
                    },
                    {
                        checkName: "statusPicklistValidation",
                        description: "Validate Status picklist values",
                        fieldName: "tc9_pr__Status__c",
                        objectName: "tc9_pr__Pay_Code__c",
                        validateAgainstTarget: true,
                        crossEnvironmentMapping: false,
                        errorMessage: "Invalid Pay Code Status value",
                        severity: "warning",
                    },
                ],
                preValidationQueries: [],
            },
            dependencies: [],
        },
    ],
    executionOrder: ["payCodeMaster"],
    metadata: {
        author: "Migration Tool",
        createdAt: new Date(),
        updatedAt: new Date(),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: [
            "tc9_pr__Pay_Code__c.Read",
            "tc9_pr__Pay_Code__c.Create",
            "tc9_pr__Pay_Code__c.Edit",
        ],
        estimatedDuration: 5,
        complexity: "simple",
    },
};