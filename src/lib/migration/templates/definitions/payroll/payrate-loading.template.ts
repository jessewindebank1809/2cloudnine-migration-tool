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
            stepId: "extract-payrate-loading",
            operation: "extract",
            sourceObject: "tc9_et__PayRate_Loading__c",
            query: "SELECT Id, Name, OwnerId, RecordTypeId, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById, SystemModstamp, LastActivityDate, LastViewedDate, LastReferencedDate, tc9_et__Agency_Client__c, tc9_et__Approval_Date__c, tc9_et__Award__c, tc9_et__Business_Group__c, tc9_et__Client__c, tc9_et__Effective_Date__c, tc9_et__End_Date__c, tc9_et__Job_Class__c, tc9_et__Job_Request__c, tc9_et__Job_Role__c, tc9_et__Multiplier__c, tc9_et__Pay_Rate_Name__c, tc9_et__Percentage__c, tc9_et__Rate_Description__c, tc9_et__Rate_Loading_Code__c, tc9_et__Rate_Loading_Group__c, tc9_et__Rate_Loading_Type__c, tc9_et__Shift_Type__c, tc9_et__Status__c, tc9_et__Version_Number__c, tc9_et__Work_Order__c, tc9_et__Work_Order_Margin__c, tc9_et__XERO_Code__c, tc9_et__is_Active__c, tc9_et__GUID__c, tc9_et__Job_Board__c, tc9_et__Pay_Report_Exclude__c, tc9_et__Rate_Exemptions__c, tc9_et__Rate_Loading_Selection__c, tc9_et__Recruitment_Company__c, tc9_et__Site__c, tc9_et__State__c, tc9_et__Xero_Code_Long__c, tc9_et__Branch__c, tc9_et__External_ID__c, tc9_et__Compliance_Type__c, tc9_et__Recalculate_Rates__c, tc9_et__Ignore_for_RRD__c, tc9_et__Pay_Exempt__c, tc9_et__Margin_Type__c, tc9_et__Bill_Exempt__c, tc9_et__Bill_Report_Exclude__c, tc9_et__Bill_Rounding__c, tc9_et__Bill_Rounding_Margin__c, tc9_et__Pay_Rounding__c, tc9_et__Pay_Rounding_Margin__c, tc9_et__Priority__c, tc9_et__Test_Score__c, tc9_et__Employment_Company__c, tc9_et__GUID_Migration_Mapping__c, tc9_et__All_States__c, tc9_et__All_Sites__c, tc9_et__All_Branches__c FROM tc9_et__PayRate_Loading__c",
            fields: ["Id", "Name", "OwnerId", "RecordTypeId", "CreatedDate", "CreatedById", "LastModifiedDate", "LastModifiedById", "SystemModstamp", "LastActivityDate", "LastViewedDate", "LastReferencedDate", "tc9_et__Agency_Client__c", "tc9_et__Approval_Date__c", "tc9_et__Award__c", "tc9_et__Business_Group__c", "tc9_et__Client__c", "tc9_et__Effective_Date__c", "tc9_et__End_Date__c", "tc9_et__Job_Class__c", "tc9_et__Job_Request__c", "tc9_et__Job_Role__c", "tc9_et__Multiplier__c", "tc9_et__Pay_Rate_Name__c", "tc9_et__Percentage__c", "tc9_et__Rate_Description__c", "tc9_et__Rate_Loading_Code__c", "tc9_et__Rate_Loading_Group__c", "tc9_et__Rate_Loading_Type__c", "tc9_et__Shift_Type__c", "tc9_et__Status__c", "tc9_et__Version_Number__c", "tc9_et__Work_Order__c", "tc9_et__Work_Order_Margin__c", "tc9_et__XERO_Code__c", "tc9_et__is_Active__c", "tc9_et__GUID__c", "tc9_et__Job_Board__c", "tc9_et__Pay_Report_Exclude__c", "tc9_et__Rate_Exemptions__c", "tc9_et__Rate_Loading_Selection__c", "tc9_et__Recruitment_Company__c", "tc9_et__Site__c", "tc9_et__State__c", "tc9_et__Xero_Code_Long__c", "tc9_et__Branch__c", "tc9_et__External_ID__c", "tc9_et__Compliance_Type__c", "tc9_et__Recalculate_Rates__c", "tc9_et__Ignore_for_RRD__c", "tc9_et__Pay_Exempt__c", "tc9_et__Margin_Type__c", "tc9_et__Bill_Exempt__c", "tc9_et__Bill_Report_Exclude__c", "tc9_et__Bill_Rounding__c", "tc9_et__Bill_Rounding_Margin__c", "tc9_et__Pay_Rounding__c", "tc9_et__Pay_Rounding_Margin__c", "tc9_et__Priority__c", "tc9_et__Test_Score__c", "tc9_et__Employment_Company__c", "tc9_et__GUID_Migration_Mapping__c", "tc9_et__All_States__c", "tc9_et__All_Sites__c", "tc9_et__All_Branches__c"],
            filters: [],
            batchSize: 2000
        },
        {
            stepId: "transform-payrate-loading",
            operation: "transform",
            transformations: [],
            fieldMappings: [
                // System fields
                { sourceField: "Id", targetField: "tc9_et__External_ID__c" },
                { sourceField: "Name", targetField: "Name" },
                { sourceField: "OwnerId", targetField: "OwnerId" },
                { sourceField: "RecordTypeId", targetField: "RecordTypeId" },
                
                // Custom fields - 1:1 mapping
                { sourceField: "tc9_et__Agency_Client__c", targetField: "tc9_et__Agency_Client__c" },
                { sourceField: "tc9_et__Approval_Date__c", targetField: "tc9_et__Approval_Date__c" },
                { sourceField: "tc9_et__Award__c", targetField: "tc9_et__Award__c" },
                { sourceField: "tc9_et__Business_Group__c", targetField: "tc9_et__Business_Group__c" },
                { sourceField: "tc9_et__Client__c", targetField: "tc9_et__Client__c" },
                { sourceField: "tc9_et__Effective_Date__c", targetField: "tc9_et__Effective_Date__c" },
                { sourceField: "tc9_et__End_Date__c", targetField: "tc9_et__End_Date__c" },
                { sourceField: "tc9_et__Job_Class__c", targetField: "tc9_et__Job_Class__c" },
                { sourceField: "tc9_et__Job_Request__c", targetField: "tc9_et__Job_Request__c" },
                { sourceField: "tc9_et__Job_Role__c", targetField: "tc9_et__Job_Role__c" },
                { sourceField: "tc9_et__Multiplier__c", targetField: "tc9_et__Multiplier__c" },
                { sourceField: "tc9_et__Pay_Rate_Name__c", targetField: "tc9_et__Pay_Rate_Name__c" },
                { sourceField: "tc9_et__Percentage__c", targetField: "tc9_et__Percentage__c" },
                { sourceField: "tc9_et__Rate_Description__c", targetField: "tc9_et__Rate_Description__c" },
                { sourceField: "tc9_et__Rate_Loading_Code__c", targetField: "tc9_et__Rate_Loading_Code__c" },
                { sourceField: "tc9_et__Rate_Loading_Group__c", targetField: "tc9_et__Rate_Loading_Group__c" },
                { sourceField: "tc9_et__Rate_Loading_Type__c", targetField: "tc9_et__Rate_Loading_Type__c" },
                { sourceField: "tc9_et__Shift_Type__c", targetField: "tc9_et__Shift_Type__c" },
                { sourceField: "tc9_et__Status__c", targetField: "tc9_et__Status__c" },
                { sourceField: "tc9_et__Version_Number__c", targetField: "tc9_et__Version_Number__c" },
                { sourceField: "tc9_et__Work_Order__c", targetField: "tc9_et__Work_Order__c" },
                { sourceField: "tc9_et__Work_Order_Margin__c", targetField: "tc9_et__Work_Order_Margin__c" },
                { sourceField: "tc9_et__XERO_Code__c", targetField: "tc9_et__XERO_Code__c" },
                { sourceField: "tc9_et__is_Active__c", targetField: "tc9_et__is_Active__c" },
                { sourceField: "tc9_et__GUID__c", targetField: "tc9_et__GUID__c" },
                { sourceField: "tc9_et__Job_Board__c", targetField: "tc9_et__Job_Board__c" },
                { sourceField: "tc9_et__Pay_Report_Exclude__c", targetField: "tc9_et__Pay_Report_Exclude__c" },
                { sourceField: "tc9_et__Rate_Exemptions__c", targetField: "tc9_et__Rate_Exemptions__c" },
                { sourceField: "tc9_et__Rate_Loading_Selection__c", targetField: "tc9_et__Rate_Loading_Selection__c" },
                { sourceField: "tc9_et__Recruitment_Company__c", targetField: "tc9_et__Recruitment_Company__c" },
                { sourceField: "tc9_et__Site__c", targetField: "tc9_et__Site__c" },
                { sourceField: "tc9_et__State__c", targetField: "tc9_et__State__c" },
                { sourceField: "tc9_et__Xero_Code_Long__c", targetField: "tc9_et__Xero_Code_Long__c" },
                { sourceField: "tc9_et__Branch__c", targetField: "tc9_et__Branch__c" },
                { sourceField: "tc9_et__Compliance_Type__c", targetField: "tc9_et__Compliance_Type__c" },
                { sourceField: "tc9_et__Recalculate_Rates__c", targetField: "tc9_et__Recalculate_Rates__c" },
                { sourceField: "tc9_et__Ignore_for_RRD__c", targetField: "tc9_et__Ignore_for_RRD__c" },
                { sourceField: "tc9_et__Pay_Exempt__c", targetField: "tc9_et__Pay_Exempt__c" },
                { sourceField: "tc9_et__Margin_Type__c", targetField: "tc9_et__Margin_Type__c" },
                { sourceField: "tc9_et__Bill_Exempt__c", targetField: "tc9_et__Bill_Exempt__c" },
                { sourceField: "tc9_et__Bill_Report_Exclude__c", targetField: "tc9_et__Bill_Report_Exclude__c" },
                { sourceField: "tc9_et__Bill_Rounding__c", targetField: "tc9_et__Bill_Rounding__c" },
                { sourceField: "tc9_et__Bill_Rounding_Margin__c", targetField: "tc9_et__Bill_Rounding_Margin__c" },
                { sourceField: "tc9_et__Pay_Rounding__c", targetField: "tc9_et__Pay_Rounding__c" },
                { sourceField: "tc9_et__Pay_Rounding_Margin__c", targetField: "tc9_et__Pay_Rounding_Margin__c" },
                { sourceField: "tc9_et__Priority__c", targetField: "tc9_et__Priority__c" },
                { sourceField: "tc9_et__Test_Score__c", targetField: "tc9_et__Test_Score__c" },
                { sourceField: "tc9_et__Employment_Company__c", targetField: "tc9_et__Employment_Company__c" },
                { sourceField: "tc9_et__GUID_Migration_Mapping__c", targetField: "tc9_et__GUID_Migration_Mapping__c" },
                { sourceField: "tc9_et__All_States__c", targetField: "tc9_et__All_States__c" },
                { sourceField: "tc9_et__All_Sites__c", targetField: "tc9_et__All_Sites__c" },
                { sourceField: "tc9_et__All_Branches__c", targetField: "tc9_et__All_Branches__c" }
            ] as FieldMapping[]
        },
        {
            stepId: "validate-payrate-loading",
            operation: "validate",
            validations: [
                {
                    type: "required",
                    field: "tc9_et__Rate_Loading_Type__c",
                    message: "Rate Loading Type is required"
                },
                {
                    type: "picklist",
                    field: "tc9_et__Rate_Loading_Type__c",
                    allowedValues: ["Casual", "Leave", "Penalty", "Other", "Public Holiday", "Overtime", "Expense"],
                    message: "Invalid Rate Loading Type value"
                } as PicklistValidationCheck,
                {
                    type: "picklist",
                    field: "tc9_et__Margin_Type__c",
                    allowedValues: ["Amount", "Percentage"],
                    message: "Invalid Margin Type value"
                } as PicklistValidationCheck,
                {
                    type: "dateRange",
                    startDateField: "tc9_et__Effective_Date__c",
                    endDateField: "tc9_et__End_Date__c",
                    message: "Effective Date cannot be after End Date"
                },
                {
                    type: "range",
                    field: "tc9_et__Percentage__c",
                    min: 0,
                    max: 100,
                    message: "Percentage must be between 0 and 100"
                },
                {
                    type: "range",
                    field: "tc9_et__Multiplier__c",
                    min: 0,
                    message: "Multiplier cannot be negative"
                },
                {
                    type: "range",
                    field: "tc9_et__Priority__c",
                    min: 0,
                    message: "Priority cannot be negative"
                }
            ] as ValidationConfig[]
        },
        {
            stepId: "load-payrate-loading",
            operation: "load",
            targetObject: "tc9_et__PayRate_Loading__c",
            mode: "upsert",
            externalIdField: "tc9_et__External_ID__c",
            batchSize: 200
        }
    ],
    dependencies: [],
    validationRules: [
        {
            type: "dataIntegrity",
            name: "unique-rate-loading-code",
            description: "Ensure Rate Loading Code is unique within the organisation",
            fields: ["tc9_et__Rate_Loading_Code__c"],
            checkType: "uniqueness"
        } as DataIntegrityCheck
    ],
    transformationRules: [],
    rollbackStrategy: {
        supportedOperations: ["extract", "validate", "transform"],
        checkpoints: ["after-extract", "after-validate"]
    },
    executionMetrics: {
        estimatedDuration: 15,
        resourceRequirements: {
            memory: "medium",
            cpu: "low"
        }
    }
};

