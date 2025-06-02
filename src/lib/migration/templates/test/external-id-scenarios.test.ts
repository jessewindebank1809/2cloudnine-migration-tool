import { ExternalIdUtils } from "../utils/external-id-utils";
import { interpretationRulesTemplate } from "../definitions/payroll/interpretation-rules.template";

/**
 * Test external ID handling scenarios for interpretation breakpoints
 */
export async function testExternalIdScenarios(): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
}> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
        console.log("Testing external ID scenarios for interpretation breakpoints...");

        // Test 1: Managed → Managed scenario
        console.log("Test 1: Managed → Managed scenario");
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

        if (managedConfig.sourceField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Managed → Managed should use managed source field");
        }
        if (managedConfig.targetField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Managed → Managed should use managed target field");
        }
        if (managedConfig.strategy === "cross-environment") {
            warnings.push("Managed → Managed detected as cross-environment (expected: same environment)");
        }

        // Test 2: Unmanaged → Unmanaged scenario
        console.log("Test 2: Unmanaged → Unmanaged scenario");
        const unmanagedSourceInfo = {
            packageType: "unmanaged" as const,
            externalIdField: "External_ID_Data_Creation__c",
            detectedFields: ["External_ID_Data_Creation__c"],
            fallbackUsed: false,
        };
        const unmanagedTargetInfo = {
            packageType: "unmanaged" as const,
            externalIdField: "External_ID_Data_Creation__c",
            detectedFields: ["External_ID_Data_Creation__c"],
            fallbackUsed: false,
        };

        const unmanagedConfig = await ExternalIdUtils.detectCrossEnvironmentMapping(
            unmanagedSourceInfo,
            unmanagedTargetInfo
        );

        if (unmanagedConfig.sourceField !== "External_ID_Data_Creation__c") {
            errors.push("Unmanaged → Unmanaged should use unmanaged source field");
        }
        if (unmanagedConfig.targetField !== "External_ID_Data_Creation__c") {
            errors.push("Unmanaged → Unmanaged should use unmanaged target field");
        }

        // Test 3: Unmanaged → Managed (cross-environment)
        console.log("Test 3: Unmanaged → Managed scenario");
        const crossEnvConfig1 = await ExternalIdUtils.detectCrossEnvironmentMapping(
            unmanagedSourceInfo,
            managedTargetInfo
        );

        if (crossEnvConfig1.sourceField !== "External_ID_Data_Creation__c") {
            errors.push("Unmanaged → Managed should use unmanaged source field");
        }
        if (crossEnvConfig1.targetField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Unmanaged → Managed should use managed target field");
        }
        if (crossEnvConfig1.strategy !== "cross-environment") {
            errors.push("Unmanaged → Managed should be detected as cross-environment");
        }

        // Test 4: Managed → Unmanaged (cross-environment)
        console.log("Test 4: Managed → Unmanaged scenario");
        const crossEnvConfig2 = await ExternalIdUtils.detectCrossEnvironmentMapping(
            managedSourceInfo,
            unmanagedTargetInfo
        );

        if (crossEnvConfig2.sourceField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Managed → Unmanaged should use managed source field");
        }
        if (crossEnvConfig2.targetField !== "External_ID_Data_Creation__c") {
            errors.push("Managed → Unmanaged should use unmanaged target field");
        }
        if (crossEnvConfig2.strategy !== "cross-environment") {
            errors.push("Managed → Unmanaged should be detected as cross-environment");
        }

        // Test 5: Template external ID placeholder consistency
        console.log("Test 5: Template external ID placeholder consistency");
        testTemplatePlaceholderConsistency(errors, warnings);

        // Test 6: Cross-environment query building
        console.log("Test 6: Cross-environment query building");
        testCrossEnvironmentQueryBuilding(errors, warnings);

        // Test 7: Interpretation breakpoint specific validations
        console.log("Test 7: Interpretation breakpoint specific validations");
        testInterpretationBreakpointSpecifics(errors, warnings);

        return {
            success: errors.length === 0,
            errors,
            warnings,
        };

    } catch (error) {
        errors.push(`External ID scenario test failed: ${error}`);
        return {
            success: false,
            errors,
            warnings,
        };
    }
}

/**
 * Test template placeholder consistency for interpretation breakpoints
 */
