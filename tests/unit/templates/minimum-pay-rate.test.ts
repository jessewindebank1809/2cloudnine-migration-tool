import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { minimumPayRateTemplate, minimumPayRateTemplateHooks } from '../../../src/lib/migration/templates/definitions/payroll/minimum-pay-rate.template';
import { Connection } from 'jsforce';

describe('Minimum Pay Rate Migration Template', () => {
    let mockContext: any;
    let mockConnection: Connection;

    beforeEach(() => {
        mockConnection = {
            describeGlobal: jest.fn(),
            describeSObject: jest.fn(),
            query: jest.fn(),
        } as unknown as Connection;

        mockContext = {
            sourceOrgConnection: mockConnection,
            targetOrgConnection: mockConnection,
            template: JSON.parse(JSON.stringify(minimumPayRateTemplate)), // Deep clone
            sessionId: 'test-session',
            userId: 'test-user',
            startTime: new Date(),
        };
    });

    describe('Template Structure', () => {
        it('should have correct template metadata', () => {
            expect(minimumPayRateTemplate.id).toBe('payroll-minimum-pay-rate');
            expect(minimumPayRateTemplate.name).toBe('Minimum Pay Rate');
            expect(minimumPayRateTemplate.category).toBe('payroll');
            expect(minimumPayRateTemplate.version).toBe('1.0.0');
            expect(minimumPayRateTemplate.description).toBe('Migrate minimum pay rate records with complete 1:1 field mapping and lookup relationships');
        });

        it('should have exactly one ETL step', () => {
            expect(minimumPayRateTemplate.etlSteps).toHaveLength(1);
            expect(minimumPayRateTemplate.executionOrder).toHaveLength(1);
            expect(minimumPayRateTemplate.executionOrder[0]).toBe('minimumPayRateMaster');
        });

        it('should have metadata configuration', () => {
            expect(minimumPayRateTemplate.metadata).toBeDefined();
            expect(minimumPayRateTemplate.metadata.author).toBe('System');
            expect(minimumPayRateTemplate.metadata.complexity).toBe('complex');
            expect(minimumPayRateTemplate.metadata.estimatedDuration).toBe(20);
            expect(minimumPayRateTemplate.metadata.supportedApiVersions).toEqual(['59.0', '60.0', '61.0']);
        });
    });

    describe('ETL Step Configuration', () => {
        const step = minimumPayRateTemplate.etlSteps[0];

        it('should have correct step configuration', () => {
            expect(step.stepName).toBe('minimumPayRateMaster');
            expect(step.stepOrder).toBe(1);
            expect(step.dependencies).toEqual(['awardClassificationsAndLevelsMaster']);
        });
    });

    describe('Extract Configuration', () => {
        const extractConfig = minimumPayRateTemplate.etlSteps[0].extractConfig;

        it('should have correct extract configuration', () => {
            expect(extractConfig.objectApiName).toBe('tc9_et__Minimum_Pay_Rate__c');
            expect(extractConfig.batchSize).toBe(200);
        });

        it('should include all fields in SOQL query', () => {
            const query = extractConfig.soqlQuery;
            
            // Standard fields
            expect(query).toContain('Id');
            expect(query).toContain('Name');
            expect(query).toContain('OwnerId');
            
            // Picklist fields
            expect(query).toContain('tc9_et__Annual_Rate_Change__c');
            expect(query).toContain('tc9_et__Rate_Entered__c');
            expect(query).toContain('tc9_et__Status__c');
            
            // Boolean fields
            expect(query).toContain('tc9_et__Create_Related_Margin_Mark_Up_Records__c');
            expect(query).toContain('tc9_et__Has_Pending_Assignment_to_be_processed__c');
            
            // Number fields
            expect(query).toContain('tc9_et__Custom_Pay_Rate_1__c');
            expect(query).toContain('tc9_et__Custom_Pay_Rate_2__c');
            expect(query).toContain('tc9_et__Margin_Rate__c');
            expect(query).toContain('tc9_et__Mark_Up_Rate__c');
            expect(query).toContain('tc9_et__Pay_Rate__c');
            expect(query).toContain('tc9_et__Primary_MPR_Pay_Rate__c');
            
            // Date fields
            expect(query).toContain('tc9_et__Effective_Date__c');
            expect(query).toContain('tc9_et__Expiry_Date__c');
            
            // External ID placeholder
            expect(query).toContain('{externalIdField}');
        });

        it('should include all lookup relationships with external ID', () => {
            const query = extractConfig.soqlQuery;
            
            expect(query).toContain('tc9_et__Allowance_Pay_Code__r.{externalIdField}');
            expect(query).toContain('tc9_et__Assignment_Rate_Template_Group__r.{externalIdField}');
            expect(query).toContain('tc9_et__Award_Classification__r.{externalIdField}');
            expect(query).toContain('tc9_et__Award_Level__r.{externalIdField}');
            expect(query).toContain('tc9_et__Calculation_Method__r.{externalIdField}');
            expect(query).toContain('tc9_et__Casual_Loading_Record__r.{externalIdField}');
            expect(query).toContain('tc9_et__Interpretation_Rule__r.{externalIdField}');
            expect(query).toContain('tc9_et__Primary_Minimum_Pay_Rate__r.{externalIdField}');
            expect(query).toContain('tc9_et__Project_Code__r.{externalIdField}');
            expect(query).toContain('tc9_et__Rate_Calculator_Template__r.{externalIdField}');
            expect(query).toContain('tc9_et__Timesheet_Activity__r.{externalIdField}');
        });
    });

    describe('Transform Configuration', () => {
        const transformConfig = minimumPayRateTemplate.etlSteps[0].transformConfig;

        it('should have correct number of field mappings', () => {
            expect(transformConfig.fieldMappings).toHaveLength(16); // Direct fields without lookups
        });

        it('should have correct number of lookup mappings', () => {
            expect(transformConfig.lookupMappings).toHaveLength(11); // All lookup relationships
        });

        it('should have correct external ID handling configuration', () => {
            expect(transformConfig.externalIdHandling).toEqual({
                sourceField: 'Id',
                targetField: '{externalIdField}',
                managedField: 'tc9_edc__External_ID_Data_Creation__c',
                unmanagedField: 'External_ID_Data_Creation__c',
                fallbackField: 'External_Id__c',
                strategy: 'auto-detect'
            });
        });

        it('should map all fields with direct transformation type', () => {
            transformConfig.fieldMappings.forEach(mapping => {
                expect(mapping.transformationType).toBe('direct');
            });
        });

        it('should have required fields marked correctly', () => {
            const nameMapping = transformConfig.fieldMappings.find(m => m.sourceField === 'Name');
            const externalIdMapping = transformConfig.fieldMappings.find(m => m.sourceField === 'Id');
            
            expect(nameMapping?.isRequired).toBe(true);
            expect(externalIdMapping?.isRequired).toBe(true);
            
            // All other fields should be optional
            const optionalFieldCount = transformConfig.fieldMappings.filter(m => !m.isRequired).length;
            expect(optionalFieldCount).toBe(14);
        });

        it('should have correct lookup mappings', () => {
            const payCodeLookup = transformConfig.lookupMappings.find(m => m.targetField === 'tc9_et__Allowance_Pay_Code__c');
            expect(payCodeLookup).toBeDefined();
            expect(payCodeLookup?.lookupObject).toBe('tc9_pr__Pay_Code__c');
            expect(payCodeLookup?.cacheResults).toBe(true);
            
            const awardClassificationLookup = transformConfig.lookupMappings.find(m => m.targetField === 'tc9_et__Award_Classification__c');
            expect(awardClassificationLookup).toBeDefined();
            expect(awardClassificationLookup?.lookupObject).toBe('tc9_et__Award_Classifications_and_Levels__c');
            
            const selfReferenceLookup = transformConfig.lookupMappings.find(m => m.targetField === 'tc9_et__Primary_Minimum_Pay_Rate__c');
            expect(selfReferenceLookup).toBeDefined();
            expect(selfReferenceLookup?.lookupObject).toBe('tc9_et__Minimum_Pay_Rate__c');
        });
    });

    describe('Load Configuration', () => {
        const loadConfig = minimumPayRateTemplate.etlSteps[0].loadConfig;

        it('should have correct load configuration', () => {
            expect(loadConfig.targetObject).toBe('tc9_et__Minimum_Pay_Rate__c');
            expect(loadConfig.operation).toBe('upsert');
            expect(loadConfig.externalIdField).toBe('{externalIdField}');
            expect(loadConfig.useBulkApi).toBe(true);
            expect(loadConfig.batchSize).toBe(200);
            expect(loadConfig.allowPartialSuccess).toBe(false);
        });

        it('should have retry configuration with additional error types', () => {
            expect(loadConfig.retryConfig).toBeDefined();
            expect(loadConfig.retryConfig?.maxRetries).toBe(3);
            expect(loadConfig.retryConfig?.retryWaitSeconds).toBe(5);
            expect(loadConfig.retryConfig?.retryableErrors).toContain('UNABLE_TO_LOCK_ROW');
            expect(loadConfig.retryConfig?.retryableErrors).toContain('REQUEST_LIMIT_EXCEEDED');
            expect(loadConfig.retryConfig?.retryableErrors).toContain('INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY');
        });
    });

    describe('Validation Configuration', () => {
        const validationConfig = minimumPayRateTemplate.etlSteps[0].validationConfig;

        it('should have pre-validation queries', () => {
            expect(validationConfig?.preValidationQueries).toHaveLength(2);
            
            const payCodeQuery = validationConfig?.preValidationQueries?.find(q => q.queryName === 'targetPayCodes');
            expect(payCodeQuery).toBeDefined();
            expect(payCodeQuery?.cacheKey).toBe('target_pay_codes');
            
            const awardQuery = validationConfig?.preValidationQueries?.find(q => q.queryName === 'targetAwardClassifications');
            expect(awardQuery).toBeDefined();
            expect(awardQuery?.cacheKey).toBe('target_award_classifications');
        });

        it('should have dependency checks', () => {
            expect(validationConfig?.dependencyChecks).toHaveLength(3);
            
            const payCodeCheck = validationConfig?.dependencyChecks?.find(c => c.checkName === 'payCodeExists');
            expect(payCodeCheck).toBeDefined();
            expect(payCodeCheck?.targetObject).toBe('tc9_pr__Pay_Code__c');
            
            const awardClassificationCheck = validationConfig?.dependencyChecks?.find(c => c.checkName === 'awardClassificationExists');
            expect(awardClassificationCheck).toBeDefined();
            expect(awardClassificationCheck?.targetObject).toBe('tc9_et__Award_Classifications_and_Levels__c');
            
            const awardLevelCheck = validationConfig?.dependencyChecks?.find(c => c.checkName === 'awardLevelExists');
            expect(awardLevelCheck).toBeDefined();
            expect(awardLevelCheck?.targetObject).toBe('tc9_et__Award_Classifications_and_Levels__c');
        });

        it('should have data integrity checks', () => {
            expect(validationConfig?.dataIntegrityChecks).toHaveLength(3);
            
            const nameCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'name-required');
            expect(nameCheck).toBeDefined();
            expect(nameCheck?.severity).toBe('error');
            
            const externalIdCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'external-id-check');
            expect(externalIdCheck).toBeDefined();
            expect(externalIdCheck?.severity).toBe('warning');
            
            const dateRangeCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'date-range-validation');
            expect(dateRangeCheck).toBeDefined();
            expect(dateRangeCheck?.severity).toBe('error');
            expect(dateRangeCheck?.validationQuery).toContain('tc9_et__Effective_Date__c > tc9_et__Expiry_Date__c');
        });

        it('should have picklist validation checks', () => {
            expect(validationConfig?.picklistValidationChecks).toHaveLength(3);
            
            const annualRatePicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'annual-rate-change-picklist');
            expect(annualRatePicklist).toBeDefined();
            expect(annualRatePicklist?.fieldName).toBe('tc9_et__Annual_Rate_Change__c');
            
            const rateEnteredPicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'rate-entered-picklist');
            expect(rateEnteredPicklist).toBeDefined();
            expect(rateEnteredPicklist?.fieldName).toBe('tc9_et__Rate_Entered__c');
            
            const statusPicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'status-picklist');
            expect(statusPicklist).toBeDefined();
            expect(statusPicklist?.fieldName).toBe('tc9_et__Status__c');
        });
    });

    describe('Template Hooks', () => {
        it('should export template hooks', () => {
            expect(minimumPayRateTemplateHooks).toBeDefined();
            expect(typeof minimumPayRateTemplateHooks.preMigration).toBe('function');
            expect(typeof minimumPayRateTemplateHooks.postExtract).toBe('function');
            expect(typeof minimumPayRateTemplateHooks.preLoad).toBe('function');
            expect(typeof minimumPayRateTemplateHooks.postMigration).toBe('function');
        });

        it('should replace external ID placeholders in preMigration hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            
            const result = await minimumPayRateTemplateHooks.preMigration(mockContext);
            
            expect(result).toEqual({ success: true });
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using external ID field:'));
        });

        it('should log extraction count in postExtract hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            const testData = new Array(10).fill({ Id: 'test' });
            
            const result = await minimumPayRateTemplateHooks.postExtract(testData, mockContext);
            
            expect(result).toBe(testData);
            expect(console.log).toHaveBeenCalledWith('Extracted 10 minimum pay rate records');
        });
    });

    describe('Required Permissions', () => {
        it('should have required permissions', () => {
            const permissions = minimumPayRateTemplate.metadata.requiredPermissions;
            expect(permissions).toContain('tc9_et__Minimum_Pay_Rate__c.Create');
            expect(permissions).toContain('tc9_et__Minimum_Pay_Rate__c.Edit');
            expect(permissions).toContain('tc9_et__Minimum_Pay_Rate__c.Read');
            expect(permissions).toContain('tc9_pr__Pay_Code__c.Read');
            expect(permissions).toContain('tc9_et__Award_Classifications_and_Levels__c.Read');
        });
    });

    describe('Template Dependencies', () => {
        it('should depend on award classifications template', () => {
            const step = minimumPayRateTemplate.etlSteps[0];
            expect(step.dependencies).toContain('awardClassificationsAndLevelsMaster');
        });
    });
});