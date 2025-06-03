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
 * Test cross-environment external ID handling for all scenarios
 */
export async function testCrossEnvironmentExternalIdHandling(): Promise<{
    success: boolean;
    errors: string[];
}> {
    const errors: string[] = [];

    try {
        console.log("Testing cross-environment external ID handling...");

        // Test 1: Managed → Managed (same environment)
        console.log("Testing Managed → Managed scenario...");
        const managedSourceInfo = {
            packageType: "managed" as const,
            externalIdField: "tc9_edc__External_ID_Data_Creation__c",
            detectedFields: ["tc9_edc__External_ID_Data_Creation__c"],
            fallbackUsed: false,
        };
        const managedTargetInfo = {
            packageType: "managed" as const,
            externalIdField: "tc9_edc__External_ID_Data_Creation__c",
            detectedFields: ["tc9_edc__External_ID_Data_Creation__c"],
            fallbackUsed: false,
        };
        
        const managedConfig = await ExternalIdUtils.detectCrossEnvironmentMapping(
            managedSourceInfo,
            managedTargetInfo
        );
        
        if (managedConfig.strategy !== "auto-detect") {
            errors.push("Managed → Managed should use auto-detect strategy");
        }
        if (managedConfig.sourceField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Managed → Managed source field incorrect");
        }
        if (managedConfig.targetField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Managed → Managed target field incorrect");
        }

        // Test 2: Unmanaged → Managed (cross-environment)
        console.log("Testing Unmanaged → Managed scenario...");
        const unmanagedSourceInfo = {
            packageType: "unmanaged" as const,
            externalIdField: "External_ID_Data_Creation__c",
            detectedFields: ["External_ID_Data_Creation__c"],
            fallbackUsed: false,
        };
        
        const unmanagedToManagedConfig = await ExternalIdUtils.detectCrossEnvironmentMapping(
            unmanagedSourceInfo,
            managedTargetInfo
        );
        
        if (unmanagedToManagedConfig.strategy !== "cross-environment") {
            errors.push("Unmanaged → Managed should use cross-environment strategy");
        }
        if (unmanagedToManagedConfig.sourceField !== "External_ID_Data_Creation__c") {
            errors.push("Unmanaged → Managed source field incorrect");
        }
        if (unmanagedToManagedConfig.targetField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Unmanaged → Managed target field incorrect");
        }
        if (!unmanagedToManagedConfig.crossEnvironmentMapping) {
            errors.push("Unmanaged → Managed should have cross-environment mapping config");
        }

        // Test 3: Managed → Unmanaged (cross-environment)
        console.log("Testing Managed → Unmanaged scenario...");
        const unmanagedTargetInfo = {
            packageType: "unmanaged" as const,
            externalIdField: "External_ID_Data_Creation__c",
            detectedFields: ["External_ID_Data_Creation__c"],
            fallbackUsed: false,
        };
        
        const managedToUnmanagedConfig = await ExternalIdUtils.detectCrossEnvironmentMapping(
            managedSourceInfo,
            unmanagedTargetInfo
        );
        
        if (managedToUnmanagedConfig.strategy !== "cross-environment") {
            errors.push("Managed → Unmanaged should use cross-environment strategy");
        }
        if (managedToUnmanagedConfig.sourceField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Managed → Unmanaged source field incorrect");
        }
        if (managedToUnmanagedConfig.targetField !== "External_ID_Data_Creation__c") {
            errors.push("Managed → Unmanaged target field incorrect");
        }
        if (!managedToUnmanagedConfig.crossEnvironmentMapping) {
            errors.push("Managed → Unmanaged should have cross-environment mapping config");
        }

        // Test 4: Cross-environment query building
        console.log("Testing cross-environment query building...");
        const baseQuery = "SELECT Id, Name, {externalIdField}, tc9_et__Pay_Code__r.{externalIdField} FROM tc9_et__Interpretation_Rule__c";
        
        const crossEnvQuery = ExternalIdUtils.buildCrossEnvironmentQuery(
            baseQuery,
            "External_ID_Data_Creation__c", // source field
            "tc9_edc__External_ID_Data_Creation__c" // target field
        );
        
        // Should replace {externalIdField} with source field
        if (!crossEnvQuery.includes("External_ID_Data_Creation__c")) {
            errors.push("Cross-environment query should include source external ID field");
        }
        
        // Should replace relationship field placeholders with source external ID field only
        if (!crossEnvQuery.includes("tc9_et__Pay_Code__r.External_ID_Data_Creation__c")) {
            errors.push("Cross-environment query should use source external ID field for relationships");
        }
        
        // Should NOT include the multiple external ID field approach (this was the bug)
        if (crossEnvQuery.includes("tc9_edc__External_ID_Data_Creation__c, tc9_et__Pay_Code__r.External_ID_Data_Creation__c, tc9_et__Pay_Code__r.External_Id__c")) {
            errors.push("Cross-environment query should not include multiple external ID field variations (this was the bug)");
        }

        console.log("Cross-environment query:", crossEnvQuery);

        // Test 5: Compatibility validation
        console.log("Testing cross-environment compatibility validation...");
        const validation = ExternalIdUtils.validateCrossEnvironmentCompatibility(
            unmanagedSourceInfo,
            managedTargetInfo
        );
        
        if (!validation.crossEnvironmentDetected) {
            errors.push("Cross-environment migration should be detected");
        }
        
        if (validation.potentialIssues.length === 0) {
            errors.push("Cross-environment migration should have potential issues reported");
        }
        
        if (validation.recommendations.length === 0) {
            errors.push("Cross-environment migration should have recommendations");
        }

        console.log("Cross-environment external ID handling tests completed");
        
        return {
            success: errors.length === 0,
            errors,
        };

    } catch (error) {
        errors.push(`Cross-environment external ID test failed: ${error}`);
        return {
            success: false,
            errors,
        };
    }
}

/**
 * Run all template tests
 */
export async function runTemplateTests(): Promise<void> {
    console.log("=== Running Interpretation Rules Template Tests ===");
    
    const structureTest = testInterpretationRulesTemplate();
    const queryTest = testSoqlQueryBuilding();
    const crossEnvTest = await testCrossEnvironmentExternalIdHandling();
    
    console.log("\n=== Test Results ===");
    console.log(`Structure Test: ${structureTest.success ? "PASS" : "FAIL"}`);
    console.log(`Query Building Test: ${queryTest.success ? "PASS" : "FAIL"}`);
    console.log(`Cross-Environment Test: ${crossEnvTest.success ? "PASS" : "FAIL"}`);
    
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
    
    if (crossEnvTest.errors.length > 0) {
        console.log("\nCross-Environment Errors:");
        crossEnvTest.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    const allTestsPassed = structureTest.success && queryTest.success && crossEnvTest.success;
    console.log(`\n=== Overall Result: ${allTestsPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"} ===`);
}

describe('Interpretation Rules', () => {
  it('should pass placeholder test', () => {
    expect(true).toBe(true);
  });

  it('should handle all cross-environment external ID scenarios', async () => {
    const result = await testCrossEnvironmentExternalIdHandling();
    if (!result.success) {
      console.error('Cross-environment test errors:', result.errors);
    }
    expect(result.success).toBe(true);
  });
}); 