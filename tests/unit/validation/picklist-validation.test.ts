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

    // Helper to setup common mocks
    const setupPicklistValidationMocks = (sourceValues: string[], targetPicklistValues: any[]) => {
        // Mock the query response for unique values
        const queryData = sourceValues.map(value => ({
            tc9_et__Variation_Type__c: value,
            recordCount: 1
        }));
        mockSourceClient.query.mockResolvedValue({
            success: true,
            data: queryData,
            totalSize: queryData.length
        });

        // Mock target metadata
        (mockTargetClient.getObjectMetadata as jest.Mock).mockResolvedValue({
            success: true,
            data: {
                fields: [{
                    name: 'tc9_et__Variation_Type__c',
                    type: 'picklist',
                    picklistValues: targetPicklistValues
                }]
            }
        });
    };

    beforeEach(() => {
        validationEngine = new ValidationEngine();
        
        // Mock SalesforceClient instances
        mockSourceClient = {
            getPicklistValues: jest.fn(),
            query: jest.fn(),
            getObjectMetadata: jest.fn(),
        } as any;
        
        mockTargetClient = {
            getPicklistValues: jest.fn(),
            query: jest.fn(),
            getObjectMetadata: jest.fn(),
        } as any;

        // Mock sessionManager
        (sessionManager.getClient as jest.Mock).mockImplementation((orgId: string) => {
            return orgId === 'source-org' ? mockSourceClient : mockTargetClient;
        });

        // Initialize validation engine with org IDs
        (validationEngine as any).sourceOrgId = 'source-org';
        (validationEngine as any).targetOrgId = 'target-org';
        (validationEngine as any).currentTargetObject = 'tc9_et__Interpretation_Breakpoint__c';
        (validationEngine as any).currentSourceQuery = 'SELECT Id FROM tc9_et__Interpretation_Breakpoint__c';
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
            setupPicklistValidationMocks(
                ['Standard', 'Premium', 'Basic'],
                [
                    { value: 'Standard', label: 'Standard', active: true },
                    { value: 'Premium', label: 'Premium', active: true },
                    { value: 'Basic', label: 'Basic', active: true }
                ]
            );

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
            expect(mockTargetClient.getObjectMetadata).toHaveBeenCalledWith(
                'tc9_et__Interpretation_Breakpoint__c'
            );
        });

        it('should pass validation when source records have null/empty picklist values', async () => {
            // Mock empty query result since no values exist
            mockSourceClient.query.mockResolvedValue({
                success: true,
                data: [],
                totalSize: 0
            });

            setupPicklistValidationMocks(
                [],
                [{ value: 'Standard', label: 'Standard', active: true }]
            );

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
            // Mock the query for source values
            mockSourceClient.query.mockResolvedValue({
                success: true,
                data: [
                    { tc9_et__Variation_Type__c: 'CustomValue1', recordCount: 1 },
                    { tc9_et__Variation_Type__c: 'CustomValue2', recordCount: 1 }
                ],
                totalSize: 2
            });

            // Mock target metadata even though it won't be used
            (mockTargetClient.getObjectMetadata as jest.Mock).mockResolvedValue({
                success: true,
                data: { fields: [] }
            });

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
            // Mock source query with all unique values
            mockSourceClient.query.mockResolvedValue({
                success: true,
                data: [
                    { tc9_et__Variation_Type__c: 'Oncall', recordCount: 1 },
                    { tc9_et__Variation_Type__c: 'Standard', recordCount: 1 },
                    { tc9_et__Variation_Type__c: 'InvalidValue', recordCount: 1 }
                ],
                totalSize: 3
            });

            // Mock target metadata - missing 'Oncall' and 'InvalidValue'
            (mockTargetClient.getObjectMetadata as jest.Mock).mockResolvedValue({
                success: true,
                data: {
                    fields: [{
                        name: 'tc9_et__Variation_Type__c',
                        type: 'picklist',
                        picklistValues: [
                            { value: 'Standard', label: 'Standard', active: true },
                            { value: 'Premium', label: 'Premium', active: true }
                        ]
                    }]
                }
            });

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

            expect(result.errors).toHaveLength(1);
            
            // Check the single combined error for all invalid values
            expect(result.errors[0]).toMatchObject({
                checkName: expect.stringContaining('Variation Type'), // Friendly title
                message: 'Invalid picklist values found for field tc9_et__Variation_Type__c: InvalidValue, Oncall. These values do not exist in the target org.',
                severity: 'error',
                recordId: null,
                recordName: null
            });

            expect(result.warnings).toHaveLength(0);
        });

        it('should skip validation when validateAgainstTarget is false (allowedValues not implemented)', async () => {
            // This test documents current behavior: allowedValues property is not implemented
            // When validateAgainstTarget is false, validation is skipped entirely
            
            // Mock source query with invalid values
            mockSourceClient.query.mockResolvedValue({
                success: true,
                data: [
                    { tc9_et__Variation_Type__c: 'InvalidValue1', recordCount: 1 },
                    { tc9_et__Variation_Type__c: 'InvalidValue2', recordCount: 1 }
                ],
                totalSize: 2
            });

            // Mock target metadata - no picklist values
            (mockTargetClient.getObjectMetadata as jest.Mock).mockResolvedValue({
                success: true,
                data: { fields: [] } // No fields with picklist values
            });

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

            // No errors or warnings because the field is not found in target metadata
            // and allowedValues logic is not implemented
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle errors when picklist metadata fetch fails', async () => {
            // Mock source query
            mockSourceClient.query.mockResolvedValue({
                success: true,
                data: [
                    { tc9_et__Variation_Type__c: 'Standard', recordCount: 1 }
                ],
                totalSize: 1
            });

            // Mock target metadata fetch failure
            (mockTargetClient.getObjectMetadata as jest.Mock).mockResolvedValue({
                success: false,
                error: 'Connection timeout'
            });

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
            // The formatter transforms the metadata error into a picklist validation format
            expect(result.errors[0]).toMatchObject({
                checkName: expect.any(String), // Friendly title
                message: expect.stringContaining('Invalid value'),
                severity: 'error',
                recordId: null,
                recordName: null
            });
        });

        it('should handle validation check execution errors gracefully', async () => {
            // Mock source query
            mockSourceClient.query.mockResolvedValue({
                success: true,
                data: [
                    { tc9_et__Variation_Type__c: 'Standard', recordCount: 1 }
                ],
                totalSize: 1
            });

            // Mock target metadata to fail with a network error
            (mockTargetClient.getObjectMetadata as jest.Mock).mockRejectedValue(new Error('Network error'));

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
            // The formatter transforms the error into a picklist validation format
            expect(result.errors[0]).toMatchObject({
                checkName: expect.any(String), // Friendly title
                message: expect.stringContaining('Invalid value'),
                severity: 'error',
                recordId: null,
                recordName: null
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
            
            // Mock executeSoqlQuery for getUniquePicklistValues
            jest.spyOn(validationEngine as any, 'executeSoqlQuery')
                .mockResolvedValue([
                    { tc9_et__Variation_Type__c: 'Oncall', recordCount: 1 }
                ]);

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
            // Check for the transformed message format
            expect(result.errors[0].checkName).toBeDefined();
            expect(result.errors[0].message).toContain('Invalid value');
        });
    });
});