function testTemplatePlaceholderConsistency(errors: string[], warnings: string[]): void {
    const template = interpretationRulesTemplate;
    
    // Check that all interpretation breakpoint steps use {externalIdField} placeholders
    const breakpointSteps = template.etlSteps.filter(step => 
        step.stepName.includes('interpretationBreakpoint')
    );

    for (const step of breakpointSteps) {
        // Check SOQL queries
        if (!step.extractConfig.soqlQuery.includes('{externalIdField}')) {
            warnings.push(`Breakpoint step ${step.stepName} SOQL query missing {externalIdField} placeholder`);
        }

        // Check field mappings
        const hasExternalIdFieldMapping = step.transformConfig.fieldMappings.some(mapping =>
            mapping.sourceField.includes('{externalIdField}') || 
            mapping.targetField.includes('{externalIdField}')
        );
        if (!hasExternalIdFieldMapping) {
            warnings.push(`Breakpoint step ${step.stepName} missing external ID field mapping`);
        }

        // Check lookup mappings for pay codes and leave rules
        if (step.transformConfig.lookupMappings) {
            const payCodeLookups = step.transformConfig.lookupMappings.filter(mapping =>
                mapping.lookupObject === 'tc9_pr__Pay_Code__c'
            );
            const leaveRuleLookups = step.transformConfig.lookupMappings.filter(mapping =>
                mapping.lookupObject === 'tc9_pr__Leave_Rule__c'
            );

            for (const lookup of [...payCodeLookups, ...leaveRuleLookups]) {
                if (!lookup.sourceField.includes('{externalIdField}')) {
                    warnings.push(`Lookup ${lookup.lookupObject} in ${step.stepName} missing {externalIdField} in sourceField`);
                }
                if (!lookup.lookupKeyField.includes('{externalIdField}')) {
                    warnings.push(`Lookup ${lookup.lookupObject} in ${step.stepName} missing {externalIdField} in lookupKeyField`);
                }
            }
        }

        // Check load config
        if (!step.loadConfig.externalIdField.includes('{externalIdField}')) {
            warnings.push(`Breakpoint step ${step.stepName} load config missing {externalIdField} placeholder`);
        }
    }
}

/**
 * Test cross-environment query building
 */
function testCrossEnvironmentQueryBuilding(errors: string[], warnings: string[]): void {
    const baseQuery = "SELECT Id, tc9_et__Pay_Code__r.{externalIdField}, {externalIdField} FROM tc9_et__Interpretation_Breakpoint__c";
    
    // Test managed source query
    const managedQuery = ExternalIdUtils.buildCrossEnvironmentQuery(
        baseQuery,
        "tc9_edc__External_ID_Data_Creation__c",
        "External_ID_Data_Creation__c"
    );

    if (managedQuery.includes('{externalIdField}')) {
        errors.push("Cross-environment query building failed to replace all placeholders");
    }

    if (!managedQuery.includes('tc9_edc__External_ID_Data_Creation__c')) {
        errors.push("Cross-environment query building failed to use source external ID field");
    }

    // Test unmanaged source query
    const unmanagedQuery = ExternalIdUtils.buildCrossEnvironmentQuery(
        baseQuery,
        "External_ID_Data_Creation__c",
        "tc9_edc__External_ID_Data_Creation__c"
    );

    if (!unmanagedQuery.includes('External_ID_Data_Creation__c')) {
        errors.push("Cross-environment query building failed to use unmanaged source field");
    }

    console.log("Sample managed query:", managedQuery.substring(0, 100) + "...");
    console.log("Sample unmanaged query:", unmanagedQuery.substring(0, 100) + "...");
}

/**
 * Test interpretation breakpoint specific validations
 */
function testInterpretationBreakpointSpecifics(errors: string[], warnings: string[]): void {
    const template = interpretationRulesTemplate;
    
    // Verify that breakpoint steps have proper dependencies
    const breakpointSteps = template.etlSteps.filter(step => 
        step.stepName.includes('interpretationBreakpoint')
    );

    for (const step of breakpointSteps) {
        // Check dependencies include interpretation rules
        const hasInterpretationRuleDependency = step.dependencies.some(dep =>
            dep.includes('interpretationRule') || dep === 'interpretationRuleMaster'
        );
        
        if (!hasInterpretationRuleDependency) {
            warnings.push(`Breakpoint step ${step.stepName} missing interpretation rule dependency`);
        }

        // Check for pay code and leave rule dependency validation
        if (step.validationConfig?.dependencyChecks) {
            const hasPayCodeCheck = step.validationConfig.dependencyChecks.some(check =>
                check.targetObject === 'tc9_pr__Pay_Code__c'
            );
            const hasLeaveRuleCheck = step.validationConfig.dependencyChecks.some(check =>
                check.targetObject === 'tc9_pr__Leave_Rule__c'
            );

            if (!hasPayCodeCheck) {
                warnings.push(`Breakpoint step ${step.stepName} missing pay code dependency validation`);
            }
            if (!hasLeaveRuleCheck) {
                warnings.push(`Breakpoint step ${step.stepName} missing leave rule dependency validation`);
            }
        }
    }

    // Verify execution order places breakpoints after interpretation rules
    const executionOrder = template.executionOrder;
    const ruleStepIndex = executionOrder.findIndex(step => step.includes('interpretationRule'));
    const breakpointStepIndex = executionOrder.findIndex(step => step.includes('interpretationBreakpoint'));

    if (ruleStepIndex === -1) {
        errors.push("Interpretation rule step not found in execution order");
    }
    if (breakpointStepIndex === -1) {
        errors.push("Interpretation breakpoint step not found in execution order");
    }
    if (ruleStepIndex >= breakpointStepIndex) {
        errors.push("Interpretation breakpoint steps should execute after interpretation rule steps");
    }
}

