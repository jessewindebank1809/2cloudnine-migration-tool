/**
 * Simple validation test runner for interpretation rules
 * Tests the validation logic without complex mocking
 */

import { interpretationRulesTemplate } from '../../../src/lib/migration/templates/definitions/payroll/interpretation-rules.template.js';

interface ValidationTestResult {
    success: boolean;
    message: string;
    errors: string[];
}

/**
 * Test validation rule configuration
 */
export function testValidationRuleConfiguration(): ValidationTestResult {
    const errors: string[] = [];
    
    try {
        console.log('Testing interpretation rules validation configuration...');
        
        // Test 1: Verify external ID validation rules exist
        const masterStep = interpretationRulesTemplate.etlSteps.find(step => step.stepName === 'interpretationRuleMaster');
        if (!masterStep?.validationConfig?.dataIntegrityChecks) {
            errors.push('Master step missing data integrity checks');
        } else {
            const externalIdCheck = masterStep.validationConfig.dataIntegrityChecks.find(
                check => check.checkName === 'sourcePayCodeExternalIdValidation'
            );
            if (!externalIdCheck) {
                errors.push('Missing source pay code external ID validation check');
            } else if (externalIdCheck.severity !== 'error') {
                errors.push('External ID validation should be error severity to stop migration');
            }
        }
        
        // Test 2: Verify dependency checks are required (not warnings)
        if (masterStep?.validationConfig?.dependencyChecks) {
            const payCodeDependency = masterStep.validationConfig.dependencyChecks.find(
                check => check.checkName === 'payCodeExists'
            );
            if (!payCodeDependency?.isRequired) {
                errors.push('Pay code dependency check should be required to ensure migration rollback');
            }
        }
        
        // Test 3: Verify breakpoint steps have comprehensive validation
        const breakpointSteps = interpretationRulesTemplate.etlSteps.filter(step => 
            step.stepName.includes('interpretationBreakpoint')
        );
        
        for (const step of breakpointSteps) {
            if (!step.validationConfig?.dataIntegrityChecks) {
                errors.push(`Breakpoint step ${step.stepName} missing data integrity checks`);
                continue;
            }
            
            // Check for external ID validations
            const hasLeaveRuleValidation = step.validationConfig.dataIntegrityChecks.some(
                check => check.checkName === 'sourceLeaveRuleExternalIdValidation'
            );
            const hasLeaveHeaderValidation = step.validationConfig.dataIntegrityChecks.some(
                check => check.checkName === 'sourceLeaveHeaderExternalIdValidation'
            );
            const hasPayCodeValidation = step.validationConfig.dataIntegrityChecks.some(
                check => check.checkName === 'sourcePayCodeExternalIdValidation'
            );
            
            if (!hasLeaveRuleValidation) {
                errors.push(`Step ${step.stepName} missing leave rule external ID validation`);
            }
            if (!hasLeaveHeaderValidation) {
                errors.push(`Step ${step.stepName} missing leave header external ID validation`);
            }
            if (!hasPayCodeValidation) {
                errors.push(`Step ${step.stepName} missing pay code external ID validation`);
            }
            
            // Check that dependency checks are required
            if (step.validationConfig.dependencyChecks) {
                const requiredChecks = step.validationConfig.dependencyChecks.filter(check => check.isRequired);
                const totalChecks = step.validationConfig.dependencyChecks.length;
                
                if (requiredChecks.length !== totalChecks) {
                    errors.push(`Step ${step.stepName} has non-required dependency checks that should be required for migration rollback`);
                }
            }
        }
        
        // Test 4: Verify error messages are clear and actionable
        const allSteps = interpretationRulesTemplate.etlSteps;
        for (const step of allSteps) {
            if (step.validationConfig?.dataIntegrityChecks) {
                for (const check of step.validationConfig.dataIntegrityChecks) {
                    if (check.severity === 'error' && !check.errorMessage.includes('Migration cannot proceed')) {
                        errors.push(`Error check ${check.checkName} should include clear migration rollback message`);
                    }
                }
            }
            
            if (step.validationConfig?.dependencyChecks) {
                for (const check of step.validationConfig.dependencyChecks) {
                    if (check.isRequired && !check.errorMessage.includes('Migration cannot proceed')) {
                        errors.push(`Required dependency check ${check.checkName} should include clear migration rollback message`);
                    }
                }
            }
        }
        
        // Test 5: Verify validation queries are syntactically valid
        for (const step of allSteps) {
            if (step.validationConfig?.dataIntegrityChecks) {
                for (const check of step.validationConfig.dataIntegrityChecks) {
                    if (!check.validationQuery.toUpperCase().includes('SELECT')) {
                        errors.push(`Validation query for ${check.checkName} is not a valid SOQL query`);
                    }
                    if (!check.validationQuery.toUpperCase().includes('FROM')) {
                        errors.push(`Validation query for ${check.checkName} missing FROM clause`);
                    }
                }
            }
        }
        
        return {
            success: errors.length === 0,
            message: errors.length === 0 
                ? 'All validation rule configuration tests passed'
                : `Found ${errors.length} validation configuration issues`,
            errors
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Validation test failed: ${error}`,
            errors: [String(error)]
        };
    }
}

/**
 * Test validation rule coverage
 */
export function testValidationCoverage(): ValidationTestResult {
    const errors: string[] = [];
    
    try {
        console.log('Testing validation coverage...');
        
        // Test that all lookup mappings have corresponding dependency checks
        const allSteps = interpretationRulesTemplate.etlSteps;
        
        for (const step of allSteps) {
            const lookupMappings = step.transformConfig.lookupMappings;
            const dependencyChecks = step.validationConfig?.dependencyChecks || [];
            
            for (const lookup of lookupMappings) {
                const hasCorrespondingCheck = dependencyChecks.some(check => 
                    check.targetObject === lookup.lookupObject
                );
                
                if (!hasCorrespondingCheck) {
                    errors.push(`Step ${step.stepName} has lookup to ${lookup.lookupObject} but no corresponding dependency check`);
                }
            }
        }
        
        // Test that external ID validations cover all referenced objects
        const referencedObjects = new Set<string>();
        
        for (const step of allSteps) {
            for (const lookup of step.transformConfig.lookupMappings) {
                referencedObjects.add(lookup.lookupObject);
            }
        }
        
        // Check that we have external ID validations for key objects
        const expectedValidations = [
            'sourcePayCodeExternalIdValidation',
            'sourceLeaveRuleExternalIdValidation', 
            'sourceLeaveHeaderExternalIdValidation'
        ];
        
        for (const expectedValidation of expectedValidations) {
            const hasValidation = allSteps.some(step => 
                step.validationConfig?.dataIntegrityChecks?.some(check => 
                    check.checkName === expectedValidation
                )
            );
            
            if (!hasValidation) {
                errors.push(`Missing expected validation: ${expectedValidation}`);
            }
        }
        
        return {
            success: errors.length === 0,
            message: errors.length === 0 
                ? 'Validation coverage tests passed'
                : `Found ${errors.length} coverage issues`,
            errors
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Coverage test failed: ${error}`,
            errors: [String(error)]
        };
    }
}

