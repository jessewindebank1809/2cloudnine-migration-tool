import { MigrationTemplate, FieldMapping, ValidationConfig, DataIntegrityCheck, DependencyCheck } from "../../core/interfaces";
import { ExternalIdUtils } from "../../utils/external-id-utils";

export const templateGroupTemplate: MigrationTemplate = {
    id: "payroll-template-group",
    name: "Template Group",
    description: "Migrate Template Group records with client relationship validation",
    category: "payroll",
    version: "1.0.0",
    etlSteps: [
        {
            stepName: "templateGroupMaster",
            stepOrder: 1,
            extractConfig: {
                soqlQuery: `SELECT Id, Name, tc9_pr__Client__c, RecordTypeId, 
                    OwnerId, CreatedDate, CreatedById, LastModifiedDate, 
                    LastModifiedById, LastActivityDate, LastViewedDate, 
                    LastReferencedDate, SystemModstamp, IsDeleted, 
                    tc9_edc__External_ID_Data_Creation__c, 
                    {externalIdField} 
                    FROM tc9_pr__Template_Group__c`,
                objectApiName: "tc9_pr__Template_Group__c",
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
                        sourceField: "RecordTypeId",
                        targetField: "RecordTypeId",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "OwnerId",
                        targetField: "OwnerId",
                        isRequired: false,
                        transformationType: "direct",
                    },
                    {
                        sourceField: "tc9_edc__External_ID_Data_Creation__c",
                        targetField: "tc9_edc__External_ID_Data_Creation__c",
                        isRequired: false,
                        transformationType: "direct",
                    },
                ] as FieldMapping[],
                lookupMappings: [
                    {
                        sourceField: "tc9_pr__Client__c",
                        targetField: "tc9_pr__Client__c",
                        lookupObject: "Account",
                        lookupKeyField: "{externalIdField}",
                        lookupValueField: "Id",
                        cacheResults: true,
                        allowNull: true,
                        sourceExternalIdField: "{externalIdField}",
                        targetExternalIdField: "{externalIdField}",
                        crossEnvironmentMapping: true
                    }
                ],
                recordTypeMapping: {
                    sourceField: "RecordTypeId",
                    targetField: "RecordTypeId",
                    mappingDictionary: {
                        // These will be dynamically mapped during migration
                        "Assignment_Rates": "Assignment_Rates",
                        "Employment_Cost": "Employment_Cost",
                        "Interpretation_Rules": "Interpretation_Rules",
                        "Invoice_Settings": "Invoice_Settings",
                        "Payee_Timesheet_Allowance": "Payee_Timesheet_Allowance",
                        "Rate_Calculator_Template": "Rate_Calculator_Template"
                    }
                },
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
                targetObject: "tc9_pr__Template_Group__c",
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
                dependencyChecks: [
                    {
                        checkName: "client-lookup",
                        description: "Ensure Client exists in target org",
                        sourceField: "tc9_pr__Client__c",
                        targetObject: "Account",
                        targetField: "Id",
                        isRequired: false,
                        errorMessage: "Client Account not found in target org",
                        warningMessage: "Template Group has no Client associated"
                    }
                ],
                dataIntegrityChecks: [
                    {
                        checkName: "name-required",
                        description: "Ensure Template Group Name is provided",
                        validationQuery: "SELECT Id FROM tc9_pr__Template_Group__c WHERE Name = null",
                        expectedResult: "empty",
                        errorMessage: "Template Group Name is required",
                        severity: "error"
                    },
                    {
                        checkName: "external-id-check",
                        description: "Check if external ID exists",
                        validationQuery: "SELECT Id FROM tc9_pr__Template_Group__c WHERE Id IN ({selectedRecordIds}) AND {externalIdField} = null",
                        expectedResult: "empty",
                        errorMessage: "Template Group records missing external ID",
                        severity: "warning"
                    },
                    {
                        checkName: "duplicate-name-per-client",
                        description: "Check for duplicate Template Group names per Client",
                        validationQuery: `SELECT Name, tc9_pr__Client__c, COUNT(Id) 
                            FROM tc9_pr__Template_Group__c 
                            WHERE Name != null 
                            GROUP BY Name, tc9_pr__Client__c 
                            HAVING COUNT(Id) > 1`,
                        expectedResult: "empty",
                        errorMessage: "Duplicate Template Group names found for the same Client",
                        severity: "warning"
                    }
                ],
                picklistValidationChecks: [],
                preValidationQueries: [
                    {
                        queryName: "clientAccounts",
                        soqlQuery: "SELECT Id, Name, {externalIdField} FROM Account WHERE Id IN ({clientIds})",
                        cacheKey: "client-accounts",
                        description: "Cache client account lookups"
                    }
                ]
            },
            dependencies: ["Account"]
        }
    ],
    executionOrder: ["templateGroupMaster"],
    metadata: {
        author: "System",
        createdAt: new Date("2025-01-03"),
        updatedAt: new Date("2025-01-03"),
        supportedApiVersions: ["59.0", "60.0", "61.0"],
        requiredPermissions: [
            "tc9_pr__Template_Group__c.Create", 
            "tc9_pr__Template_Group__c.Edit",
            "tc9_pr__Template_Group__c.Read",
            "Account.Read"
        ],
        estimatedDuration: 15,
        complexity: "simple"
    }
};

// Export hooks separately to maintain existing functionality
export const templateGroupTemplateHooks = {
    preMigration: async (context: any) => {
        // Set external ID field based on org configuration
        const externalIdField = await ExternalIdUtils.getExternalIdField(
            context.targetOrgConnection,
            "tc9_pr__Template_Group__c"
        );
        
        // Also get external ID field for Account (Client lookup)
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
                step.transformConfig.lookupMappings.forEach((lookup: any) => {
                    if (lookup.lookupObject === "Account") {
                        lookup.lookupKeyField = accountExternalIdField;
                        lookup.sourceExternalIdField = accountExternalIdField;
                        lookup.targetExternalIdField = accountExternalIdField;
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
            
            // Update pre-validation queries
            if (step.validationConfig?.preValidationQueries) {
                step.validationConfig.preValidationQueries.forEach((query: any) => {
                    if (query.soqlQuery) {
                        query.soqlQuery = query.soqlQuery.replace(
                            /{externalIdField}/g,
                            accountExternalIdField
                        );
                    }
                });
            }
        });
        
        console.log(`Using external ID field for Template Group: ${externalIdField}`);
        console.log(`Using external ID field for Account: ${accountExternalIdField}`);
        return { success: true };
    },
    postExtract: async (data: any, context: any) => {
        console.log(`Extracted ${data.length} template groups`);
        
        // Log record type distribution
        const recordTypeCount: Record<string, number> = {};
        data.forEach((record: any) => {
            const rtId = record.RecordTypeId || 'No Record Type';
            recordTypeCount[rtId] = (recordTypeCount[rtId] || 0) + 1;
        });
        console.log('Record Type distribution:', recordTypeCount);
        
        return data;
    },
    preLoad: async (data: any, context: any) => {
        console.log(`Preparing to load ${data.length} template groups`);
        
        // Log client association statistics
        const clientCount = data.filter((record: any) => record.tc9_pr__Client__c).length;
        console.log(`${clientCount} template groups have client associations`);
        
        return data;
    },
    postMigration: async (results: any, context: any) => {
        console.log("Template Group migration completed");
        
        if (results.failedRecords > 0) {
            console.warn(`Failed to migrate ${results.failedRecords} template groups`);
        }
        
        return { success: true };
    }
};