/**
 * Test external ID field detection and configuration
 */
export function testExternalIdFieldDetection(): {
    success: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    try {
        console.log("Testing external ID field detection...");

        // Test default config creation
        const defaultConfig = ExternalIdUtils.createDefaultConfig();
        
        if (defaultConfig.managedField !== "tc9_edc__External_ID_Data_Creation__c") {
            errors.push("Default config should use correct managed field");
        }
        if (defaultConfig.unmanagedField !== "External_ID_Data_Creation__c") {
            errors.push("Default config should use correct unmanaged field");
        }
        if (defaultConfig.fallbackField !== "External_Id__c") {
            errors.push("Default config should use correct fallback field");
        }

        // Test config validation
        const validConfig = {
            sourceField: "tc9_edc__External_ID_Data_Creation__c",
            targetField: "tc9_edc__External_ID_Data_Creation__c",
            managedField: "tc9_edc__External_ID_Data_Creation__c",
            unmanagedField: "External_ID_Data_Creation__c",
            fallbackField: "External_Id__c",
            strategy: "auto-detect" as const
        };

        const validationErrors = ExternalIdUtils.validateConfig(validConfig);
        if (validationErrors.length > 0) {
            errors.push(`Valid config failed validation: ${validationErrors.join(", ")}`);
        }

        // Test invalid config validation
        const invalidConfig = {
            sourceField: "",
            targetField: "",
            managedField: "",
            unmanagedField: "",
            fallbackField: "",
            strategy: "invalid" as any
        };

        const invalidValidationErrors = ExternalIdUtils.validateConfig(invalidConfig);
        if (invalidValidationErrors.length === 0) {
            errors.push("Invalid config should fail validation");
        }

        return {
            success: errors.length === 0,
            errors,
        };

    } catch (error) {
        errors.push(`External ID field detection test failed: ${error}`);
        return {
            success: false,
            errors,
        };
    }
}

/**
 * Run all external ID scenario tests
 */
export async function runExternalIdTests(): Promise<void> {
    console.log("=== External ID Scenario Tests ===\n");

    // Test 1: External ID scenarios
    console.log("Running external ID scenarios test...");
    const scenarioResults = await testExternalIdScenarios();
    
    if (scenarioResults.success) {
        console.log("✅ External ID scenarios test PASSED");
    } else {
        console.log("❌ External ID scenarios test FAILED");
        scenarioResults.errors.forEach((error: string) => console.log(`  - ${error}`));
    }
    
    if (scenarioResults.warnings.length > 0) {
        console.log("⚠️  Warnings:");
        scenarioResults.warnings.forEach((warning: string) => console.log(`  - ${warning}`));
    }

    // Test 2: Field detection
    console.log("\nRunning external ID field detection test...");
    const detectionResults = testExternalIdFieldDetection();
    
    if (detectionResults.success) {
        console.log("✅ External ID field detection test PASSED");
    } else {
        console.log("❌ External ID field detection test FAILED");
        detectionResults.errors.forEach((error: string) => console.log(`  - ${error}`));
    }

    // Summary
    const allPassed = scenarioResults.success && detectionResults.success;
    console.log(`\n=== Test Summary ===`);
    console.log(`Overall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`Total errors: ${scenarioResults.errors.length + detectionResults.errors.length}`);
    console.log(`Total warnings: ${scenarioResults.warnings.length}`);

    if (allPassed) {
        console.log("\n🎉 External ID handling is correctly configured for all scenarios:");
        console.log("  • Managed → Managed migrations");
        console.log("  • Unmanaged → Unmanaged migrations");
        console.log("  • Cross-environment migrations (Unmanaged ↔ Managed)");
        console.log("  • Interpretation breakpoint consistency");
        console.log("  • Pay code and leave rule lookup handling");
    }
} 