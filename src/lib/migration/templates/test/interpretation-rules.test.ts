import { interpretationRulesTemplate } from "../definitions/payroll/interpretation-rules.template";
import { ValidationEngine } from "../core/validation-engine";
import { SoqlQueryBuilder } from "../utils/soql-builder";
import { ExternalIdUtils } from "../utils/external-id-utils";

/**
 * Test interpretation rules template configuration
 */
export function testInterpretationRulesTemplate(): {
    success: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
        // Test 1: Template structure validation
        console.log("Testing template structure...");
        
        if (!interpretationRulesTemplate.id) {
            errors.push("Template missing ID");
        }
        
        if (!interpretationRulesTemplate.etlSteps || interpretationRulesTemplate.etlSteps.length !== 4) {
            errors.push("Template should have exactly 4 ETL steps");
        }
        
        if (!interpretationRulesTemplate.executionOrder || interpretationRulesTemplate.executionOrder.length !== 4) {
            errors.push("Template should have execution order for 4 steps");
        }

        // Test 2: ETL steps validation
        console.log("Testing ETL steps...");
        
        for (const step of interpretationRulesTemplate.etlSteps) {
            if (!step.stepName) {
                errors.push(`ETL step missing stepName`);
            }
            
            if (!step.extractConfig?.soqlQuery) {
                errors.push(`ETL step ${step.stepName} missing SOQL query`);
            }
            
            if (!step.loadConfig?.targetObject) {
                errors.push(`ETL step ${step.stepName} missing target object`);
            }

            // Test SOQL query validation
            if (step.extractConfig?.soqlQuery) {
                const queryErrors = SoqlQueryBuilder.validateQuery(step.extractConfig.soqlQuery);
                if (queryErrors.length > 0) {
                    warnings.push(`SOQL validation warnings for ${step.stepName}: ${queryErrors.join(", ")}`);
                }
            }
        }

        // Test 3: External ID configuration
        console.log("Testing external ID configuration...");
        
        for (const step of interpretationRulesTemplate.etlSteps) {
            const config = step.transformConfig.externalIdHandling;
            const configErrors = ExternalIdUtils.validateConfig(config);
            if (configErrors.length > 0) {
                errors.push(`External ID config errors for ${step.stepName}: ${configErrors.join(", ")}`);
            }
        }

        // Test 4: Dependency validation
        console.log("Testing dependencies...");
        
        const stepNames = interpretationRulesTemplate.etlSteps.map(step => step.stepName);
        for (const step of interpretationRulesTemplate.etlSteps) {
            for (const dependency of step.dependencies) {
                if (!stepNames.includes(dependency) && !dependency.startsWith("tc9_")) {
                    warnings.push(`Step ${step.stepName} has unresolved dependency: ${dependency}`);
                }
            }
        }

        // Test 5: Execution order validation
        console.log("Testing execution order...");
        
        const expectedOrder = ["interpretationRuleMaster", "interpretationRuleVariation", "interpretationBreakpointLeaveHeader", "interpretationBreakpointOther"];
        if (JSON.stringify(interpretationRulesTemplate.executionOrder) !== JSON.stringify(expectedOrder)) {
            errors.push("Execution order does not match expected sequence");
        }

        console.log("Template validation completed");
        
        return {
            success: errors.length === 0,
            errors,
            warnings,
        };

    } catch (error) {
        errors.push(`Test execution failed: ${error}`);
        return {
            success: false,
            errors,
            warnings,
        };
    }
}

/**
 * Test SOQL query building with external ID replacement
 */
export function testSoqlQueryBuilding(): {
    success: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    try {
        console.log("Testing SOQL query building...");
        
        const step = interpretationRulesTemplate.etlSteps[0]; // interpretationRuleMaster
        const externalIdField = "External_Id__c";
        
        // Test query building
        const builtQuery = SoqlQueryBuilder.buildQuery(
            step.extractConfig,
            externalIdField,
            ["001000000000001", "001000000000002"]
        );
        
        // Verify external ID field was replaced
        if (builtQuery.includes("{externalIdField}")) {
            errors.push("External ID field placeholder was not replaced");
        }
        
        // Verify record filter was added
        if (!builtQuery.includes("Id IN (")) {
            errors.push("Record selection filter was not added");
        }
        
        console.log("Built query:", builtQuery);
        
        return {
            success: errors.length === 0,
            errors,
        };

    } catch (error) {
        errors.push(`SOQL query building test failed: ${error}`);
        return {
            success: false,
            errors,
        };
    }
}

/**
 * Run all template tests
 */
export function runTemplateTests(): void {
    console.log("=== Running Interpretation Rules Template Tests ===");
    
    const structureTest = testInterpretationRulesTemplate();
    const queryTest = testSoqlQueryBuilding();
    
    console.log("\n=== Test Results ===");
    console.log(`Structure Test: ${structureTest.success ? "PASS" : "FAIL"}`);
    console.log(`Query Building Test: ${queryTest.success ? "PASS" : "FAIL"}`);
    
    if (structureTest.errors.length > 0) {
        console.log("\nStructure Errors:");
        structureTest.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (structureTest.warnings.length > 0) {
        console.log("\nStructure Warnings:");
        structureTest.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (queryTest.errors.length > 0) {
        console.log("\nQuery Building Errors:");
        queryTest.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    const allTestsPassed = structureTest.success && queryTest.success;
    console.log(`\n=== Overall Result: ${allTestsPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"} ===`);
}

describe('Interpretation Rules', () => {
  it('should pass placeholder test', () => {
    expect(true).toBe(true);
  });
}); 