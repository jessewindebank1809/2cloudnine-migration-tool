import { ValidationEngine } from '@/lib/migration/templates/core/validation-engine';
import { SalesforceClient } from '@/lib/salesforce/client';
import { sessionManager } from '@/lib/salesforce/session-manager';
import {
    PicklistValidationCheck,
    PicklistFieldMetadata,
    ValidationResult,
    MigrationTemplate,
    ETLStep
} from '@/lib/migration/templates/core/interfaces';

// Mock dependencies
jest.mock('@/lib/salesforce/session-manager');
jest.mock('@/lib/salesforce/client');

describe('Picklist Validation', () => {
    let validationEngine: ValidationEngine;
    let mockSourceClient: jest.Mocked<SalesforceClient>;
    let mockTargetClient: jest.Mocked<SalesforceClient>;

    beforeEach(() => {
        validationEngine = new ValidationEngine();
        
        // Mock SalesforceClient instances
        mockSourceClient = {
            getPicklistValues: jest.fn(),
            query: jest.fn(),
        } as any;
        
        mockTargetClient = {
            getPicklistValues: jest.fn(),
            query: jest.fn(),
        } as any;

        // Mock sessionManager
        (sessionManager.getClient as jest.Mock).mockImplementation((orgId: string) => {
            return orgId === 'source-org' ? mockSourceClient : mockTargetClient;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        validationEngine.clearCache();
    });

    describe('SalesforceClient.getPicklistValues', () => {
        it('should successfully fetch picklist values for valid field', async () => {
            const mockPicklistData = {
                fieldName: 'tc9_et__Variation_Type__c',
                values: [
                    { value: 'Standard', label: 'Standard', active: true },
                    { value: 'Premium', label: 'Premium', active: true },
                    { value: 'Basic', label: 'Basic', active: false }
                ],
                restricted: true,
                defaultValue: 'Standard'
            };

            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: true,
                data: mockPicklistData
            });

            const result = await mockTargetClient.getPicklistValues(
                'tc9_et__Interpretation_Breakpoint__c',
                'tc9_et__Variation_Type__c'
            );

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockPicklistData);
            expect(result.data?.values).toHaveLength(3);
            expect(result.data?.restricted).toBe(true);
        });

        it('should handle field not found error', async () => {
            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: false,
                error: 'Field NonExistent__c not found on object tc9_et__Interpretation_Breakpoint__c'
            });

            const result = await mockTargetClient.getPicklistValues(
                'tc9_et__Interpretation_Breakpoint__c',
                'NonExistent__c'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Field NonExistent__c not found');
        });

        it('should handle non-picklist field error', async () => {
            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: false,
                error: 'Field Name is not a picklist field (type: string)'
            });

            const result = await mockTargetClient.getPicklistValues(
                'tc9_et__Interpretation_Breakpoint__c',
                'Name'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('is not a picklist field');
        });
    });

    describe('ValidationEngine.runPicklistValidationChecks - PASS Cases', () => {
        it('should pass validation when all picklist values are valid', async () => {
            // Setup: Target org has valid picklist values
            const mockPicklistData = {
                fieldName: 'tc9_et__Variation_Type__c',
                values: [
                    { value: 'Standard', label: 'Standard', active: true },
                    { value: 'Premium', label: 'Premium', active: true },
                    { value: 'Basic', label: 'Basic', active: true }
                ],
                restricted: true,
                defaultValue: undefined
            };

            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: true,
                data: mockPicklistData
            });

            // Source data with valid picklist values
            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: 'Standard' },
                { Id: 'rec2', Name: 'Test Record 2', tc9_et__Variation_Type__c: 'Premium' },
                { Id: 'rec3', Name: 'Test Record 3', tc9_et__Variation_Type__c: 'Basic' }
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypeValidation',
                description: 'Validate Variation Type picklist values',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: true,
                errorMessage: 'Invalid variation type values found',
                severity: 'error'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
            expect(mockTargetClient.getPicklistValues).toHaveBeenCalledWith(
                'tc9_et__Interpretation_Breakpoint__c',
                'tc9_et__Variation_Type__c'
            );
        });

        it('should pass validation when source records have null/empty picklist values', async () => {
            const mockPicklistData = {
                fieldName: 'tc9_et__Variation_Type__c',
                values: [
                    { value: 'Standard', label: 'Standard', active: true }
                ],
                restricted: true,
                defaultValue: undefined
            };

            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: true,
                data: mockPicklistData
            });

            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: null },
                { Id: 'rec2', Name: 'Test Record 2', tc9_et__Variation_Type__c: '' },
                { Id: 'rec3', Name: 'Test Record 3' } // Field not present
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypeValidation',
                description: 'Validate Variation Type picklist values',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: true,
                errorMessage: 'Invalid variation type values found',
                severity: 'error'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should pass validation with custom allowed values override', async () => {
            // Target org picklist will not be checked when allowedValues is provided
            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: 'CustomValue1' },
                { Id: 'rec2', Name: 'Test Record 2', tc9_et__Variation_Type__c: 'CustomValue2' }
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypeValidation',
                description: 'Validate Variation Type picklist values',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: false,
                allowedValues: ['CustomValue1', 'CustomValue2', 'CustomValue3'],
                errorMessage: 'Invalid variation type values found',
                severity: 'error'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(0);
            expect(mockTargetClient.getPicklistValues).not.toHaveBeenCalled();
        });
    });

    describe('ValidationEngine.runPicklistValidationChecks - FAIL Cases', () => {
        it('should fail validation when picklist values do not exist in target org', async () => {
            // Setup: Target org missing 'Oncall' value
            const mockPicklistData = {
                fieldName: 'tc9_et__Variation_Type__c',
                values: [
                    { value: 'Standard', label: 'Standard', active: true },
                    { value: 'Premium', label: 'Premium', active: true }
                ],
                restricted: true,
                defaultValue: undefined
            };

            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: true,
                data: mockPicklistData
            });

            // Source data with invalid 'Oncall' value (the reported issue)
            const sourceData = [
                { Id: 'a5Y9r0000003JHREA2', Name: 'WA Nurses Oncall', tc9_et__Variation_Type__c: 'Oncall' },
                { Id: 'rec2', Name: 'Test Record 2', tc9_et__Variation_Type__c: 'Standard' },
                { Id: 'rec3', Name: 'Test Record 3', tc9_et__Variation_Type__c: 'InvalidValue' }
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypePicklistValidation',
                description: 'Validate Variation Type picklist values exist in target org',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: true,
                errorMessage: 'Found invalid Variation Type picklist values that don\'t exist in target org',
                severity: 'error'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(2);
            
            // Check first error (Oncall value)
            expect(result.errors[0]).toEqual({
                checkName: 'variationTypePicklistValidation',
                message: 'Invalid picklist value \'Oncall\' for field tc9_et__Variation_Type__c. Allowed values: Standard, Premium',
                severity: 'error',
                recordId: 'a5Y9r0000003JHREA2',
                recordName: 'WA Nurses Oncall',
                suggestedAction: 'Update the tc9_et__Variation_Type__c field to use a valid picklist value before migration'
            });

            // Check second error (InvalidValue)
            expect(result.errors[1]).toEqual({
                checkName: 'variationTypePicklistValidation',
                message: 'Invalid picklist value \'InvalidValue\' for field tc9_et__Variation_Type__c. Allowed values: Standard, Premium',
                severity: 'error',
                recordId: 'rec3',
                recordName: 'Test Record 3',
                suggestedAction: 'Update the tc9_et__Variation_Type__c field to use a valid picklist value before migration'
            });

            expect(result.warnings).toHaveLength(0);
        });

        it('should fail validation with custom allowed values when source data is invalid', async () => {
            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: 'InvalidValue1' },
                { Id: 'rec2', Name: 'Test Record 2', tc9_et__Variation_Type__c: 'InvalidValue2' }
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypeValidation',
                description: 'Validate Variation Type picklist values',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: false,
                allowedValues: ['AllowedValue1', 'AllowedValue2'],
                errorMessage: 'Invalid variation type values found',
                severity: 'warning'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(2);
            
            expect(result.warnings[0].severity).toBe('warning');
            expect(result.warnings[0].message).toContain('AllowedValue1, AllowedValue2');
        });

        it('should handle errors when picklist metadata fetch fails', async () => {
            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: false,
                error: 'Connection timeout'
            });

            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: 'Standard' }
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypeValidation',
                description: 'Validate Variation Type picklist values',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: true,
                errorMessage: 'Invalid variation type values found',
                severity: 'error'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual({
                checkName: 'variationTypeValidation',
                message: 'Failed to get picklist metadata: Connection timeout',
                severity: 'error',
                recordId: null,
                recordName: null,
                suggestedAction: 'Check that the field exists and is a picklist field'
            });
        });

        it('should handle validation check execution errors gracefully', async () => {
            // Simulate an error during validation check execution
            mockTargetClient.getPicklistValues.mockRejectedValue(new Error('Network error'));

            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: 'Standard' }
            ];

            const picklistChecks: PicklistValidationCheck[] = [{
                checkName: 'variationTypeValidation',
                description: 'Validate Variation Type picklist values',
                fieldName: 'tc9_et__Variation_Type__c',
                objectName: 'tc9_et__Interpretation_Breakpoint__c',
                validateAgainstTarget: true,
                errorMessage: 'Invalid variation type values found',
                severity: 'error'
            }];

            const result = await (validationEngine as any).runPicklistValidationChecks(
                picklistChecks,
                sourceData
            );

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual({
                checkName: 'variationTypeValidation',
                message: 'Picklist validation check failed: Network error',
                severity: 'error',
                recordId: null,
                recordName: null,
                suggestedAction: 'Check validation configuration and org connectivity'
            });
        });
    });

    describe('Integration with ValidationEngine.validateTemplate', () => {
        it('should integrate picklist validation into full template validation', async () => {
            // Mock sessionManager.areAllOrgsHealthy
            (sessionManager.areAllOrgsHealthy as jest.Mock).mockResolvedValue(true);

            // Mock extractSourceDataForValidation
            const sourceData = [
                { Id: 'rec1', Name: 'Test Record 1', tc9_et__Variation_Type__c: 'Oncall' }
            ];
            
            jest.spyOn(validationEngine as any, 'extractSourceDataForValidation')
                .mockResolvedValue(sourceData);

            // Mock other validation methods to return empty results
            jest.spyOn(validationEngine as any, 'executePreValidationQueries')
                .mockResolvedValue(undefined);
            jest.spyOn(validationEngine as any, 'runDependencyChecks')
                .mockResolvedValue({ errors: [], warnings: [], info: [], isValid: true, summary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, warningChecks: 0 } });
            jest.spyOn(validationEngine as any, 'runDataIntegrityChecks')
                .mockResolvedValue({ errors: [], warnings: [], info: [], isValid: true, summary: { totalChecks: 0, passedChecks: 0, failedChecks: 0, warningChecks: 0 } });

            // Setup picklist validation to fail
            const mockPicklistData = {
                fieldName: 'tc9_et__Variation_Type__c',
                values: [{ value: 'Standard', label: 'Standard', active: true }],
                restricted: true,
                defaultValue: undefined
            };

            mockTargetClient.getPicklistValues.mockResolvedValue({
                success: true,
                data: mockPicklistData
            });

            const template: MigrationTemplate = {
                id: 'test-template',
                name: 'Test Template',
                description: 'Test template with picklist validation',
                category: 'payroll',
                version: '1.0.0',
                etlSteps: [{
                    stepName: 'testStep',
                    stepOrder: 1,
                    extractConfig: {
                        soqlQuery: 'SELECT Id, Name FROM TestObject__c',
                        objectApiName: 'TestObject__c'
                    },
                    transformConfig: {
                        fieldMappings: [],
                        lookupMappings: [],
                        externalIdHandling: {
                            sourceField: 'Id',
                            targetField: 'Id',
                            managedField: 'External_ID__c',
                            unmanagedField: 'External_ID__c',
                            fallbackField: 'External_Id__c',
                            strategy: 'auto-detect'
                        }
                    },
                    loadConfig: {
                        targetObject: 'TestObject__c',
                        operation: 'upsert',
                        externalIdField: 'Id',
                        useBulkApi: true,
                        batchSize: 200,
                        allowPartialSuccess: false,
                        retryConfig: {
                            maxRetries: 3,
                            retryWaitSeconds: 30,
                            retryableErrors: []
                        }
                    },
                    validationConfig: {
                        dependencyChecks: [],
                        dataIntegrityChecks: [],
                        picklistValidationChecks: [{
                            checkName: 'variationTypePicklistValidation',
                            description: 'Validate Variation Type picklist values exist in target org',
                            fieldName: 'tc9_et__Variation_Type__c',
                            objectName: 'tc9_et__Interpretation_Breakpoint__c',
                            validateAgainstTarget: true,
                            errorMessage: 'Found invalid Variation Type picklist values that don\'t exist in target org',
                            severity: 'error'
                        }],
                        preValidationQueries: []
                    },
                    dependencies: []
                }],
                executionOrder: ['testStep'],
                metadata: {
                    author: 'Test',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    supportedApiVersions: ['59.0'],
                    requiredPermissions: [],
                    estimatedDuration: 5,
                    complexity: 'simple'
                }
            };

            const result = await validationEngine.validateTemplate(
                template,
                'source-org',
                'target-org',
                ['rec1']
            );

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].checkName).toBe('variationTypePicklistValidation');
            expect(result.errors[0].message).toContain('Invalid picklist value \'Oncall\'');
        });
    });
});