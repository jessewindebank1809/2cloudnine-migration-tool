import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { projectCodeTemplate, projectCodeTemplateHooks } from '../../../src/lib/migration/templates/definitions/payroll/project-code.template';
import { ExternalIdUtils } from '../../../src/lib/migration/templates/utils/external-id-utils';

jest.mock('../../../src/lib/migration/templates/utils/external-id-utils');

describe('Project Code Template', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Template Structure', () => {
        it('should have required template properties', () => {
            expect(projectCodeTemplate.id).toBe('payroll-project-code');
            expect(projectCodeTemplate.name).toBe('Project Code');
            expect(projectCodeTemplate.category).toBe('payroll');
            expect(projectCodeTemplate.version).toBe('1.0.0');
            expect(projectCodeTemplate.etlSteps).toHaveLength(1);
        });

        it('should have correct ETL step configuration', () => {
            const step = projectCodeTemplate.etlSteps[0];
            expect(step.stepName).toBe('projectCodeMaster');
            expect(step.extractConfig.objectApiName).toBe('tc9_pr__Project_Code__c');
            expect(step.loadConfig.targetObject).toBe('tc9_pr__Project_Code__c');
            expect(step.loadConfig.operation).toBe('upsert');
        });

        it('should include all required fields in SOQL query', () => {
            const soqlQuery = projectCodeTemplate.etlSteps[0].extractConfig.soqlQuery;
            const requiredFields = [
                'Id', 'Name', 'OwnerId', 'tc9_pr__Account__c', 
                'tc9_pr__Code__c', 'tc9_pr__Description__c',
                'tc9_pr__Is_Activity__c', 'tc9_pr__Is_Charge_Against_Award_Budget__c',
                'tc9_pr__Is_Default__c', 'tc9_pr__Levy_Type__c',
                'tc9_pr__Pay_Type__c', 'tc9_pr__Time_Budget__c',
                'tc9_pr__Type__c', 'tc9_pr__External_ID__c'
            ];
            
            requiredFields.forEach(field => {
                expect(soqlQuery).toContain(field);
            });
        });
    });

    describe('Field Mappings', () => {
        it('should have correct number of field mappings', () => {
            const fieldMappings = projectCodeTemplate.etlSteps[0].transformConfig.fieldMappings;
            expect(fieldMappings).toHaveLength(14); // 14 direct field mappings
        });

        it('should have required fields marked correctly', () => {
            const fieldMappings = projectCodeTemplate.etlSteps[0].transformConfig.fieldMappings;
            const requiredFields = ['Id', 'Name', 'OwnerId', 'tc9_pr__Code__c'];
            
            requiredFields.forEach(field => {
                const mapping = fieldMappings.find(m => m.sourceField === field);
                expect(mapping?.isRequired).toBe(true);
            });
        });

        it('should have all mappings as direct transformation', () => {
            const fieldMappings = projectCodeTemplate.etlSteps[0].transformConfig.fieldMappings;
            fieldMappings.forEach(mapping => {
                expect(mapping.transformationType).toBe('direct');
            });
        });
    });

    describe('Lookup Mappings', () => {
        it('should have Account lookup mapping', () => {
            const lookupMappings = projectCodeTemplate.etlSteps[0].transformConfig.lookupMappings;
            expect(lookupMappings).toHaveLength(1);
            
            const accountMapping = lookupMappings[0];
            expect(accountMapping.sourceField).toBe('tc9_pr__Account__c');
            expect(accountMapping.lookupObject).toBe('Account');
            expect(accountMapping.lookupField).toBe('Id');
            expect(accountMapping.isRequired).toBe(false);
        });
    });

    describe('Validation Configuration', () => {
        it('should have required data integrity checks', () => {
            const checks = projectCodeTemplate.etlSteps[0].validationConfig.dataIntegrityChecks;
            expect(checks).toHaveLength(5);
            
            const checkNames = checks.map(c => c.checkName);
            expect(checkNames).toContain('name-required');
            expect(checkNames).toContain('code-required');
            expect(checkNames).toContain('unique-code');
            expect(checkNames).toContain('external-id-check');
            expect(checkNames).toContain('account-reference-valid');
        });

        it('should have picklist validation checks', () => {
            const picklistChecks = projectCodeTemplate.etlSteps[0].validationConfig.picklistValidationChecks;
            expect(picklistChecks).toHaveLength(3);
            
            const checkNames = picklistChecks.map(c => c.checkName);
            expect(checkNames).toContain('levy-type-picklist');
            expect(checkNames).toContain('pay-type-picklist');
            expect(checkNames).toContain('type-picklist');
        });

        it('should have correct severity levels for checks', () => {
            const checks = projectCodeTemplate.etlSteps[0].validationConfig.dataIntegrityChecks;
            
            const nameCheck = checks.find(c => c.checkName === 'name-required');
            expect(nameCheck?.severity).toBe('error');
            
            const externalIdCheck = checks.find(c => c.checkName === 'external-id-check');
            expect(externalIdCheck?.severity).toBe('warning');
        });
    });

    describe('Template Hooks', () => {
        const mockContext = {
            targetOrgConnection: {},
            template: {
                etlSteps: [{
                    extractConfig: {
                        soqlQuery: 'SELECT Id, {externalIdField} FROM tc9_pr__Project_Code__c'
                    },
                    transformConfig: {
                        fieldMappings: [{
                            sourceField: 'Id',
                            targetField: '{externalIdField}'
                        }],
                        lookupMappings: [{
                            lookupExternalIdField: '{accountExternalIdField}'
                        }]
                    },
                    loadConfig: {
                        externalIdField: '{externalIdField}'
                    },
                    validationConfig: {
                        dataIntegrityChecks: [{
                            validationQuery: 'SELECT Id WHERE {externalIdField} = null'
                        }]
                    }
                }]
            }
        };

        beforeEach(() => {
            (ExternalIdUtils.getExternalIdField as jest.Mock).mockImplementation((conn, objectName) => {
                if (objectName === 'tc9_pr__Project_Code__c') {
                    return Promise.resolve('tc9_edc__External_ID_Data_Creation__c');
                } else if (objectName === 'Account') {
                    return Promise.resolve('External_ID__c');
                }
                return Promise.resolve('Id');
            });
        });

        it('should replace external ID placeholders in preMigration hook', async () => {
            await projectCodeTemplateHooks.preMigration(mockContext);
            
            const step = mockContext.template.etlSteps[0];
            expect(step.extractConfig.soqlQuery).toContain('tc9_edc__External_ID_Data_Creation__c');
            expect(step.extractConfig.soqlQuery).not.toContain('{externalIdField}');
            expect(step.loadConfig.externalIdField).toBe('tc9_edc__External_ID_Data_Creation__c');
            expect(step.transformConfig.lookupMappings[0].lookupExternalIdField).toBe('External_ID__c');
        });

        it('should call ExternalIdUtils for both Project Code and Account', async () => {
            await projectCodeTemplateHooks.preMigration(mockContext);
            
            expect(ExternalIdUtils.getExternalIdField).toHaveBeenCalledWith(
                mockContext.targetOrgConnection,
                'tc9_pr__Project_Code__c'
            );
            expect(ExternalIdUtils.getExternalIdField).toHaveBeenCalledWith(
                mockContext.targetOrgConnection,
                'Account'
            );
        });

        it('should log extraction count in postExtract hook', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const mockData = new Array(25).fill({});
            
            await projectCodeTemplateHooks.postExtract(mockData, {});
            
            expect(consoleSpy).toHaveBeenCalledWith('Extracted 25 project codes');
            consoleSpy.mockRestore();
        });

        it('should log load preparation in preLoad hook', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const mockData = new Array(30).fill({});
            
            await projectCodeTemplateHooks.preLoad(mockData, {});
            
            expect(consoleSpy).toHaveBeenCalledWith('Preparing to load 30 project codes');
            consoleSpy.mockRestore();
        });

        it('should return success in postMigration hook', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const result = await projectCodeTemplateHooks.postMigration({}, {});
            
            expect(result).toEqual({ success: true });
            expect(consoleSpy).toHaveBeenCalledWith('Project Code migration completed');
            consoleSpy.mockRestore();
        });
    });

    describe('Metadata', () => {
        it('should have correct metadata properties', () => {
            const metadata = projectCodeTemplate.metadata;
            
            expect(metadata.author).toBe('System');
            expect(metadata.supportedApiVersions).toEqual(['59.0', '60.0', '61.0']);
            expect(metadata.requiredPermissions).toContain('tc9_pr__Project_Code__c.Create');
            expect(metadata.requiredPermissions).toContain('tc9_pr__Project_Code__c.Edit');
            expect(metadata.estimatedDuration).toBe(15);
            expect(metadata.complexity).toBe('medium');
        });
    });
});