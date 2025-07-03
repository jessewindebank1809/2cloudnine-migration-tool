import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { awardClassificationsAndLevelsTemplate, awardClassificationsAndLevelsTemplateHooks } from '../../../src/lib/migration/templates/definitions/payroll/award-classifications-and-levels.template';
import { Connection } from 'jsforce';

describe('Award Classifications and Levels Migration Template', () => {
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
            template: JSON.parse(JSON.stringify(awardClassificationsAndLevelsTemplate)), // Deep clone
            sessionId: 'test-session',
            userId: 'test-user',
            startTime: new Date(),
        };
    });

    describe('Template Structure', () => {
        it('should have correct template metadata', () => {
            expect(awardClassificationsAndLevelsTemplate.id).toBe('payroll-award-classifications-and-levels');
            expect(awardClassificationsAndLevelsTemplate.name).toBe('Award Classifications and Levels');
            expect(awardClassificationsAndLevelsTemplate.category).toBe('payroll');
            expect(awardClassificationsAndLevelsTemplate.version).toBe('1.0.0');
            expect(awardClassificationsAndLevelsTemplate.description).toBe('Migrate award classifications and levels records with complete 1:1 field mapping');
        });

        it('should have exactly one ETL step', () => {
            expect(awardClassificationsAndLevelsTemplate.etlSteps).toHaveLength(1);
            expect(awardClassificationsAndLevelsTemplate.executionOrder).toHaveLength(1);
            expect(awardClassificationsAndLevelsTemplate.executionOrder[0]).toBe('awardClassificationsAndLevelsMaster');
        });

        it('should have metadata configuration', () => {
            expect(awardClassificationsAndLevelsTemplate.metadata).toBeDefined();
            expect(awardClassificationsAndLevelsTemplate.metadata.author).toBe('System');
            expect(awardClassificationsAndLevelsTemplate.metadata.complexity).toBe('simple');
            expect(awardClassificationsAndLevelsTemplate.metadata.estimatedDuration).toBe(5);
            expect(awardClassificationsAndLevelsTemplate.metadata.supportedApiVersions).toEqual(['59.0', '60.0', '61.0']);
        });
    });

    describe('ETL Step Configuration', () => {
        const step = awardClassificationsAndLevelsTemplate.etlSteps[0];

        it('should have correct step configuration', () => {
            expect(step.stepName).toBe('awardClassificationsAndLevelsMaster');
            expect(step.stepOrder).toBe(1);
            expect(step.dependencies).toEqual([]);
        });
    });

    describe('Extract Configuration', () => {
        const extractConfig = awardClassificationsAndLevelsTemplate.etlSteps[0].extractConfig;

        it('should have correct extract configuration', () => {
            expect(extractConfig.objectApiName).toBe('tc9_et__Award_Classifications_and_Levels__c');
            expect(extractConfig.batchSize).toBe(200);
        });

        it('should include all fields in SOQL query', () => {
            const query = extractConfig.soqlQuery;
            
            // Standard fields
            expect(query).toContain('Id');
            expect(query).toContain('Name');
            expect(query).toContain('OwnerId');
            expect(query).toContain('RecordTypeId');
            
            // Custom fields
            expect(query).toContain('tc9_et__Status__c');
            
            // External ID placeholder
            expect(query).toContain('{externalIdField}');
        });
    });

    describe('Transform Configuration', () => {
        const transformConfig = awardClassificationsAndLevelsTemplate.etlSteps[0].transformConfig;

        it('should have correct number of field mappings', () => {
            expect(transformConfig.fieldMappings).toHaveLength(5); // Id, Name, OwnerId, RecordTypeId, Status
        });

        it('should have no lookup mappings', () => {
            expect(transformConfig.lookupMappings).toEqual([]);
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
            expect(optionalFieldCount).toBe(3); // OwnerId, RecordTypeId, Status
        });

        it('should have 1:1 field mapping for all fields', () => {
            transformConfig.fieldMappings.forEach(mapping => {
                if (mapping.sourceField !== 'Id') {
                    expect(mapping.sourceField).toBe(mapping.targetField);
                }
            });
        });
    });

    describe('Load Configuration', () => {
        const loadConfig = awardClassificationsAndLevelsTemplate.etlSteps[0].loadConfig;

        it('should have correct load configuration', () => {
            expect(loadConfig.targetObject).toBe('tc9_et__Award_Classifications_and_Levels__c');
            expect(loadConfig.operation).toBe('upsert');
            expect(loadConfig.externalIdField).toBe('{externalIdField}');
            expect(loadConfig.useBulkApi).toBe(true);
            expect(loadConfig.batchSize).toBe(200);
            expect(loadConfig.allowPartialSuccess).toBe(false);
        });

        it('should have retry configuration', () => {
            expect(loadConfig.retryConfig).toBeDefined();
            expect(loadConfig.retryConfig?.maxRetries).toBe(3);
            expect(loadConfig.retryConfig?.retryWaitSeconds).toBe(5);
            expect(loadConfig.retryConfig?.retryableErrors).toEqual(['UNABLE_TO_LOCK_ROW', 'REQUEST_LIMIT_EXCEEDED']);
        });
    });

    describe('Validation Configuration', () => {
        const validationConfig = awardClassificationsAndLevelsTemplate.etlSteps[0].validationConfig;

        it('should have no dependency checks', () => {
            expect(validationConfig?.dependencyChecks).toEqual([]);
        });

        it('should have data integrity checks', () => {
            expect(validationConfig?.dataIntegrityChecks).toHaveLength(2);
            
            const nameCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'name-required');
            expect(nameCheck).toBeDefined();
            expect(nameCheck?.severity).toBe('error');
            
            const externalIdCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'external-id-check');
            expect(externalIdCheck).toBeDefined();
            expect(externalIdCheck?.severity).toBe('warning');
        });

        it('should have picklist validation checks', () => {
            expect(validationConfig?.picklistValidationChecks).toHaveLength(1);
            
            const statusPicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'status-picklist');
            expect(statusPicklist).toBeDefined();
            expect(statusPicklist?.fieldName).toBe('tc9_et__Status__c');
            expect(statusPicklist?.severity).toBe('warning');
        });
    });

    describe('Template Hooks', () => {
        it('should export template hooks', () => {
            expect(awardClassificationsAndLevelsTemplateHooks).toBeDefined();
            expect(typeof awardClassificationsAndLevelsTemplateHooks.preMigration).toBe('function');
            expect(typeof awardClassificationsAndLevelsTemplateHooks.postExtract).toBe('function');
            expect(typeof awardClassificationsAndLevelsTemplateHooks.preLoad).toBe('function');
            expect(typeof awardClassificationsAndLevelsTemplateHooks.postMigration).toBe('function');
        });

        it('should replace external ID placeholders in preMigration hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            
            const result = await awardClassificationsAndLevelsTemplateHooks.preMigration(mockContext);
            
            expect(result).toEqual({ success: true });
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using external ID field:'));
        });

        it('should log extraction count in postExtract hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            const testData = new Array(5).fill({ Id: 'test' });
            
            const result = await awardClassificationsAndLevelsTemplateHooks.postExtract(testData, mockContext);
            
            expect(result).toBe(testData);
            expect(console.log).toHaveBeenCalledWith('Extracted 5 award classification records');
        });

        it('should log load preparation in preLoad hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            const testData = new Array(3).fill({ Id: 'test' });
            
            const result = await awardClassificationsAndLevelsTemplateHooks.preLoad(testData, mockContext);
            
            expect(result).toBe(testData);
            expect(console.log).toHaveBeenCalledWith('Preparing to load 3 award classification records');
        });

        it('should log completion in postMigration hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            
            const result = await awardClassificationsAndLevelsTemplateHooks.postMigration({}, mockContext);
            
            expect(result).toEqual({ success: true });
            expect(console.log).toHaveBeenCalledWith('Award classifications migration completed');
        });
    });

    describe('Required Permissions', () => {
        it('should have required permissions', () => {
            const permissions = awardClassificationsAndLevelsTemplate.metadata.requiredPermissions;
            expect(permissions).toContain('tc9_et__Award_Classifications_and_Levels__c.Create');
            expect(permissions).toContain('tc9_et__Award_Classifications_and_Levels__c.Edit');
            expect(permissions).toContain('tc9_et__Award_Classifications_and_Levels__c.Read');
        });
    });
});