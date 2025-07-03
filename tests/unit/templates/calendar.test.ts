import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { calendarTemplate, calendarTemplateHooks } from '../../../src/lib/migration/templates/definitions/payroll/calendar.template';
import { Connection } from 'jsforce';

describe('Calendar Migration Template', () => {
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
            template: JSON.parse(JSON.stringify(calendarTemplate)), // Deep clone
            sessionId: 'test-session',
            userId: 'test-user',
            startTime: new Date(),
        };
    });

    describe('Template Structure', () => {
        it('should have correct template metadata', () => {
            expect(calendarTemplate.id).toBe('payroll-calendar');
            expect(calendarTemplate.name).toBe('Calendar');
            expect(calendarTemplate.category).toBe('payroll');
            expect(calendarTemplate.version).toBe('1.0.0');
            expect(calendarTemplate.description).toBe('Migrate calendar records with complete 1:1 field mapping and no transformation');
        });

        it('should have exactly one ETL step', () => {
            expect(calendarTemplate.etlSteps).toHaveLength(1);
            expect(calendarTemplate.executionOrder).toHaveLength(1);
            expect(calendarTemplate.executionOrder[0]).toBe('calendarMaster');
        });

        it('should have metadata configuration', () => {
            expect(calendarTemplate.metadata).toBeDefined();
            expect(calendarTemplate.metadata.author).toBe('System');
            expect(calendarTemplate.metadata.complexity).toBe('simple');
            expect(calendarTemplate.metadata.estimatedDuration).toBe(15);
            expect(calendarTemplate.metadata.supportedApiVersions).toEqual(['59.0', '60.0', '61.0']);
            expect(calendarTemplate.metadata.requiredPermissions).toContain('tc9_pr__Calendar__c.Create');
            expect(calendarTemplate.metadata.requiredPermissions).toContain('tc9_pr__Calendar__c.Edit');
            expect(calendarTemplate.metadata.requiredPermissions).toContain('tc9_pr__Calendar__c.Read');
        });
    });

    describe('ETL Step Configuration', () => {
        const step = calendarTemplate.etlSteps[0];

        it('should have correct step configuration', () => {
            expect(step.stepName).toBe('calendarMaster');
            expect(step.stepOrder).toBe(1);
            expect(step.dependencies).toEqual([]);
        });
    });

    describe('Extract Configuration', () => {
        const extractConfig = calendarTemplate.etlSteps[0].extractConfig;

        it('should have correct extract configuration', () => {
            expect(extractConfig.objectApiName).toBe('tc9_pr__Calendar__c');
            expect(extractConfig.batchSize).toBe(200);
        });

        it('should include all calendar fields in SOQL query', () => {
            const query = extractConfig.soqlQuery;
            
            // Standard fields
            expect(query).toContain('Id');
            expect(query).toContain('Name');
            expect(query).toContain('OwnerId');
            expect(query).toContain('RecordTypeId');
            
            // Core calendar fields
            expect(query).toContain('tc9_pr__Description__c');
            expect(query).toContain('tc9_pr__Type__c');
            expect(query).toContain('tc9_pr__Is_Public_Holiday__c');
            expect(query).toContain('tc9_pr__Allow_Changes_To_Pay_Code__c');
            expect(query).toContain('tc9_pr__Is_Payroll__c');
            
            // Location fields
            expect(query).toContain('tc9_pr__Country__c');
            expect(query).toContain('tc9_pr__State_Province__c');
            expect(query).toContain('tc9_pr__City__c');
            
            // Date fields
            expect(query).toContain('tc9_pr__Public_Holiday_Date__c');
            expect(query).toContain('tc9_pr__Start_Date__c');
            expect(query).toContain('tc9_pr__End_Date__c');
            
            // Other fields
            expect(query).toContain('tc9_pr__Display_Image_URL__c');
            expect(query).toContain('tc9_pr__Number_of_Calendar_Periods__c');
            expect(query).toContain('tc9_pr__External_Id__c');
            expect(query).toContain('tc9_pr__Display_Text__c');
            expect(query).toContain('tc9_pr__Payroll_Multiplier__c');
            expect(query).toContain('tc9_pr__Deduct_from_Accrual__c');
            
            // External ID placeholder
            expect(query).toContain('{externalIdField}');
        });

        it('should include all 10 display text and image URL fields', () => {
            const query = extractConfig.soqlQuery;
            
            for (let i = 2; i <= 10; i++) {
                expect(query).toContain(`tc9_pr__Display_Text_${i}__c`);
                expect(query).toContain(`tc9_pr__Display_Image_URL_${i}__c`);
            }
        });
    });

    describe('Transform Configuration', () => {
        const transformConfig = calendarTemplate.etlSteps[0].transformConfig;

        it('should have correct number of field mappings', () => {
            // 1 external ID + 1 Name + 2 standard fields + 35 custom fields = 39 total
            expect(transformConfig.fieldMappings).toHaveLength(39);
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
            const typeMapping = transformConfig.fieldMappings.find(m => m.sourceField === 'tc9_pr__Type__c');
            const externalIdMapping = transformConfig.fieldMappings.find(m => m.sourceField === 'Id');
            
            expect(nameMapping?.isRequired).toBe(true);
            expect(typeMapping?.isRequired).toBe(true);
            expect(externalIdMapping?.isRequired).toBe(true);
            
            // All other fields should be optional
            const optionalFieldCount = transformConfig.fieldMappings.filter(m => !m.isRequired).length;
            expect(optionalFieldCount).toBe(36); // 39 total - 3 required = 36 optional
        });

        it('should have 1:1 field mapping for all fields', () => {
            // Verify each field maps to itself (except external ID)
            transformConfig.fieldMappings.forEach(mapping => {
                if (mapping.sourceField !== 'Id') {
                    expect(mapping.sourceField).toBe(mapping.targetField);
                }
            });
        });
    });

    describe('Load Configuration', () => {
        const loadConfig = calendarTemplate.etlSteps[0].loadConfig;

        it('should have correct load configuration', () => {
            expect(loadConfig.targetObject).toBe('tc9_pr__Calendar__c');
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
        const validationConfig = calendarTemplate.etlSteps[0].validationConfig;

        it('should have no dependency checks', () => {
            expect(validationConfig?.dependencyChecks).toEqual([]);
        });

        it('should have data integrity checks', () => {
            expect(validationConfig?.dataIntegrityChecks).toHaveLength(4);
            
            const nameCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'name-required');
            expect(nameCheck).toBeDefined();
            expect(nameCheck?.severity).toBe('error');
            
            const typeCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'type-required');
            expect(typeCheck).toBeDefined();
            expect(typeCheck?.severity).toBe('error');
            
            const externalIdCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'external-id-check');
            expect(externalIdCheck).toBeDefined();
            expect(externalIdCheck?.severity).toBe('warning');
            
            const dateRangeCheck = validationConfig?.dataIntegrityChecks?.find(c => c.checkName === 'date-range-validation');
            expect(dateRangeCheck).toBeDefined();
            expect(dateRangeCheck?.severity).toBe('error');
        });

        it('should have picklist validation checks', () => {
            expect(validationConfig?.picklistValidationChecks).toHaveLength(3);
            
            const typePicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'type-picklist');
            expect(typePicklist).toBeDefined();
            expect(typePicklist?.fieldName).toBe('tc9_pr__Type__c');
            expect(typePicklist?.severity).toBe('error');
            
            const countryPicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'country-picklist');
            expect(countryPicklist).toBeDefined();
            expect(countryPicklist?.fieldName).toBe('tc9_pr__Country__c');
            expect(countryPicklist?.severity).toBe('warning');
            
            const statePicklist = validationConfig?.picklistValidationChecks?.find(c => c.checkName === 'state-province-picklist');
            expect(statePicklist).toBeDefined();
            expect(statePicklist?.fieldName).toBe('tc9_pr__State_Province__c');
            expect(statePicklist?.severity).toBe('warning');
        });
    });

    describe('Template Hooks', () => {
        it('should export template hooks', () => {
            expect(calendarTemplateHooks).toBeDefined();
            expect(typeof calendarTemplateHooks.preMigration).toBe('function');
            expect(typeof calendarTemplateHooks.postExtract).toBe('function');
            expect(typeof calendarTemplateHooks.preLoad).toBe('function');
            expect(typeof calendarTemplateHooks.postMigration).toBe('function');
        });

        it('should replace external ID placeholders in preMigration hook', async () => {
            // Mock the ExternalIdUtils response
            jest.spyOn(console, 'log').mockImplementation(() => {});
            
            const result = await calendarTemplateHooks.preMigration(mockContext);
            
            expect(result).toEqual({ success: true });
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using external ID field:'));
        });

        it('should log extraction count in postExtract hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            const testData = new Array(5).fill({ Id: 'test' });
            
            const result = await calendarTemplateHooks.postExtract(testData, mockContext);
            
            expect(result).toBe(testData);
            expect(console.log).toHaveBeenCalledWith('Extracted 5 calendar records');
        });

        it('should log load preparation in preLoad hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            const testData = new Array(3).fill({ Id: 'test' });
            
            const result = await calendarTemplateHooks.preLoad(testData, mockContext);
            
            expect(result).toBe(testData);
            expect(console.log).toHaveBeenCalledWith('Preparing to load 3 calendar records');
        });

        it('should log completion in postMigration hook', async () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            
            const result = await calendarTemplateHooks.postMigration({}, mockContext);
            
            expect(result).toEqual({ success: true });
            expect(console.log).toHaveBeenCalledWith('Calendar migration completed');
        });
    });

    describe('Template Completeness', () => {
        it('should have all display text and image URL pairs mapped', () => {
            const fieldMappings = calendarTemplate.etlSteps[0].transformConfig.fieldMappings;
            
            // Check main display fields
            expect(fieldMappings.find(m => m.sourceField === 'tc9_pr__Display_Text__c')).toBeDefined();
            expect(fieldMappings.find(m => m.sourceField === 'tc9_pr__Display_Image_URL__c')).toBeDefined();
            
            // Check all numbered pairs
            for (let i = 2; i <= 10; i++) {
                expect(fieldMappings.find(m => m.sourceField === `tc9_pr__Display_Text_${i}__c`)).toBeDefined();
                expect(fieldMappings.find(m => m.sourceField === `tc9_pr__Display_Image_URL_${i}__c`)).toBeDefined();
            }
        });

        it('should validate field count matches between SOQL and mappings', () => {
            const soqlQuery = calendarTemplate.etlSteps[0].extractConfig.soqlQuery;
            const fieldMappings = calendarTemplate.etlSteps[0].transformConfig.fieldMappings;
            
            // Count fields in SOQL (excluding FROM clause)
            const soqlFields = soqlQuery.split('FROM')[0].split(',').map(f => f.trim());
            
            // All mapped fields should be in SOQL (except those that are calculated/system fields)
            const systemFields = ['CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById', 
                                  'SystemModstamp', 'LastActivityDate', 'LastViewedDate', 'LastReferencedDate'];
            
            fieldMappings.forEach(mapping => {
                if (mapping.sourceField !== 'Id' && !systemFields.includes(mapping.sourceField)) {
                    const fieldInQuery = soqlFields.some(f => f.includes(mapping.sourceField));
                    expect(fieldInQuery).toBe(true);
                }
            });
        });
    });
});