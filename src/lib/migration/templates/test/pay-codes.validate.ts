import { payCodesTemplate, payCodesTemplateHooks } from "../definitions/payroll/pay-codes.template";
import { ValidationEngine } from "../core/validation-engine";
import { SoqlQueryBuilder } from "../utils/soql-builder";
import { ExternalIdUtils } from "../utils/external-id-utils";

/**
 * Test pay codes template configuration
 */
export function testPayCodesTemplate(): {
    success: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
        // Test 1: Template structure validation
        console.log("Testing template structure...");
        
        if (!payCodesTemplate.id) {
            errors.push("Template missing ID");
        } else if (payCodesTemplate.id !== "payroll-pay-codes") {
            errors.push(`Template ID should be 'payroll-pay-codes', got '${payCodesTemplate.id}'`);
        }
        
        if (!payCodesTemplate.name) {
            errors.push("Template missing name");
        }
        
        if (!payCodesTemplate.category || payCodesTemplate.category !== "payroll") {
            errors.push("Template should have category 'payroll'");
        }
        
        if (!payCodesTemplate.version) {
            errors.push("Template missing version");
        }
        
        if (!payCodesTemplate.etlSteps || payCodesTemplate.etlSteps.length !== 1) {
            errors.push("Template should have exactly 1 ETL step");
        }
        
        if (!payCodesTemplate.executionOrder || payCodesTemplate.executionOrder.length !== 1) {
            errors.push("Template should have execution order for 1 step");
        }

        // Test 2: ETL step validation
        console.log("Testing ETL step configuration...");
        
        const step = payCodesTemplate.etlSteps[0];
        
        if (!step) {
            errors.push("ETL step is undefined");
        } else {
            if (step.stepName !== "payCodeMaster") {
                errors.push(`ETL step name should be 'payCodeMaster', got '${step.stepName}'`);
            }
            
            if (!step.extractConfig) {
                errors.push("ETL step missing extract configuration");
            } else {
                if (!step.extractConfig.soqlQuery) {
                    errors.push("Extract config missing SOQL query");
                } else {
                    // Validate SOQL query structure
                    const query = step.extractConfig.soqlQuery.toLowerCase();
                    if (!query.includes("select")) {
                        errors.push("SOQL query missing SELECT clause");
                    }
                    if (!query.includes("from tc9_pr__pay_code__c")) {
                        errors.push("SOQL query should query from tc9_pr__Pay_Code__c");
                    }
                }
                
                if (step.extractConfig.objectApiName !== "tc9_pr__Pay_Code__c") {
                    errors.push("Extract config objectApiName should be 'tc9_pr__Pay_Code__c'");
                }
                
                if (!step.extractConfig.batchSize || step.extractConfig.batchSize < 1) {
                    errors.push("Extract config should have valid batchSize");
                }
            }
            
            if (!step.transformConfig) {
                errors.push("ETL step missing transform configuration");
            } else {
                if (!step.transformConfig.fieldMappings || step.transformConfig.fieldMappings.length === 0) {
                    errors.push("Transform config missing field mappings");
                } else {
                    // Test field mappings
                    const requiredFields = ["Name", "tc9_pr__Code__c"];
                    const mappedTargetFields = step.transformConfig.fieldMappings
                        .map(m => m.targetField)
                        .filter(f => f !== "{externalIdField}");
                    
                    for (const field of requiredFields) {
                        if (!mappedTargetFields.includes(field)) {
                            errors.push(`Missing required field mapping for '${field}'`);
                        }
                    }
                    
                    // Validate each field mapping
                    for (const mapping of step.transformConfig.fieldMappings) {
                        if (!mapping.sourceField) {
                            errors.push("Field mapping missing sourceField");
                        }
                        if (!mapping.targetField) {
                            errors.push("Field mapping missing targetField");
                        }
                        if (mapping.transformationType !== "direct") {
                            warnings.push(`Field mapping '${mapping.sourceField}' uses non-direct transformation`);
                        }
                    }
                }
            }
            
            if (!step.loadConfig) {
                errors.push("ETL step missing load configuration");
            } else {
                if (step.loadConfig.targetObject !== "tc9_pr__Pay_Code__c") {
                    errors.push("Load config targetObject should be 'tc9_pr__Pay_Code__c'");
                }
                
                if (step.loadConfig.operation !== "upsert") {
                    errors.push("Load config operation should be 'upsert'");
                }
                
                if (!step.loadConfig.externalIdField) {
                    errors.push("Load config missing externalIdField");
                }
                
                if (!step.loadConfig.retryConfig) {
                    errors.push("Load config missing retry configuration");
                }
            }
            
            if (!step.validationConfig) {
                errors.push("ETL step missing validation configuration");
            } else {
                if (!step.validationConfig.dependencyChecks) {
                    errors.push("Validation config missing dependency checks");
                }
                
                if (!step.validationConfig.picklistValidationChecks) {
                    errors.push("Validation config missing picklist validation checks");
                }
                
                if (!step.validationConfig.dataIntegrityChecks || step.validationConfig.dataIntegrityChecks.length === 0) {
                    errors.push("Validation config missing data integrity checks");
                } else {
                    // Test essential data integrity checks
                    const requiredIntegrityChecks = [
                        "name-required",
                        "code-required",
                        "code-uniqueness"
                    ];
                    
                    for (const checkName of requiredIntegrityChecks) {
                        const found = step.validationConfig.dataIntegrityChecks.some(
                            check => check.checkName === checkName
                        );
                        
                        if (!found) {
                            errors.push(`Missing data integrity check: '${checkName}'`);
                        }
                    }
                }
                
                // Test picklist validation checks
                if (step.validationConfig.picklistValidationChecks && step.validationConfig.picklistValidationChecks.length > 0) {
                    const requiredPicklistFields = ["tc9_pr__Type__c", "tc9_pr__Status__c"];
                    
                    for (const fieldName of requiredPicklistFields) {
                        const found = step.validationConfig.picklistValidationChecks.some(
                            check => check.fieldName === fieldName
                        );
                        
                        if (!found) {
                            errors.push(`Missing picklist validation for field '${fieldName}'`);
                        }
                    }
                }
            }
        }

        // Test 3: Execution order validation
        console.log("Testing execution order...");
        
        if (payCodesTemplate.executionOrder[0] !== "payCodeMaster") {
            errors.push("Execution order should contain 'payCodeMaster'");
        }

        // Test 4: Metadata validation
        console.log("Testing metadata...");
        
        if (!payCodesTemplate.metadata) {
            errors.push("Template missing metadata");
        } else {
            if (!payCodesTemplate.metadata.author) {
                errors.push("Metadata missing author");
            }
            if (!payCodesTemplate.metadata.complexity) {
                errors.push("Metadata missing complexity");
            }
        }

        // Test 5: Hooks validation (from separate export)
        console.log("Testing hooks...");
        
        if (!payCodesTemplateHooks) {
            errors.push("Template hooks not exported");
        } else {
            if (!payCodesTemplateHooks.preMigration) {
                errors.push("Template missing preMigration hook");
            }
        }

        // Test 7: Field coverage validation
        console.log("Testing field coverage...");
        
        const essentialFields = ["Name", "tc9_pr__Code__c", "tc9_pr__Type__c", "tc9_pr__Status__c", "tc9_pr__Rate__c"];
        const step0 = payCodesTemplate.etlSteps[0];
        
        if (step0?.extractConfig?.soqlQuery) {
            const queryLower = step0.extractConfig.soqlQuery.toLowerCase();
            for (const field of essentialFields) {
                if (!queryLower.includes(field.toLowerCase())) {
                    errors.push(`SOQL query missing essential field '${field}'`);
                }
            }
        }

        // Test 8: Validation severity levels
        console.log("Testing validation severity levels...");
        
        if (step0?.validationConfig?.dataIntegrityChecks) {
            const requiredFieldChecks = step0.validationConfig.dataIntegrityChecks.filter(
                check => check.checkName.includes("required")
            );
            
            for (const check of requiredFieldChecks) {
                if (check.severity !== "error") {
                    errors.push(`Required field check '${check.checkName}' should have severity 'error'`);
                }
            }
            
            if (step0.validationConfig.picklistValidationChecks) {
                for (const check of step0.validationConfig.picklistValidationChecks) {
                    if (check.severity !== "warning") {
                        warnings.push(`Picklist check for '${check.fieldName}' should have severity 'warning'`);
                    }
                }
            }
        }

        // Summary
        const success = errors.length === 0;
        
        console.log("\n=== Pay Codes Template Test Summary ===");
        console.log(`Success: ${success}`);
        console.log(`Errors: ${errors.length}`);
        console.log(`Warnings: ${warnings.length}`);
        
        if (errors.length > 0) {
            console.log("\nErrors:");
            errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (warnings.length > 0) {
            console.log("\nWarnings:");
            warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        return { success, errors, warnings };
        
    } catch (error) {
        errors.push(`Unexpected error during validation: ${error}`);
        return { success: false, errors, warnings };
    }
}

// Run test if called directly
if (require.main === module) {
    testPayCodesTemplate();
}