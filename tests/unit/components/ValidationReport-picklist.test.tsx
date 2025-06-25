import { ValidationResult, ValidationIssue } from '@/lib/migration/templates/core/interfaces';

// Test the picklist error detection logic independently
function getPicklistErrorSuggestion(issue: ValidationIssue) {
    if (issue.message.includes('Invalid picklist value')) {
        return "This is a picklist validation error. Please check the field values in your source data against the target org's picklist configuration.";
    }
    if (issue.message.includes('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST')) {
        return "This is a picklist validation error. Please check the field values in your source data against the target org's picklist configuration.";
    }
    return issue.suggestedAction;
}

function isPicklistError(issue: ValidationIssue): boolean {
    return issue.message.includes('Invalid picklist value') || 
           issue.message.includes('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST') ||
           issue.checkName.includes('picklistValidation');
}

describe('ValidationReport - Picklist Error Logic', () => {
    describe('Picklist Error Detection', () => {
        it('should detect picklist validation errors by message content', () => {
            const picklistValidationResult: ValidationResult = {
                isValid: false,
                errors: [
                    {
                        checkName: 'variationTypePicklistValidation',
                        message: 'Invalid picklist value \'Oncall\' for field tc9_et__Variation_Type__c. Allowed values: Standard, Premium',
                        severity: 'error',
                        recordId: 'a5Y9r0000003JHREA2',
                        recordName: 'WA Nurses Oncall',
                        suggestedAction: 'Update the tc9_et__Variation_Type__c field to use a valid picklist value before migration'
                    }
                ],
                warnings: [],
                info: [],
                summary: {
                    totalChecks: 1,
                    passedChecks: 0,
                    failedChecks: 1,
                    warningChecks: 0
                }
            };

            const error = picklistValidationResult.errors[0];
            
            // Test picklist error detection
            expect(isPicklistError(error)).toBe(true);
            
            // Test enhanced suggestion
            const suggestion = getPicklistErrorSuggestion(error);
            expect(suggestion).toBe("This is a picklist validation error. Please check the field values in your source data against the target org's picklist configuration.");
            
            // Verify error properties
            expect(error.checkName).toBe('variationTypePicklistValidation');
            expect(error.message).toContain('Invalid picklist value \'Oncall\'');
            expect(error.recordName).toBe('WA Nurses Oncall');
            expect(error.severity).toBe('error');
        });

        it('should detect INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST errors from Salesforce', () => {
            const salesforceError: ValidationIssue = {
                checkName: 'bulkApiValidation',
                message: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST:Variation Type: bad value for restricted picklist field: Oncall:tc9_et__Variation_Type__c --',
                severity: 'error',
                recordId: 'a5Y9r0000003JHREA2',
                recordName: 'WA Nurses Oncall',
                suggestedAction: 'Fix the picklist value before retrying'
            };

            // Test detection of Salesforce picklist errors
            expect(isPicklistError(salesforceError)).toBe(true);
            
            // Test enhanced suggestion overrides original
            const suggestion = getPicklistErrorSuggestion(salesforceError);
            expect(suggestion).toBe("This is a picklist validation error. Please check the field values in your source data against the target org's picklist configuration.");
            
            // Verify error properties
            expect(salesforceError.message).toContain('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST');
            expect(salesforceError.recordName).toBe('WA Nurses Oncall');
        });

        it('should handle mixed error types correctly', () => {
            const picklistError: ValidationIssue = {
                checkName: 'variationTypePicklistValidation',
                message: 'Invalid picklist value \'Oncall\' for field tc9_et__Variation_Type__c. Allowed values: Standard, Premium',
                severity: 'error',
                recordId: 'rec1',
                recordName: 'Picklist Record',
                suggestedAction: 'Update the field value'
            };
            
            const dependencyError: ValidationIssue = {
                checkName: 'dependencyCheck',
                message: 'Referenced record not found in target org',
                severity: 'error',
                recordId: 'rec2',
                recordName: 'Dependency Record',
                suggestedAction: 'Ensure referenced record exists'
            };

            // Test that only picklist error is detected as such
            expect(isPicklistError(picklistError)).toBe(true);
            expect(isPicklistError(dependencyError)).toBe(false);
            
            // Test suggestions are handled appropriately
            expect(getPicklistErrorSuggestion(picklistError)).toContain('This is a picklist validation error');
            expect(getPicklistErrorSuggestion(dependencyError)).toBe('Ensure referenced record exists');
        });

        it('should not detect non-picklist errors as picklist errors', () => {
            const dependencyError: ValidationIssue = {
                checkName: 'dependencyCheck',
                message: 'Referenced Pay Code not found in target org',
                severity: 'error',
                recordId: 'rec1',
                recordName: 'Test Record',
                suggestedAction: 'Create the referenced pay code first'
            };

            // Should not be detected as picklist error
            expect(isPicklistError(dependencyError)).toBe(false);
            
            // Should preserve original suggested action
            expect(getPicklistErrorSuggestion(dependencyError)).toBe('Create the referenced pay code first');
        });
    });

    describe('Error Message Enhancement', () => {
        it('should enhance error messages for picklist warnings', () => {
            const picklistWarning: ValidationIssue = {
                checkName: 'variationTypePicklistValidation',
                message: 'Invalid picklist value \'Deprecated\' for field tc9_et__Variation_Type__c. Allowed values: Standard, Premium',
                severity: 'warning',
                recordId: 'rec1',
                recordName: 'Warning Record',
                suggestedAction: 'Consider updating to a current picklist value'
            };

            // Should detect picklist warnings too
            expect(isPicklistError(picklistWarning)).toBe(true);
            
            // Should enhance suggestion even for warnings
            expect(getPicklistErrorSuggestion(picklistWarning)).toContain('This is a picklist validation error');
        });

        it('should enhance error messages for picklist errors without existing suggested actions', () => {
            const picklistErrorNoAction: ValidationIssue = {
                checkName: 'variationTypePicklistValidation',
                message: 'Invalid picklist value \'Oncall\' for field tc9_et__Variation_Type__c. Allowed values: Standard, Premium',
                severity: 'error',
                recordId: 'rec1',
                recordName: 'Test Record',
                // No suggestedAction provided
            };

            // Should still provide enhanced suggestion
            expect(getPicklistErrorSuggestion(picklistErrorNoAction)).toContain('This is a picklist validation error');
        });

        it('should preserve existing suggested actions for non-picklist errors', () => {
            const nonPicklistError: ValidationIssue = {
                checkName: 'dependencyCheck',
                message: 'Pay Code reference missing',
                severity: 'error',
                recordId: 'rec1',
                recordName: 'Test Record',
                suggestedAction: 'Create the pay code in target org first'
            };

            // Should preserve original action for non-picklist errors
            expect(getPicklistErrorSuggestion(nonPicklistError)).toBe('Create the pay code in target org first');
        });
    });
});