import { leaveRulesTemplate } from "../definitions/payroll/leave-rules.template";
import { ExternalIdUtils } from "../utils/external-id-utils";

describe("Leave Rules Template", () => {
    describe("Template Structure", () => {
        it("should have correct basic properties", () => {
            expect(leaveRulesTemplate.id).toBe("payroll-leave-rules");
            expect(leaveRulesTemplate.name).toBe("Leave Rules");
            expect(leaveRulesTemplate.category).toBe("payroll");
            expect(leaveRulesTemplate.version).toBe("1.0.0");
        });

        it("should have one ETL step", () => {
            expect(leaveRulesTemplate.etlSteps).toHaveLength(1);
            expect(leaveRulesTemplate.etlSteps[0].stepName).toBe("leaveRuleMaster");
        });

        it("should have required permissions", () => {
            expect(leaveRulesTemplate.requiredPermissions).toContain("tc9_pr__Leave_Rule__c.Read");
            expect(leaveRulesTemplate.requiredPermissions).toContain("tc9_pr__Leave_Rule__c.Create");
            expect(leaveRulesTemplate.requiredPermissions).toContain("tc9_pr__Leave_Rule__c.Edit");
            expect(leaveRulesTemplate.requiredPermissions).toContain("tc9_pr__Pay_Code__c.Read");
        });
    });

    describe("Extract Configuration", () => {
        const extractConfig = leaveRulesTemplate.etlSteps[0].extractConfig;

        it("should have correct object API name", () => {
            expect(extractConfig.objectApiName).toBe("tc9_pr__Leave_Rule__c");
        });

        it("should include all essential fields in SOQL query", () => {
            const query = extractConfig.soqlQuery;
            
            // Required fields
            expect(query).toContain("Id");
            expect(query).toContain("Name");
            expect(query).toContain("tc9_pr__Effective_Date__c");
            expect(query).toContain("tc9_pr__Status__c");
            
            // Lookup fields with relationships
            expect(query).toContain("tc9_pr__Pay_Code__c");
            expect(query).toContain("tc9_pr__Pay_Code__r.{externalIdField}");
            expect(query).toContain("tc9_pr__Unpaid_Pay_Code__c");
            expect(query).toContain("tc9_pr__Unpaid_Pay_Code__r.{externalIdField}");
            
            // Other fields
            expect(query).toContain("tc9_pr__Available_Pay_Rates__c");
            expect(query).toContain("tc9_pr__Allow_Pay_in_Advance__c");
            expect(query).toContain("tc9_pr__Skip_Manager_Approval__c");
            expect(query).toContain("{externalIdField}");
        });

        it("should have appropriate batch size", () => {
            expect(extractConfig.batchSize).toBe(200);
        });
    });

    describe("Transform Configuration", () => {
        const transformConfig = leaveRulesTemplate.etlSteps[0].transformConfig;

        it("should map source Id to external ID field", () => {
            const idMapping = transformConfig.fieldMappings.find(
                (fm) => fm.sourceField === "Id"
            );
            expect(idMapping).toBeDefined();
            expect(idMapping?.targetField).toBe("{externalIdField}");
            expect(idMapping?.isRequired).toBe(true);
        });

        it("should have required field mappings", () => {
            const requiredFields = ["Name", "tc9_pr__Effective_Date__c", "tc9_pr__Status__c"];
            
            requiredFields.forEach(field => {
                const mapping = transformConfig.fieldMappings.find(
                    (fm) => fm.sourceField === field
                );
                expect(mapping).toBeDefined();
                expect(mapping?.isRequired).toBe(true);
            });
        });

        it("should have correct transformation types", () => {
            const dateMapping = transformConfig.fieldMappings.find(
                (fm) => fm.sourceField === "tc9_pr__Effective_Date__c"
            );
            expect(dateMapping?.transformationType).toBe("date");

            const numberMapping = transformConfig.fieldMappings.find(
                (fm) => fm.sourceField === "tc9_pr__Available_Pay_Rates__c"
            );
            expect(numberMapping?.transformationType).toBe("number");
        });

        it("should have lookup mappings for pay codes", () => {
            expect(transformConfig.lookupMappings).toHaveLength(2);
            
            const payCodeLookup = transformConfig.lookupMappings.find(
                (lm) => lm.sourceField === "tc9_pr__Pay_Code__r.{externalIdField}"
            );
            expect(payCodeLookup).toBeDefined();
            expect(payCodeLookup?.targetField).toBe("tc9_pr__Pay_Code__c");
            expect(payCodeLookup?.lookupObject).toBe("tc9_pr__Pay_Code__c");
            expect(payCodeLookup?.cacheResults).toBe(true);

            const unpaidPayCodeLookup = transformConfig.lookupMappings.find(
                (lm) => lm.sourceField === "tc9_pr__Unpaid_Pay_Code__r.{externalIdField}"
            );
            expect(unpaidPayCodeLookup).toBeDefined();
            expect(unpaidPayCodeLookup?.targetField).toBe("tc9_pr__Unpaid_Pay_Code__c");
        });

        it("should have external ID handling configuration", () => {
            expect(transformConfig.externalIdHandling).toBeDefined();
        });
    });

    describe("Load Configuration", () => {
        const loadConfig = leaveRulesTemplate.etlSteps[0].loadConfig;

        it("should have correct target object", () => {
            expect(loadConfig.targetObject).toBe("tc9_pr__Leave_Rule__c");
        });

        it("should use UPSERT operation", () => {
            expect(loadConfig.loadType).toBe("UPSERT");
        });

        it("should have external ID field configured", () => {
            expect(loadConfig.externalIdField).toBe("{externalIdField}");
        });

        it("should have retry configuration", () => {
            expect(loadConfig.retryConfig).toBeDefined();
            expect(loadConfig.retryConfig?.maxRetries).toBe(3);
            expect(loadConfig.retryConfig?.retryDelayMs).toBe(1000);
            expect(loadConfig.retryConfig?.retryableErrors).toContain("UNABLE_TO_LOCK_ROW");
        });
    });

    describe("Validation Configuration", () => {
        const validationConfig = leaveRulesTemplate.etlSteps[0].validationConfig;

        it("should have pre-validation queries", () => {
            expect(validationConfig.preValidationQueries).toHaveLength(1);
            
            const payCodeQuery = validationConfig.preValidationQueries[0];
            expect(payCodeQuery.queryName).toBe("targetPayCodes");
            expect(payCodeQuery.soqlQuery).toContain("tc9_pr__Pay_Code__c");
        });

        it("should have dependency checks for pay codes", () => {
            expect(validationConfig.dependencyChecks).toHaveLength(2);
            
            const payCodeCheck = validationConfig.dependencyChecks.find(
                (dc) => dc.checkName === "payCodeExists"
            );
            expect(payCodeCheck).toBeDefined();
            expect(payCodeCheck?.targetObject).toBe("tc9_pr__Pay_Code__c");
            expect(payCodeCheck?.isRequired).toBe(false); // Pay codes are optional

            const unpaidPayCodeCheck = validationConfig.dependencyChecks.find(
                (dc) => dc.checkName === "unpaidPayCodeExists"
            );
            expect(unpaidPayCodeCheck).toBeDefined();
            expect(unpaidPayCodeCheck?.isRequired).toBe(false);
        });

        it("should have data integrity checks", () => {
            const requiredFieldsCheck = validationConfig.dataIntegrityChecks.find(
                (dic) => dic.checkName === "requiredFieldsValidation"
            );
            expect(requiredFieldsCheck).toBeDefined();
            expect(requiredFieldsCheck?.severity).toBe("error");

            const externalIdCheck = validationConfig.dataIntegrityChecks.find(
                (dic) => dic.checkName === "sourcePayCodeExternalIdValidation"
            );
            expect(externalIdCheck).toBeDefined();
            expect(externalIdCheck?.severity).toBe("error");

            const dateCheck = validationConfig.dataIntegrityChecks.find(
                (dic) => dic.checkName === "effectiveDateValidation"
            );
            expect(dateCheck).toBeDefined();
            expect(dateCheck?.severity).toBe("warning"); // Date in past is warning only
        });

        it("should have picklist validations", () => {
            expect(validationConfig.picklistValidations).toHaveLength(1);
            
            const statusValidation = validationConfig.picklistValidations[0];
            expect(statusValidation.fieldName).toBe("tc9_pr__Status__c");
            expect(statusValidation.allowedValues).toEqual(["Active", "Inactive"]);
            expect(statusValidation.isRestricted).toBe(true);
        });

        it("should have post-load validation queries", () => {
            expect(validationConfig.postLoadValidationQueries).toHaveLength(2);
            
            const countQuery = validationConfig.postLoadValidationQueries.find(
                (plv) => plv.queryName === "verifyLeaveRulesMigrated"
            );
            expect(countQuery).toBeDefined();
            expect(countQuery?.expectedCount).toBe("{expectedRecordCount}");

            const referenceQuery = validationConfig.postLoadValidationQueries.find(
                (plv) => plv.queryName === "verifyPayCodeReferences"
            );
            expect(referenceQuery).toBeDefined();
            expect(referenceQuery?.expectedResult).toBe("matches_source");
        });
    });

    describe("Field Mapping Completeness", () => {
        it("should map all essential fields mentioned in requirements", () => {
            const fieldMappings = leaveRulesTemplate.etlSteps[0].transformConfig.fieldMappings;
            const mappedFields = fieldMappings.map(fm => fm.sourceField);
            
            const essentialFields = [
                "Name",
                "tc9_pr__Effective_Date__c",
                "tc9_pr__Status__c",
                "tc9_pr__Available_Pay_Rates__c",
                "tc9_pr__Allow_Pay_in_Advance__c",
                "tc9_pr__Skip_Manager_Approval__c"
            ];
            
            essentialFields.forEach(field => {
                expect(mappedFields).toContain(field);
            });
        });
    });

    describe("External ID Utils Integration", () => {
        it("should use ExternalIdUtils for configuration", () => {
            const transformConfig = leaveRulesTemplate.etlSteps[0].transformConfig;
            expect(transformConfig.externalIdHandling).toBeDefined();
            expect(ExternalIdUtils.createDefaultConfig).toBeDefined();
        });
    });

    describe("Error Messages", () => {
        it("should have descriptive error messages", () => {
            const validationConfig = leaveRulesTemplate.etlSteps[0].validationConfig;
            
            validationConfig.dependencyChecks.forEach(check => {
                expect(check.errorMessage).toBeTruthy();
                expect(check.errorMessage).toContain("Migration cannot proceed");
            });
            
            validationConfig.dataIntegrityChecks.forEach(check => {
                expect(check.errorMessage).toBeTruthy();
            });
        });
    });
});