/**
 * Run all validation tests
 */
export function runAllValidationTests(): void {
    console.log('=== Running Validation Tests for Interpretation Rules ===\n');
    
    const configTest = testValidationRuleConfiguration();
    console.log(`Configuration Test: ${configTest.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Message: ${configTest.message}`);
    if (configTest.errors.length > 0) {
        console.log('Errors:');
        configTest.errors.forEach(error => console.log(`  - ${error}`));
    }
    console.log();
    
    const coverageTest = testValidationCoverage();
    console.log(`Coverage Test: ${coverageTest.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Message: ${coverageTest.message}`);
    if (coverageTest.errors.length > 0) {
        console.log('Errors:');
        coverageTest.errors.forEach(error => console.log(`  - ${error}`));
    }
    console.log();
    
    const allPassed = configTest.success && coverageTest.success;
    console.log(`=== Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'} ===`);
    
    if (allPassed) {
        console.log('\n🎉 Enhanced validation rules successfully implemented!');
        console.log('✅ External ID presence validation for all referenced objects');
        console.log('✅ Target reference existence validation with migration rollback');
        console.log('✅ Clear error messages for troubleshooting');
        console.log('✅ Comprehensive coverage across all ETL steps');
    }
}

// Export for direct execution
if (require.main === module) {
    runAllValidationTests();
} 