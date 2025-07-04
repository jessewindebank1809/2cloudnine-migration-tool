import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, PicklistValidationCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const payrateLoadingTemplate: MigrationTemplate = {
    id: "payroll-payrate-loading",
    name: "PayRate Loading",
    description: "Migrate PayRate Loading records with comprehensive validation",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "payrateLoadingMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, OwnerId, RecordTypeId, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById, 
                    SystemModstamp, LastActivityDate, LastViewedDate, LastReferencedDate, 
                    tc9_et__Agency_Client__c, tc9_et__Approval_Date__c, tc9_et__Award__c, tc9_et__Business_Group__c, 
                    tc9_et__Client__c, tc9_et__Effective_Date__c, tc9_et__End_Date__c, tc9_et__Job_Class__c, 
                    tc9_et__Job_Request__c, tc9_et__Job_Role__c, tc9_et__Multiplier__c, tc9_et__Pay_Rate_Name__c, 
                    tc9_et__Percentage__c, tc9_et__Rate_Description__c, tc9_et__Rate_Loading_Code__c, 
                    tc9_et__Rate_Loading_Group__c, tc9_et__Rate_Loading_Type__c, tc9_et__Shift_Type__c, 
                    tc9_et__Status__c, tc9_et__Version_Number__c, tc9_et__Work_Order__c, tc9_et__Work_Order_Margin__c, 
                    tc9_et__XERO_Code__c, tc9_et__is_Active__c, tc9_et__GUID__c, tc9_et__Job_Board__c, 
                    tc9_et__Pay_Report_Exclude__c, tc9_et__Rate_Exemptions__c, tc9_et__Rate_Loading_Selection__c, 
                    tc9_et__Recruitment_Company__c, tc9_et__Site__c, tc9_et__State__c, tc9_et__Xero_Code_Long__c, 
                    tc9_et__Branch__c, tc9_et__External_ID__c, tc9_et__Compliance_Type__c, tc9_et__Recalculate_Rates__c, 
                    tc9_et__Ignore_for_RRD__c, tc9_et__Pay_Exempt__c, tc9_et__Margin_Type__c, tc9_et__Bill_Exempt__c, 
                    tc9_et__Bill_Report_Exclude__c, tc9_et__Bill_Rounding__c, tc9_et__Bill_Rounding_Margin__c, 
                    tc9_et__Pay_Rounding__c, tc9_et__Pay_Rounding_Margin__c, tc9_et__Priority__c, tc9_et__Test_Score__c, 
                    tc9_et__Employment_Company__c, tc9_et__GUID_Migration_Mapping__c, tc9_et__All_States__c, 
                    tc9_et__All_Sites__c, tc9_et__All_Branches__c, {externalIdField} 
                    FROM tc9_et__PayRate_Loading__c`,
                objectApiName: "tc9_et__PayRate_Loading__c",
                batchSize: 2000,
            },
            transformConfig: {
                fieldMappings: [
                    // System fields
                    { sourceField: "Id", targetField: "{externalIdField}", isRequired: true, transformationType: "direct" },
                    { sourceField: "Name", targetField: "Name", isRequired: true, transformationType: "direct" },
                    { sourceField: "OwnerId", targetField: "OwnerId", isRequired: false, transformationType: "direct" },
                    { sourceField: "RecordTypeId", targetField: "RecordTypeId", isRequired: false, transformationType: "direct" },
                    
                    // Custom fields - 1:1 mapping
                    { sourceField: "tc9_et__Agency_Client__c", targetField: "tc9_et__Agency_Client__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Approval_Date__c", targetField: "tc9_et__Approval_Date__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Award__c", targetField: "tc9_et__Award__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Business_Group__c", targetField: "tc9_et__Business_Group__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Client__c", targetField: "tc9_et__Client__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Effective_Date__c", targetField: "tc9_et__Effective_Date__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__End_Date__c", targetField: "tc9_et__End_Date__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Job_Class__c", targetField: "tc9_et__Job_Class__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Job_Request__c", targetField: "tc9_et__Job_Request__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Job_Role__c", targetField: "tc9_et__Job_Role__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Multiplier__c", targetField: "tc9_et__Multiplier__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Pay_Rate_Name__c", targetField: "tc9_et__Pay_Rate_Name__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Percentage__c", targetField: "tc9_et__Percentage__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Rate_Description__c", targetField: "tc9_et__Rate_Description__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Rate_Loading_Code__c", targetField: "tc9_et__Rate_Loading_Code__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Rate_Loading_Group__c", targetField: "tc9_et__Rate_Loading_Group__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Rate_Loading_Type__c", targetField: "tc9_et__Rate_Loading_Type__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Shift_Type__c", targetField: "tc9_et__Shift_Type__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Status__c", targetField: "tc9_et__Status__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Version_Number__c", targetField: "tc9_et__Version_Number__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Work_Order__c", targetField: "tc9_et__Work_Order__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Work_Order_Margin__c", targetField: "tc9_et__Work_Order_Margin__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__XERO_Code__c", targetField: "tc9_et__XERO_Code__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__is_Active__c", targetField: "tc9_et__is_Active__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__GUID__c", targetField: "tc9_et__GUID__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Job_Board__c", targetField: "tc9_et__Job_Board__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Pay_Report_Exclude__c", targetField: "tc9_et__Pay_Report_Exclude__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Rate_Exemptions__c", targetField: "tc9_et__Rate_Exemptions__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Rate_Loading_Selection__c", targetField: "tc9_et__Rate_Loading_Selection__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Recruitment_Company__c", targetField: "tc9_et__Recruitment_Company__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Site__c", targetField: "tc9_et__Site__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__State__c", targetField: "tc9_et__State__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Xero_Code_Long__c", targetField: "tc9_et__Xero_Code_Long__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Branch__c", targetField: "tc9_et__Branch__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__External_ID__c", targetField: "tc9_et__External_ID__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Compliance_Type__c", targetField: "tc9_et__Compliance_Type__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Recalculate_Rates__c", targetField: "tc9_et__Recalculate_Rates__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Ignore_for_RRD__c", targetField: "tc9_et__Ignore_for_RRD__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Pay_Exempt__c", targetField: "tc9_et__Pay_Exempt__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Margin_Type__c", targetField: "tc9_et__Margin_Type__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Bill_Exempt__c", targetField: "tc9_et__Bill_Exempt__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Bill_Report_Exclude__c", targetField: "tc9_et__Bill_Report_Exclude__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Bill_Rounding__c", targetField: "tc9_et__Bill_Rounding__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Bill_Rounding_Margin__c", targetField: "tc9_et__Bill_Rounding_Margin__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Pay_Rounding__c", targetField: "tc9_et__Pay_Rounding__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Pay_Rounding_Margin__c", targetField: "tc9_et__Pay_Rounding_Margin__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Priority__c", targetField: "tc9_et__Priority__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Test_Score__c", targetField: "tc9_et__Test_Score__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__Employment_Company__c", targetField: "tc9_et__Employment_Company__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__GUID_Migration_Mapping__c", targetField: "tc9_et__GUID_Migration_Mapping__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__All_States__c", targetField: "tc9_et__All_States__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__All_Sites__c", targetField: "tc9_et__All_Sites__c", isRequired: false, transformationType: "direct" },
                    { sourceField: "tc9_et__All_Branches__c", targetField: "tc9_et__All_Branches__c", isRequired: false, transformationType: "direct" }
                ] as FieldMapping[],
                lookupMappings: [],
                transformationScript: ""
            },
            loadConfig: {
                targetObject: "tc9_et__PayRate_Loading__c",
                operation: "upsert",
                externalIdField: "{externalIdField}",
                bulkApiConfig: {
                    useBulkApi: true,
                    batchSize: 10000,
                    concurrencyMode: "Parallel"
                }
            },
            validationConfig: {
                dataIntegrityChecks: [
                    {
                        checkName: "name-required",
                        checkType: "required_field",
                        description: "Verify Name field is populated",
                        validationQuery: "SELECT COUNT(1) FROM {sourceObject} WHERE Name IS NULL",
                        expectedResult: 0,
                        errorMessage: "Name field is required for all PayRate Loading records",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        checkType: "unique_field",
                        description: "Verify External ID uniqueness",
                        validationQuery: "SELECT {externalIdField}, COUNT(1) as cnt FROM {sourceObject} GROUP BY {externalIdField} HAVING COUNT(1) > 1",
                        expectedResult: 0,
                        errorMessage: "Duplicate External ID values found",
                        severity: "warning"
                    },
                    {
                        checkName: "effective-date-check",
                        checkType: "date_validation",
                        description: "Verify date ranges are valid",
                        validationQuery: "SELECT COUNT(1) FROM {sourceObject} WHERE tc9_et__Effective_Date__c > tc9_et__End_Date__c AND tc9_et__End_Date__c IS NOT NULL",
                        expectedResult: 0,
                        errorMessage: "Invalid date range: Effective Date is after End Date",
                        severity: "error"
                    }
                ] as DataIntegrityCheck[],
                picklistValidationChecks: [
                    {
                        checkName: "status-picklist",
                        checkType: "picklist_value",
                        description: "Validate Status picklist values",
                        fieldName: "tc9_et__Status__c",
                        objectName: "tc9_et__PayRate_Loading__c",
                        validateAgainstTarget: true,
                        allowedValues: [],
                        severity: "warning"
                    },
                    {
                        checkName: "rate-loading-type-picklist",
                        checkType: "picklist_value",
                        description: "Validate Rate Loading Type picklist values",
                        fieldName: "tc9_et__Rate_Loading_Type__c",
                        objectName: "tc9_et__PayRate_Loading__c",
                        validateAgainstTarget: true,
                        allowedValues: [],
                        severity: "warning"
                    },
                    {
                        checkName: "margin-type-picklist",
                        checkType: "picklist_value",
                        description: "Validate Margin Type picklist values",
                        fieldName: "tc9_et__Margin_Type__c",
                        objectName: "tc9_et__PayRate_Loading__c",
                        validateAgainstTarget: true,
                        allowedValues: [],
                        severity: "warning"
                    },
                    {
                        checkName: "compliance-type-picklist",
                        checkType: "picklist_value",
                        description: "Validate Compliance Type picklist values",
                        fieldName: "tc9_et__Compliance_Type__c",
                        objectName: "tc9_et__PayRate_Loading__c",
                        validateAgainstTarget: true,
                        allowedValues: [],
                        severity: "warning"
                    }
                ] as PicklistValidationCheck[],
                relationshipChecks: [],
                businessLogicChecks: []
            },
            dependencies: []
        }
    ],
    executionOrder: ["payrateLoadingMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-07-03"),
        updatedAt: new Date("2025-07-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: ["tc9_et__PayRate_Loading__c.Create", "tc9_et__PayRate_Loading__c.Edit"],
        estimatedDuration: 30,
        complexity: "moderate"
    }
};

// Export hooks separately to maintain existing functionality
export const payrateLoadingTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_et__PayRate_Loading__c"
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
    },
    
    postMigration: async (context: any) => {
        // Post-migration validation
        console.log("PayRate Loading migration completed successfully");
    }
};