// Type definition for PayRate Loading records
export interface PayrateLoadingRecord {
    Id?: string;
    Name?: string;
    OwnerId?: string;
    RecordTypeId?: string;
    tc9_et__Agency_Client__c?: string;
    tc9_et__Approval_Date__c?: string;
    tc9_et__Award__c?: string;
    tc9_et__Business_Group__c?: string;
    tc9_et__Client__c?: string;
    tc9_et__Effective_Date__c?: string;
    tc9_et__End_Date__c?: string;
    tc9_et__Job_Class__c?: string;
    tc9_et__Job_Request__c?: string;
    tc9_et__Job_Role__c?: string;
    tc9_et__Multiplier__c?: number;
    tc9_et__Pay_Rate_Name__c?: string;
    tc9_et__Percentage__c?: number;
    tc9_et__Rate_Description__c?: string;
    tc9_et__Rate_Loading_Code__c?: string;
    tc9_et__Rate_Loading_Group__c?: string;
    tc9_et__Rate_Loading_Type__c?: 'Casual' | 'Leave' | 'Penalty' | 'Other' | 'Public Holiday' | 'Overtime' | 'Expense';
    tc9_et__Shift_Type__c?: string;
    tc9_et__Status__c?: string;
    tc9_et__Version_Number__c?: number;
    tc9_et__Work_Order__c?: string;
    tc9_et__Work_Order_Margin__c?: string;
    tc9_et__XERO_Code__c?: string;
    tc9_et__is_Active__c?: boolean;
    tc9_et__GUID__c?: string;
    tc9_et__Job_Board__c?: string;
    tc9_et__Pay_Report_Exclude__c?: boolean;
    tc9_et__Rate_Exemptions__c?: string;
    tc9_et__Rate_Loading_Selection__c?: string;
    tc9_et__Recruitment_Company__c?: string;
    tc9_et__Site__c?: string;
    tc9_et__State__c?: string;
    tc9_et__Xero_Code_Long__c?: string;
    tc9_et__Branch__c?: string;
    tc9_et__External_ID__c?: string;
    tc9_et__Compliance_Type__c?: string;
    tc9_et__Recalculate_Rates__c?: boolean;
    tc9_et__Ignore_for_RRD__c?: boolean;
    tc9_et__Pay_Exempt__c?: boolean;
    tc9_et__Margin_Type__c?: 'Amount' | 'Percentage';
    tc9_et__Bill_Exempt__c?: boolean;
    tc9_et__Bill_Report_Exclude__c?: boolean;
    tc9_et__Bill_Rounding__c?: number;
    tc9_et__Bill_Rounding_Margin__c?: number;
    tc9_et__Pay_Rounding__c?: number;
    tc9_et__Pay_Rounding_Margin__c?: number;
    tc9_et__Priority__c?: number;
    tc9_et__Test_Score__c?: string;
    tc9_et__Employment_Company__c?: string;
    tc9_et__GUID_Migration_Mapping__c?: string;
    tc9_et__All_States__c?: boolean;
    tc9_et__All_Sites__c?: boolean;
    tc9_et__All_Branches__c?: boolean;
}