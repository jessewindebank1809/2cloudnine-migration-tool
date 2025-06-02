import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock Prisma client first
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

// Mock other dependencies
jest.mock('../../../src/lib/salesforce/session-manager', () => ({
    sessionManager: {
        getClient: jest.fn(() => Promise.resolve(mockClient)),
        areAllOrgsHealthy: jest.fn(() => Promise.resolve(true)),
    },
}));

jest.mock('../../../src/lib/migration/templates/utils/external-id-utils', () => ({
    ExternalIdUtils: {
        detectExternalIdField: jest.fn(() => Promise.resolve('External_ID_Data_Creation__c')),
        replaceExternalIdPlaceholders: jest.fn((query: string) => query.replace(/{externalIdField}/g, 'External_ID_Data_Creation__c')),
    },
}));

// Mock Salesforce client
const mockClient = {
    query: jest.fn() as jest.MockedFunction<(query: string) => Promise<{ success: boolean; data: any[]; error?: string }>>,
};

import { ValidationEngine } from '../../../src/lib/migration/templates/core/validation-engine';
import { interpretationRulesTemplate } from '../../../src/lib/migration/templates/definitions/payroll/interpretation-rules.template';

describe('Interpretation Rules Validation - External ID and Target Reference Validation', () => {
    let validationEngine: ValidationEngine;
    const sourceOrgId = 'source-org-123';
    const targetOrgId = 'target-org-456';

    beforeEach(() => {
        validationEngine = new ValidationEngine();
        jest.clearAllMocks();
    });

    describe('External ID Presence Validation', () => {
        test('should throw error when source pay codes missing external IDs', async () => {
            // Mock validation queries for external ID check
            mockClient.query
                .mockResolvedValueOnce({ // External ID validation query
                    success: true,
                    data: [{ expr0: 1 }] // Found records without external IDs
                });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.message.includes('external ID'))).toBe(true);
        });

        test('should pass when all source records have valid external IDs', async () => {
            // Mock all queries to return empty validation failures
            mockClient.query.mockResolvedValue({
                success: true,
                data: [] // No validation failures
            });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            // Should not have external ID errors
            expect(result.errors.filter(e => e.message.includes('external ID'))).toHaveLength(0);
        });
    });

    describe('Target Reference Existence Validation', () => {
        test('should throw error when pay code reference not found in target org', async () => {
            // Mock source data extract with valid external IDs
            mockClient.query
                .mockResolvedValueOnce({ // Source data extract
                    success: true,
                    data: [
                        {
                            Id: 'rule1',
                            Name: 'Test Rule 1',
                            'tc9_et__Pay_Code__r': {
                                External_ID_Data_Creation__c: 'MISSING_PAY_CODE'
                            }
                        }
                    ]
                })
                .mockResolvedValueOnce({ // Target org cache query - empty results
                    success: true,
                    data: []
                });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => 
                e.message.includes('MISSING_PAY_CODE') && 
                e.message.includes('does not exist in target org')
            )).toBe(true);
        });

        test('should pass when all target references exist', async () => {
            // Mock source data and matching target data
            mockClient.query
                .mockResolvedValueOnce({ // Source data extract
                    success: true,
                    data: [
                        {
                            Id: 'rule1',
                            Name: 'Test Rule 1',
                            'tc9_et__Pay_Code__r': {
                                External_ID_Data_Creation__c: 'EXT_PAY_001'
                            }
                        }
                    ]
                })
                .mockResolvedValueOnce({ // Target org cache query - with matching records
                    success: true,
                    data: [
                        {
                            Id: 'target-paycode1',
                            External_ID_Data_Creation__c: 'EXT_PAY_001',
                            Name: 'Target Pay Code 1'
                        }
                    ]
                });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            // Should not have target reference errors
            expect(result.errors.filter(e => 
                e.message.includes('does not exist in target org')
            )).toHaveLength(0);
        });
    });

    describe('Migration Rollback Behavior', () => {
        test('should stop migration process when validation fails', async () => {
            // Mock validation failure
            mockClient.query.mockResolvedValue({
                success: true,
                data: [{ expr0: 5 }] // Found 5 validation issues
            });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.severity === 'error')).toBe(true);
        });
    });

    describe('Multiple Validation Failures', () => {
        test('should report all validation issues when multiple failures occur', async () => {
            // Mock multiple validation failures
            mockClient.query
                .mockResolvedValueOnce({ // First validation check - failure
                    success: true,
                    data: [{ expr0: 1 }]
                })
                .mockResolvedValueOnce({ // Second validation check - failure
                    success: true,
                    data: [{ expr0: 2 }]
                });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
}); 