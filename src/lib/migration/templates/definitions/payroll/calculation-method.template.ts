import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const calculationMethodTemplate: MigrationTemplate = {
    id: "payroll-calculation-method",
    name: "Calculation Method",
    description: "Migrate calculation methods with all field mappings and validations",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "calculationMethodMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, OwnerId, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById, 
                    SystemModstamp, LastActivityDate, LastViewedDate, LastReferencedDate,
                    tc9_et__Legacy_Id__c, tc9_et__Rebilling_Method__c, tc9_et__Usage__c, 
                    tc9_et__Accumulation_Period__c, tc9_et__Application_Scope__c, tc9_et__Basis__c,
                    tc9_et__Basis_Item_Type__c, tc9_et__Behaviour__c, tc9_et__Company__c,
                    tc9_et__Include_Line_Items__c, tc9_et__Include_Umbrella_Deductions__c,
                    tc9_et__Item_Type__c, tc9_et__Line_Item_Amount__c, tc9_et__Line_Item_Quantity__c,
                    tc9_et__Line_Item_Rate__c, tc9_et__Manual_Override__c, tc9_et__Method__c,
                    tc9_et__Method_Definition__c, tc9_et__Minimum_Value__c, tc9_et__Occupation_Category__c,
                    tc9_et__Organisation__c, tc9_et__Rounding_Direction__c, tc9_et__Rounding_Precision__c,
                    tc9_et__Type__c, tc9_et__Type_Code__c, tc9_et__Usage_Code__c, tc9_et__Use_Net_Billable__c,
                    {externalIdField} 
                    FROM tc9_et__Calculation_Method__c`,
                objectApiName: "tc9_et__Calculation_Method__c",
                batchSize: 200,
            },
            transformConfig: {
                fieldMappings: [
                    // Standard fields
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
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "CreatedDate",
                        targetField: "CreatedDate",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "CreatedById",
                        targetField: "CreatedById",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "LastModifiedDate",
                        targetField: "LastModifiedDate",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "LastModifiedById",
                        targetField: "LastModifiedById",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "SystemModstamp",
                        targetField: "SystemModstamp",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "LastActivityDate",
                        targetField: "LastActivityDate",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "LastViewedDate",
                        targetField: "LastViewedDate",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "LastReferencedDate",
                        targetField: "LastReferencedDate",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    // Custom fields
                    {
                        sourceField: "tc9_et__Legacy_Id__c",
                        targetField: "tc9_et__Legacy_Id__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Rebilling_Method__c",
                        targetField: "tc9_et__Rebilling_Method__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Usage__c",
                        targetField: "tc9_et__Usage__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Accumulation_Period__c",
                        targetField: "tc9_et__Accumulation_Period__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Application_Scope__c",
                        targetField: "tc9_et__Application_Scope__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Basis__c",
                        targetField: "tc9_et__Basis__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Basis_Item_Type__c",
                        targetField: "tc9_et__Basis_Item_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Behaviour__c",
                        targetField: "tc9_et__Behaviour__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Company__c",
                        targetField: "tc9_et__Company__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Include_Line_Items__c",
                        targetField: "tc9_et__Include_Line_Items__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Include_Umbrella_Deductions__c",
                        targetField: "tc9_et__Include_Umbrella_Deductions__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Item_Type__c",
                        targetField: "tc9_et__Item_Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Line_Item_Amount__c",
                        targetField: "tc9_et__Line_Item_Amount__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Line_Item_Quantity__c",
                        targetField: "tc9_et__Line_Item_Quantity__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Line_Item_Rate__c",
                        targetField: "tc9_et__Line_Item_Rate__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Manual_Override__c",
                        targetField: "tc9_et__Manual_Override__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Method__c",
                        targetField: "tc9_et__Method__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Method_Definition__c",
                        targetField: "tc9_et__Method_Definition__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Minimum_Value__c",
                        targetField: "tc9_et__Minimum_Value__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Occupation_Category__c",
                        targetField: "tc9_et__Occupation_Category__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Organisation__c",
                        targetField: "tc9_et__Organisation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Rounding_Direction__c",
                        targetField: "tc9_et__Rounding_Direction__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Rounding_Precision__c",
                        targetField: "tc9_et__Rounding_Precision__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Type__c",
                        targetField: "tc9_et__Type__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Type_Code__c",
                        targetField: "tc9_et__Type_Code__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Usage_Code__c",
                        targetField: "tc9_et__Usage_Code__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_et__Use_Net_Billable__c",
                        targetField: "tc9_et__Use_Net_Billable__c",
                        isRequired: false,
                        transformationType: "direct",
                    }
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
                targetObject: "tc9_et__Calculation_Method__c",
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
                        description: "Ensure Calculation Method Name is provided",
                        validationQuery: "SELECT Id FROM tc9_et__Calculation_Method__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Calculation Method Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_et__Calculation_Method__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Calculation Method records missing external ID",
                        severity: "warning"
                    }
                ],
                picklistValidationChecks: [
                    {
                        checkName: "rebilling-method-picklist",
                        description: "Validate Rebilling Method picklist values",
                        fieldName: "tc9_et__Rebilling_Method__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Rebilling Method value",
                        severity: "warning"
                    },
                    {
                        checkName: "usage-picklist",
                        description: "Validate Usage picklist values",
                        fieldName: "tc9_et__Usage__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Usage value",
                        severity: "warning"
                    },
                    {
                        checkName: "accumulation-period-picklist",
                        description: "Validate Accumulation Period picklist values",
                        fieldName: "tc9_et__Accumulation_Period__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Accumulation Period value",
                        severity: "warning"
                    },
                    {
                        checkName: "application-scope-picklist",
                        description: "Validate Application Scope picklist values",
                        fieldName: "tc9_et__Application_Scope__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Application Scope value",
                        severity: "warning"
                    },
                    {
                        checkName: "basis-picklist",
                        description: "Validate Basis picklist values",
                        fieldName: "tc9_et__Basis__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Basis value",
                        severity: "warning"
                    },
                    {
                        checkName: "behaviour-picklist",
                        description: "Validate Behaviour picklist values",
                        fieldName: "tc9_et__Behaviour__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Behaviour value",
                        severity: "warning"
                    },
                    {
                        checkName: "method-picklist",
                        description: "Validate Method picklist values",
                        fieldName: "tc9_et__Method__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Method value",
                        severity: "warning"
                    },
                    {
                        checkName: "rounding-direction-picklist",
                        description: "Validate Rounding Direction picklist values",
                        fieldName: "tc9_et__Rounding_Direction__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Rounding Direction value",
                        severity: "warning"
                    },
                    {
                        checkName: "rounding-precision-picklist",
                        description: "Validate Rounding Precision picklist values",
                        fieldName: "tc9_et__Rounding_Precision__c",
                        objectName: "tc9_et__Calculation_Method__c",
                        validateAgainstTarget: true,
                        errorMessage: "Invalid Rounding Precision value",
                        severity: "warning"
                    },
                    {
                        checkName: "type-picklist",
                        description: "Validate Type picklist values",
                        fieldName: "tc9_et__Type__c",
                        objectName: "tc9_et__Calculation_Method__c",
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
    executionOrder: ["calculationMethodMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-07-03"),
        updatedAt: new Date("2025-07-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: ["tc9_et__Calculation_Method__c.Create", "tc9_et__Calculation_Method__c.Edit"],
        estimatedDuration: 15,
        complexity: "medium"
    }
};

// Export hooks separately to maintain existing functionality
export const calculationMethodTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_et__Calculation_Method__c"
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
        console.log(`Extracted ${data.length} calculation methods`);
        return data;
    },
    preLoad: async (data: any, context: any) => {
        console.log(`Preparing to load ${data.length} calculation methods`);
        return data;
    },
    postMigration: async (results: any, context: any) => {
        console.log("Calculation method migration completed");
        return { success: true };
    }
};