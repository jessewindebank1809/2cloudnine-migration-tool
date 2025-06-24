import { ValidationEngine } from '@/lib/migration/templates/core/validation-engine';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { MigrationTemplate } from '@/lib/migration/templates/core/interfaces';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';

jest.mock('@/lib/salesforce/session-manager');

describe('Picklist Validation', () => {
    let validationEngine: ValidationEngine;
    const sourceOrgId = 'source-org-123';
    const targetOrgId = 'target-org-456';

    beforeEach(() => {
        validationEngine = new ValidationEngine();
        jest.clearAllMocks();
    });

    afterEach(() => {
        validationEngine.clearCache();
    });

    describe('Auto-detect and validate picklist fields', () => {
        it('should detect picklist fields and validate values against target org', async () => {
            // Mock healthy org connections
            (sessionManager.areAllOrgsHealthy as jest.Mock).mockResolvedValue(true);

            // Mock source client for data extraction
            const mockSourceClient = {
                query: jest.fn().mockResolvedValue({
                    success: true,
                    data: [
                        {
                            Id: 'a11GC00000FECRGYA5',
                            Name: 'Test Rule 1',
                            tc9_et__Variation_Type__c: 'Oncall', // Invalid value
                        },
                        {
                            Id: 'a11GC00000FECRGYA6',
                            Name: 'Test Rule 2',
                            tc9_et__Variation_Type__c: 'Overtime', // Valid value
                        },
                    ],
                }),
            };

            // Mock target client with metadata including picklist values
            const mockTargetClient = {
                query: jest.fn().mockResolvedValue({
                    success: true,
                    data: [],
                }),
                getObjectMetadata: jest.fn().mockResolvedValue({
                    success: true,
                    data: {
                        name: 'tc9_et__Interpretation_Rule__c',
                        fields: [
                            {
                                name: 'tc9_et__Variation_Type__c',
                                type: 'picklist',
                                picklistValues: [
                                    { value: 'Overtime', label: 'Overtime', active: true },
                                    { value: 'Double Time', label: 'Double Time', active: true },
                                    { value: 'Time and a Half', label: 'Time and a Half', active: true },
                                    // Note: 'Oncall' is NOT in the list
                                ],
                            },
                        ],
                    },
                }),
            };

            (sessionManager.getClient as jest.Mock).mockImplementation(async (orgId: string) => {
                if (orgId === sourceOrgId) return mockSourceClient as any;
                if (orgId === targetOrgId) return mockTargetClient as any;
                throw new Error(`Unknown org: ${orgId}`);
            });

            const template: MigrationTemplate = {
                id: 'test-template',
                name: 'Test Template',
                description: 'Test',
                version: '1.0',
                category: 'payroll',
                executionOrder: ['interpretationRules'],
                metadata: {
                    author: 'test',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    supportedApiVersions: ['v60.0'],
                    requiredPermissions: [],
                    estimatedDuration: 10,
                    complexity: 'simple',
                },
                etlSteps: [
                    {
                        stepName: 'interpretationRules',
                        stepOrder: 1,
                        dependencies: [],
                        extractConfig: {
                            objectApiName: 'tc9_et__Interpretation_Rule__c',
                            soqlQuery: 'SELECT Id, Name, tc9_et__Variation_Type__c FROM tc9_et__Interpretation_Rule__c',
                        },
                        transformConfig: {
                            fieldMappings: [
                                {
                                    sourceField: 'tc9_et__Variation_Type__c',
                                    targetField: 'tc9_et__Variation_Type__c',
                                    isRequired: false,
                                    transformationType: 'direct',
                                },
                            ],
                            lookupMappings: [],
                            externalIdHandling: ExternalIdUtils.createDefaultConfig(),
                        },
                        loadConfig: {
                            targetObject: 'tc9_et__Interpretation_Rule__c',
                            operation: 'upsert',
                            externalIdField: 'External_ID__c',
                            useBulkApi: true,
                            batchSize: 200,
                            allowPartialSuccess: false,
                            retryConfig: {
                                maxRetries: 3,
                                retryWaitSeconds: 30,
                                retryableErrors: ['UNABLE_TO_LOCK_ROW'],
                            },
                        },
                        validationConfig: {
                            dependencyChecks: [],
                            dataIntegrityChecks: [],
                            preValidationQueries: [],
                            picklistValidationChecks: [],
                            // No explicit picklist checks - should auto-detect
                        },
                    },
                ],
            };

            const result = await validationEngine.validateTemplate(
                template,
                sourceOrgId,
                targetOrgId
            );

            // Should fail validation due to invalid picklist value
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain("Invalid picklist value 'Oncall'");
            expect(result.errors[0].message).toContain('tc9_et__Variation_Type__c');
            expect(result.errors[0].recordId).toBe('a11GC00000FECRGYA5');
            expect(result.errors[0].suggestedAction).toContain('Valid values are: Overtime, Double Time, Time and a Half');
        });

        it('should pass validation when all picklist values are valid', async () => {
            // Mock healthy org connections
            (sessionManager.areAllOrgsHealthy as jest.Mock).mockResolvedValue(true);

            // Mock source client with valid data
            const mockSourceClient = {
                query: jest.fn().mockResolvedValue({
                    success: true,
                    data: [
                        {
                            Id: 'a11GC00000FECRGYA7',
                            Name: 'Test Rule 3',
                            tc9_et__Variation_Type__c: 'Overtime',
                        },
                        {
                            Id: 'a11GC00000FECRGYA8',
                            Name: 'Test Rule 4',
                            tc9_et__Variation_Type__c: 'Double Time',
                        },
                    ],
                }),
            };

            // Mock target client
            const mockTargetClient = {
                query: jest.fn().mockResolvedValue({
                    success: true,
                    data: [],
                }),
                getObjectMetadata: jest.fn().mockResolvedValue({
                    success: true,
                    data: {
                        name: 'tc9_et__Interpretation_Rule__c',
                        fields: [
                            {
                                name: 'tc9_et__Variation_Type__c',
                                type: 'picklist',
                                picklistValues: [
                                    { value: 'Overtime', label: 'Overtime', active: true },
                                    { value: 'Double Time', label: 'Double Time', active: true },
                                    { value: 'Time and a Half', label: 'Time and a Half', active: true },
                                ],
                            },
                        ],
                    },
                }),
            };

            (sessionManager.getClient as jest.Mock).mockImplementation(async (orgId: string) => {
                if (orgId === sourceOrgId) return mockSourceClient as any;
                if (orgId === targetOrgId) return mockTargetClient as any;
                throw new Error(`Unknown org: ${orgId}`);
            });

            const template: MigrationTemplate = {
                id: 'test-template',
                name: 'Test Template',
                description: 'Test',
                version: '1.0',
                category: 'payroll',
                executionOrder: ['interpretationRules'],
                metadata: {
                    author: 'test',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    supportedApiVersions: ['v60.0'],
                    requiredPermissions: [],
                    estimatedDuration: 10,
                    complexity: 'simple',
                },
                etlSteps: [
                    {
                        stepName: 'interpretationRules',
                        stepOrder: 1,
                        dependencies: [],
                        extractConfig: {
                            objectApiName: 'tc9_et__Interpretation_Rule__c',
                            soqlQuery: 'SELECT Id, Name, tc9_et__Variation_Type__c FROM tc9_et__Interpretation_Rule__c',
                        },
                        transformConfig: {
                            fieldMappings: [
                                {
                                    sourceField: 'tc9_et__Variation_Type__c',
                                    targetField: 'tc9_et__Variation_Type__c',
                                    isRequired: false,
                                    transformationType: 'direct',
                                },
                            ],
                            lookupMappings: [],
                            externalIdHandling: ExternalIdUtils.createDefaultConfig(),
                        },
                        loadConfig: {
                            targetObject: 'tc9_et__Interpretation_Rule__c',
                            operation: 'upsert',
                            externalIdField: 'External_ID__c',
                            useBulkApi: true,
                            batchSize: 200,
                            allowPartialSuccess: false,
                            retryConfig: {
                                maxRetries: 3,
                                retryWaitSeconds: 30,
                                retryableErrors: ['UNABLE_TO_LOCK_ROW'],
                            },
                        },
                        validationConfig: {
                            dependencyChecks: [],
                            dataIntegrityChecks: [],
                            preValidationQueries: [],
                            picklistValidationChecks: [],
                        },
                    },
                ],
            };

            const result = await validationEngine.validateTemplate(
                template,
                sourceOrgId,
                targetOrgId
            );

            // Should pass validation
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
});