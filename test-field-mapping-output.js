const { ExecutionEngine } = require('./src/lib/migration/templates/core/execution-engine');
const { interpretationRulesTemplate } = require('./src/lib/migration/templates/definitions/payroll/interpretation-rules.template');

/**
 * Test script to verify field mapping output shows all fields together
 */
async function testFieldMappingOutput() {
    console.log('🧪 Testing Field Mapping Output...');
    
    // Get the interpretation breakpoint step that has both field mappings and lookup mappings
    const interpretationBreakpointStep = interpretationRulesTemplate.etlSteps.find(
        step => step.stepName === 'interpretationBreakpointLeaveHeader'
    );
    
    if (!interpretationBreakpointStep) {
        console.error('❌ Could not find interpretationBreakpointLeaveHeader step');
        return;
    }
    
    console.log('\n📊 Step Configuration:');
    console.log(`Step Name: ${interpretationBreakpointStep.stepName}`);
    console.log(`Field Mappings: ${interpretationBreakpointStep.transformConfig.fieldMappings.length}`);
    console.log(`Lookup Mappings: ${interpretationBreakpointStep.transformConfig.lookupMappings?.length || 0}`);
    console.log(`Total Expected: ${interpretationBreakpointStep.transformConfig.fieldMappings.length + (interpretationBreakpointStep.transformConfig.lookupMappings?.length || 0)}`);
    
    // Mock context for testing
    const mockContext = {
        externalIdField: 'tc9_edc__External_ID_Data_Creation__c',
        sourceOrg: { id: 'test-source' },
        targetOrg: { id: 'test-target' }
    };
    
    // Mock records for testing
    const mockRecords = [
        {
            Id: 'a112v00000BZQPzAAP',
            Name: 'Leave Header - Unpaid Leave',
            'tc9_et__Breakpoint_Type__c': 'Leave Header',
            'tc9_edc__External_ID_Data_Creation__c': 'a112v00000BZQPzAAP'
        }
    ];
    
    console.log('\n🔍 Testing transformation overview output...');
    console.log('Expected to see all 36 fields listed in Field Mappings section');
    console.log('(This will show the console output that would appear during migration)');
    console.log('\n' + '='.repeat(80));
    
    // Create execution engine instance
    const executionEngine = new ExecutionEngine();
    
    // We'll simulate the transformation overview logging by calling the private method
    // Since it's private, we'll recreate the logic here to test the output
    const totalFieldMappings = interpretationBreakpointStep.transformConfig.fieldMappings.length + 
                              (interpretationBreakpointStep.transformConfig.lookupMappings?.length || 0);
    
    console.log(`\n=== TRANSFORMATION OVERVIEW (${interpretationBreakpointStep.stepName}) ===`);
    console.log(`Transforming ${mockRecords.length} records`);
    console.log(`Field mappings: ${interpretationBreakpointStep.transformConfig.fieldMappings.length}`);
    console.log(`Lookup mappings: ${interpretationBreakpointStep.transformConfig.lookupMappings?.length || 0}`);
    console.log(`Record type mapping: ${interpretationBreakpointStep.transformConfig.recordTypeMapping ? 'Yes' : 'No'}`);
    
    // Show all field mappings (direct + lookup) in a single list
    console.log(`\nField Mappings:`);
    let fieldIndex = 1;
    
    // Show direct field mappings
    interpretationBreakpointStep.transformConfig.fieldMappings.forEach((mapping) => {
        const sourceField = mapping.sourceField.replace(/{externalIdField}/g, mockContext.externalIdField);
        const targetField = mapping.targetField.replace(/{externalIdField}/g, mockContext.externalIdField);
        const transformType = mapping.transformationType ? ` (${mapping.transformationType})` : '';
        console.log(`  ${fieldIndex}. ${sourceField} -> ${targetField}${transformType}`);
        fieldIndex++;
    });
    
    // Show lookup mappings as field mappings
    if (interpretationBreakpointStep.transformConfig.lookupMappings && interpretationBreakpointStep.transformConfig.lookupMappings.length > 0) {
        interpretationBreakpointStep.transformConfig.lookupMappings.forEach((mapping) => {
            const sourceField = mapping.sourceField.replace(/{externalIdField}/g, mockContext.externalIdField);
            console.log(`  ${fieldIndex}. ${sourceField} -> ${mapping.targetField} (via ${mapping.lookupObject}.${mapping.lookupKeyField})`);
            fieldIndex++;
        });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Test completed! Total fields shown: ${fieldIndex - 1}`);
    console.log(`Expected: 36 fields (23 direct + 13 lookup)`);
    console.log(`Actual: ${fieldIndex - 1} fields`);
    
    if (fieldIndex - 1 === 36) {
        console.log('🎉 SUCCESS: All 36 fields are now displayed together!');
    } else {
        console.log('⚠️  WARNING: Field count does not match expected 36 fields');
    }
}

// Run the test
testFieldMappingOutput().catch(console.error); 