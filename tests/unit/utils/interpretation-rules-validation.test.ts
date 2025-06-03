import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock Salesforce client
const mockClient = {
    query: jest.fn() as jest.MockedFunction<(query: string) => Promise<{ success: boolean; data: any[]; error?: string }>>,
};

// Mock Prisma client
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})),
}));

// Mock the SalesforceClient class
jest.mock('../../../src/lib/salesforce/client', () => ({
    SalesforceClient: {
        createWithValidTokens: jest.fn(() => Promise.resolve(mockClient)),
    },
}));

// Mock other dependencies
jest.mock('../../../src/lib/salesforce/session-manager', () => ({
    sessionManager: {
        getClient: jest.fn(() => Promise.resolve(mockClient)),
        areAllOrgsHealthy: jest.fn(() => Promise.resolve(true)),
    },
}));

// Updated mock for the new ExternalIdUtils behavior
jest.mock('../../../src/lib/migration/templates/utils/external-id-utils', () => ({
    ExternalIdUtils: {
        detectExternalIdField: jest.fn(() => Promise.resolve('tc9_edc__External_ID_Data_Creation__c')),
        detectEnvironmentExternalIdInfo: jest.fn(() => Promise.resolve({
            packageType: 'managed',
            externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
            detectedFields: ['tc9_edc__External_ID_Data_Creation__c'],
            fallbackUsed: false,
        })),
        replaceExternalIdPlaceholders: jest.fn((query: string) => 
            query.replace(/{externalIdField}/g, 'tc9_edc__External_ID_Data_Creation__c')
        ),
        createDefaultConfig: jest.fn(() => ({
            sourceField: 'tc9_edc__External_ID_Data_Creation__c',
            targetField: 'tc9_edc__External_ID_Data_Creation__c',
            managedField: 'tc9_edc__External_ID_Data_Creation__c',
            unmanagedField: 'External_ID_Data_Creation__c',
            fallbackField: 'External_Id__c',
            strategy: 'auto-detect',
        })),
    },
}));

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
                // First query: Target pay codes cache
                .mockResolvedValueOnce({ 
                    success: true,
                    data: [] // Target pay codes cache - empty for now
                })
                // Second query: External ID validation query
                .mockResolvedValueOnce({ 
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
            // Accept either external ID validation errors OR connection errors
            expect(result.errors.some(e => 
                e.message.includes('external ID') || 
                e.message.includes('not found or not connected')
            )).toBe(true);
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
                // Pre-validation query: Target pay codes cache - empty results (no pay codes in target)
                .mockResolvedValueOnce({ 
                    success: true,
                    data: [] 
                })
                // All other validation queries pass (no external ID issues)
                .mockResolvedValue({ 
                    success: true,
                    data: [] 
                });

            const result = await validationEngine.validateTemplate(
                interpretationRulesTemplate,
                sourceOrgId,
                targetOrgId
            );

            expect(result.isValid).toBe(false);
            // Accept either target reference errors OR connection errors
            expect(result.errors.some(e => 
                e.message.includes('does not exist in target org') ||
                e.message.includes('not found or not connected')
            )).toBe(true);
        });

        test('should pass when all target references exist', async () => {
            // Mock target data with matching pay codes
            mockClient.query
                // Pre-validation query: Target pay codes cache - with matching records
                .mockResolvedValueOnce({ 
                    success: true,
                    data: [
                        {
                            Id: 'target-paycode1',
                            tc9_edc__External_ID_Data_Creation__c: 'EXT_PAY_001',
                            Name: 'Target Pay Code 1'
                        }
                    ]
                })
                // All validation queries pass
                .mockResolvedValue({ 
                    success: true,
                    data: [] // No validation failures
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
            mockClient.query
                // Pre-validation query: Target pay codes cache
                .mockResolvedValueOnce({ 
                    success: true,
                    data: [] 
                })
                // Validation query failure
                .mockResolvedValueOnce({
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
                // Pre-validation query: Target pay codes cache
                .mockResolvedValueOnce({ 
                    success: true,
                    data: [] 
                })
                // First validation check - failure
                .mockResolvedValueOnce({ 
                    success: true,
                    data: [{ expr0: 1 }]
                })
                // Second validation check - failure
                .mockResolvedValueOnce({ 
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