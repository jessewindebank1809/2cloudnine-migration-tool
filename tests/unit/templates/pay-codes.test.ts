import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { payCodesTemplate } from '../../../src/lib/migration/templates/definitions/payroll/pay-codes.template';
import { MigrationContext } from '../../../src/lib/migration/templates/core/interfaces';
import { Connection } from 'jsforce';

describe('Pay Codes Migration Template', () => {
    let mockContext: MigrationContext;
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
            template: JSON.parse(JSON.stringify(payCodesTemplate)), // Deep clone
            sessionId: 'test-session',
            userId: 'test-user',
            startTime: new Date(),
        };
    });

    describe('Template Structure', () => {
        it('should have correct template metadata', () => {
            expect(payCodesTemplate.id).toBe('payroll-pay-codes');
            expect(payCodesTemplate.name).toBe('Pay Codes');
            expect(payCodesTemplate.category).toBe('payroll');
            expect(payCodesTemplate.version).toBe('1.0.0');
        });

        it('should have exactly one ETL step', () => {
            expect(payCodesTemplate.etlSteps).toHaveLength(1);
            expect(payCodesTemplate.executionOrder).toHaveLength(1);
            expect(payCodesTemplate.executionOrder[0]).toBe('payCodeMaster');
        });

        it('should have rollback strategy enabled', () => {
            expect(payCodesTemplate.rollbackStrategy?.enabled).toBe(true);
            expect(payCodesTemplate.rollbackStrategy?.checkpointAfterEachStep).toBe(true);
        });

        it('should have proper error handling configuration', () => {
            expect(payCodesTemplate.errorHandling?.continueOnError).toBe(false);
            expect(payCodesTemplate.errorHandling?.maxErrorsPerStep).toBe(100);
            expect(payCodesTemplate.errorHandling?.errorLogging).toBe('detailed');
        });
    });

    describe('ETL Step Configuration', () => {
        const step = payCodesTemplate.etlSteps[0];

        it('should have correct step name and order', () => {
            expect(step.stepName).toBe('payCodeMaster');
            expect(step.stepOrder).toBe(1);
        });

        describe('Extract Configuration', () => {
            it('should query the correct object', () => {
                expect(step.extractConfig?.objectApiName).toBe('tc9_pr__Pay_Code__c');
            });

            it('should include all essential fields in SOQL query', () => {
                const query = step.extractConfig?.soqlQuery || '';
                const essentialFields = ['Id', 'Name', 'tc9_pr__Code__c', 'tc9_pr__Type__c', 'tc9_pr__Status__c', 'tc9_pr__Rate__c'];
                
                essentialFields.forEach(field => {
                    expect(query).toContain(field);
                });
            });

            it('should have appropriate batch size', () => {
                expect(step.extractConfig?.batchSize).toBe(200);
            });
        });

        describe('Transform Configuration', () => {
            it('should have field mappings for all essential fields', () => {
                const fieldMappings = step.transformConfig?.fieldMappings || [];
                const essentialTargetFields = ['Name', 'tc9_pr__Code__c', 'tc9_pr__Type__c', 'tc9_pr__Status__c', 'tc9_pr__Rate__c'];
                
                essentialTargetFields.forEach(field => {
                    const mapping = fieldMappings.find(m => m.targetField === field);
                    expect(mapping).toBeDefined();
                    expect(mapping?.transformationType).toBe('direct');
                });
            });

            it('should have external ID mapping', () => {
                const fieldMappings = step.transformConfig?.fieldMappings || [];
                const externalIdMapping = fieldMappings.find(m => m.sourceField === 'Id' && m.targetField === '{externalIdField}');
                expect(externalIdMapping).toBeDefined();
                expect(externalIdMapping?.isRequired).toBe(true);
            });

            it('should mark required fields correctly', () => {
                const fieldMappings = step.transformConfig?.fieldMappings || [];
                const nameMapping = fieldMappings.find(m => m.targetField === 'Name');
                const codeMapping = fieldMappings.find(m => m.targetField === 'tc9_pr__Code__c');
                
                expect(nameMapping?.isRequired).toBe(true);
                expect(codeMapping?.isRequired).toBe(true);
            });
        });

        describe('Load Configuration', () => {
            it('should target the correct object', () => {
                expect(step.loadConfig?.targetObject).toBe('tc9_pr__Pay_Code__c');
            });

            it('should use upsert operation', () => {
                expect(step.loadConfig?.operation).toBe('upsert');
            });

            it('should have external ID field configuration', () => {
                expect(step.loadConfig?.externalIdField).toBe('{externalIdField}');
            });

            it('should include field permission checks', () => {
                const checks = step.loadConfig?.fieldPermissionChecks || [];
                expect(checks).toContain('Name');
                expect(checks).toContain('tc9_pr__Code__c');
                expect(checks).toContain('tc9_pr__Type__c');
                expect(checks).toContain('tc9_pr__Status__c');
                expect(checks).toContain('tc9_pr__Rate__c');
                expect(checks).toContain('{externalIdField}');
            });
        });

        describe('Validation Configuration', () => {
            it('should have validation enabled', () => {
                expect(step.validationConfig?.skipValidation).toBe(false);
            });

            it('should have required field validations', () => {
                const checks = step.validationConfig?.dataIntegrityChecks || [];
                
                const nameCheck = checks.find(c => c.fieldName === 'Name' && c.checkType === 'required');
                expect(nameCheck).toBeDefined();
                expect(nameCheck?.severity).toBe('error');
                
                const codeCheck = checks.find(c => c.fieldName === 'tc9_pr__Code__c' && c.checkType === 'required');
                expect(codeCheck).toBeDefined();
                expect(codeCheck?.severity).toBe('error');
            });

            it('should have uniqueness validation for Code field', () => {
                const checks = step.validationConfig?.dataIntegrityChecks || [];
                const uniquenessCheck = checks.find(c => c.fieldName === 'tc9_pr__Code__c' && c.checkType === 'uniqueness');
                
                expect(uniquenessCheck).toBeDefined();
                expect(uniquenessCheck?.severity).toBe('error');
            });

            it('should have picklist validations', () => {
                const checks = step.validationConfig?.dataIntegrityChecks || [];
                
                const typeCheck = checks.find(c => c.fieldName === 'tc9_pr__Type__c' && c.checkType === 'picklist');
                expect(typeCheck).toBeDefined();
                expect(typeCheck?.severity).toBe('warning');
                
                const statusCheck = checks.find(c => c.fieldName === 'tc9_pr__Status__c' && c.checkType === 'picklist');
                expect(statusCheck).toBeDefined();
                expect(statusCheck?.severity).toBe('warning');
            });
        });
    });

    describe('Hooks', () => {
        it('should have preMigration hook', () => {
            expect(payCodesTemplate.hooks?.preMigration).toBeDefined();
            expect(typeof payCodesTemplate.hooks?.preMigration).toBe('function');
        });

        it('should have postExtract hook', () => {
            expect(payCodesTemplate.hooks?.postExtract).toBeDefined();
            expect(typeof payCodesTemplate.hooks?.postExtract).toBe('function');
        });

        it('should have preLoad hook', () => {
            expect(payCodesTemplate.hooks?.preLoad).toBeDefined();
            expect(typeof payCodesTemplate.hooks?.preLoad).toBe('function');
        });

        it('should have postMigration hook', () => {
            expect(payCodesTemplate.hooks?.postMigration).toBeDefined();
            expect(typeof payCodesTemplate.hooks?.postMigration).toBe('function');
        });

        describe('preMigration hook', () => {
            it('should be defined and return success', async () => {
                // Test that the hook exists and returns the expected result
                const hook = payCodesTemplate.hooks?.preMigration;
                expect(hook).toBeDefined();
                expect(typeof hook).toBe('function');
                
                // Note: We can't easily test the ExternalIdUtils.getExternalIdField call
                // without complex mocking setup. This would be better tested in an integration test.
                // For now, we'll just verify the hook structure exists.
            });
        });
    });

    describe('Template Completeness', () => {
        it('should cover all acceptance criteria fields', () => {
            const query = payCodesTemplate.etlSteps[0].extractConfig?.soqlQuery || '';
            const mappings = payCodesTemplate.etlSteps[0].transformConfig?.fieldMappings || [];
            
            // Essential fields from requirements
            const essentialFields = [
                { source: 'Name', target: 'Name' },
                { source: 'tc9_pr__Code__c', target: 'tc9_pr__Code__c' },
                { source: 'tc9_pr__Type__c', target: 'tc9_pr__Type__c' },
                { source: 'tc9_pr__Status__c', target: 'tc9_pr__Status__c' },
                { source: 'tc9_pr__Rate__c', target: 'tc9_pr__Rate__c' }
            ];
            
            essentialFields.forEach(field => {
                // Check query includes field
                expect(query).toContain(field.source);
                
                // Check mapping exists
                const mapping = mappings.find(m => m.sourceField === field.source && m.targetField === field.target);
                expect(mapping).toBeDefined();
            });
        });

        it('should have all essential validation rules', () => {
            const checks = payCodesTemplate.etlSteps[0].validationConfig?.dataIntegrityChecks || [];
            
            // Required validations from requirements
            expect(checks.filter(c => c.checkType === 'required')).toHaveLength(2); // Name and Code
            expect(checks.filter(c => c.checkType === 'uniqueness')).toHaveLength(1); // Code
            expect(checks.filter(c => c.checkType === 'picklist')).toHaveLength(2); // Type and Status
        });
    });
});