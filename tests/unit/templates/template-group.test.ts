import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { templateGroupTemplate, templateGroupTemplateHooks } from '../../../src/lib/migration/templates/definitions/payroll/template-group.template';
import { Connection } from 'jsforce';

describe('Template Group Migration Template', () => {
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
            template: JSON.parse(JSON.stringify(templateGroupTemplate)), // Deep clone
            sessionId: 'test-session',
            userId: 'test-user',
            startTime: new Date(),
        };
    });

    describe('Template Structure', () => {
        it('should have correct template metadata', () => {
            expect(templateGroupTemplate.id).toBe('payroll-template-group');
            expect(templateGroupTemplate.name).toBe('Template Group');
            expect(templateGroupTemplate.category).toBe('payroll');
            expect(templateGroupTemplate.version).toBe('1.0.0');
        });

        it('should have exactly one ETL step', () => {
            expect(templateGroupTemplate.etlSteps).toHaveLength(1);
            expect(templateGroupTemplate.executionOrder).toHaveLength(1);
            expect(templateGroupTemplate.executionOrder[0]).toBe('templateGroupMaster');
        });

        it('should have metadata configuration', () => {
            expect(templateGroupTemplate.metadata).toBeDefined();
            expect(templateGroupTemplate.metadata.author).toBe('System');
            expect(templateGroupTemplate.metadata.complexity).toBe('simple');
            expect(templateGroupTemplate.metadata.estimatedDuration).toBe(15);
        });

        it('should have required permissions', () => {
            const permissions = templateGroupTemplate.metadata.requiredPermissions;
            expect(permissions).toContain('tc9_pr__Template_Group__c.Create');
            expect(permissions).toContain('tc9_pr__Template_Group__c.Edit');
            expect(permissions).toContain('tc9_pr__Template_Group__c.Read');
            expect(permissions).toContain('Account.Read');
        });
    });

    describe('ETL Step Configuration', () => {
        const step = templateGroupTemplate.etlSteps[0];

        it('should have correct extract configuration', () => {
            expect(step.extractConfig.objectApiName).toBe('tc9_pr__Template_Group__c');
            expect(step.extractConfig.batchSize).toBe(200);
            expect(step.extractConfig.soqlQuery).toContain('SELECT Id, Name, tc9_pr__Client__c');
            expect(step.extractConfig.soqlQuery).toContain('RecordTypeId');
            expect(step.extractConfig.soqlQuery).toContain('{externalIdField}');
        });

        it('should have all required field mappings', () => {
            const fieldMappings = step.transformConfig.fieldMappings;
            const mappedFields = fieldMappings.map(fm => fm.sourceField);
            
            expect(mappedFields).toContain('Id');
            expect(mappedFields).toContain('Name');
            expect(mappedFields).toContain('RecordTypeId');
            expect(mappedFields).toContain('OwnerId');
            
            // Check Id to external ID mapping
            const idMapping = fieldMappings.find(fm => fm.sourceField === 'Id');
            expect(idMapping?.targetField).toBe('{externalIdField}');
            expect(idMapping?.isRequired).toBe(true);
        });

        it('should have lookup mapping for Client', () => {
            const lookupMappings = step.transformConfig.lookupMappings;
            expect(lookupMappings).toHaveLength(1);
            
            const clientLookup = lookupMappings[0];
            expect(clientLookup.sourceField).toBe('tc9_pr__Client__c');
            expect(clientLookup.targetField).toBe('tc9_pr__Client__c');
            expect(clientLookup.lookupObject).toBe('Account');
            expect(clientLookup.allowNull).toBe(true);
            expect(clientLookup.crossEnvironmentMapping).toBe(true);
        });

        it('should have record type mapping', () => {
            const rtMapping = step.transformConfig.recordTypeMapping;
            expect(rtMapping).toBeDefined();
            expect(rtMapping?.mappingDictionary).toHaveProperty('Assignment_Rates');
            expect(rtMapping?.mappingDictionary).toHaveProperty('Employment_Cost');
            expect(rtMapping?.mappingDictionary).toHaveProperty('Interpretation_Rules');
            expect(rtMapping?.mappingDictionary).toHaveProperty('Invoice_Settings');
            expect(rtMapping?.mappingDictionary).toHaveProperty('Payee_Timesheet_Allowance');
            expect(rtMapping?.mappingDictionary).toHaveProperty('Rate_Calculator_Template');
        });

        it('should have correct load configuration', () => {
            expect(step.loadConfig.targetObject).toBe('tc9_pr__Template_Group__c');
            expect(step.loadConfig.operation).toBe('upsert');
            expect(step.loadConfig.externalIdField).toBe('{externalIdField}');
            expect(step.loadConfig.useBulkApi).toBe(true);
            expect(step.loadConfig.allowPartialSuccess).toBe(false);
        });

        it('should have retry configuration', () => {
            const retryConfig = step.loadConfig.retryConfig;
            expect(retryConfig.maxRetries).toBe(3);
            expect(retryConfig.retryWaitSeconds).toBe(5);
            expect(retryConfig.retryableErrors).toContain('UNABLE_TO_LOCK_ROW');
            expect(retryConfig.retryableErrors).toContain('REQUEST_LIMIT_EXCEEDED');
        });
    });

    describe('Validation Configuration', () => {
        const validationConfig = templateGroupTemplate.etlSteps[0].validationConfig;

        it('should have dependency check for Client', () => {
            const depChecks = validationConfig?.dependencyChecks || [];
            expect(depChecks).toHaveLength(1);
            
            const clientCheck = depChecks[0];
            expect(clientCheck.checkName).toBe('client-lookup');
            expect(clientCheck.sourceField).toBe('tc9_pr__Client__c');
            expect(clientCheck.targetObject).toBe('Account');
            expect(clientCheck.isRequired).toBe(false);
        });

        it('should have data integrity checks', () => {
            const integrityChecks = validationConfig?.dataIntegrityChecks || [];
            expect(integrityChecks.length).toBeGreaterThan(0);
            
            const checkNames = integrityChecks.map(check => check.checkName);
            expect(checkNames).toContain('name-required');
            expect(checkNames).toContain('external-id-check');
            expect(checkNames).toContain('duplicate-name-per-client');
        });

        it('should have pre-validation query for client accounts', () => {
            const preValidationQueries = validationConfig?.preValidationQueries || [];
            expect(preValidationQueries).toHaveLength(1);
            
            const clientQuery = preValidationQueries[0];
            expect(clientQuery.queryName).toBe('clientAccounts');
            expect(clientQuery.cacheKey).toBe('client-accounts');
            expect(clientQuery.soqlQuery).toContain('SELECT Id, Name');
            expect(clientQuery.soqlQuery).toContain('FROM Account');
        });
    });

    describe('Template Hooks', () => {
        it('should have all required hooks', () => {
            expect(templateGroupTemplateHooks.preMigration).toBeDefined();
            expect(templateGroupTemplateHooks.postExtract).toBeDefined();
            expect(templateGroupTemplateHooks.preLoad).toBeDefined();
            expect(templateGroupTemplateHooks.postMigration).toBeDefined();
        });

        describe('preMigration Hook', () => {
            it('should replace external ID placeholders', async () => {
                // Mock ExternalIdUtils
                jest.spyOn(console, 'log').mockImplementation(() => {});
                
                const result = await templateGroupTemplateHooks.preMigration(mockContext);
                
                expect(result.success).toBe(true);
                expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using external ID field'));
            });
        });

        describe('postExtract Hook', () => {
            it('should log extracted record count and record type distribution', async () => {
                const mockData = [
                    { Id: '1', Name: 'Test 1', RecordTypeId: 'RT001' },
                    { Id: '2', Name: 'Test 2', RecordTypeId: 'RT001' },
                    { Id: '3', Name: 'Test 3', RecordTypeId: 'RT002' },
                ];
                
                jest.spyOn(console, 'log').mockImplementation(() => {});
                
                const result = await templateGroupTemplateHooks.postExtract(mockData, mockContext);
                
                expect(result).toBe(mockData);
                expect(console.log).toHaveBeenCalledWith('Extracted 3 template groups');
                expect(console.log).toHaveBeenCalledWith('Record Type distribution:', expect.any(Object));
            });
        });

        describe('preLoad Hook', () => {
            it('should log client association statistics', async () => {
                const mockData = [
                    { Id: '1', Name: 'Test 1', tc9_pr__Client__c: 'ACC001' },
                    { Id: '2', Name: 'Test 2', tc9_pr__Client__c: null },
                    { Id: '3', Name: 'Test 3', tc9_pr__Client__c: 'ACC002' },
                ];
                
                jest.spyOn(console, 'log').mockImplementation(() => {});
                
                const result = await templateGroupTemplateHooks.preLoad(mockData, mockContext);
                
                expect(result).toBe(mockData);
                expect(console.log).toHaveBeenCalledWith('Preparing to load 3 template groups');
                expect(console.log).toHaveBeenCalledWith('2 template groups have client associations');
            });
        });

        describe('postMigration Hook', () => {
            it('should handle successful migration', async () => {
                const mockResults = {
                    status: 'success',
                    totalRecords: 10,
                    successfulRecords: 10,
                    failedRecords: 0
                };
                
                jest.spyOn(console, 'log').mockImplementation(() => {});
                
                const result = await templateGroupTemplateHooks.postMigration(mockResults, mockContext);
                
                expect(result.success).toBe(true);
                expect(console.log).toHaveBeenCalledWith('Template Group migration completed');
            });

            it('should warn about failed records', async () => {
                const mockResults = {
                    status: 'partial',
                    totalRecords: 10,
                    successfulRecords: 7,
                    failedRecords: 3
                };
                
                jest.spyOn(console, 'warn').mockImplementation(() => {});
                
                const result = await templateGroupTemplateHooks.postMigration(mockResults, mockContext);
                
                expect(result.success).toBe(true);
                expect(console.warn).toHaveBeenCalledWith('Failed to migrate 3 template groups');
            });
        });
    });
});