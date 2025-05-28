const { ValidationEngine } = require('./src/lib/migration/templates/core/validation-engine');
const { interpretationRulesTemplate } = require('./src/lib/migration/templates/definitions/payroll/interpretation-rules.template');

async function testValidation() {
    console.log('Testing Interpretation Rules Template Validation...');
    
    const validationEngine = new ValidationEngine();
    
    // Mock org IDs - replace with actual ones for real testing
    const sourceOrgId = 'test-source-org';
    const targetOrgId = 'test-target-org';
    const selectedRecords = ['a0X000000000001', 'a0X000000000002']; // Mock record IDs
    
    try {
        const result = await validationEngine.validateTemplate(
            interpretationRulesTemplate,
            sourceOrgId,
            targetOrgId,
            selectedRecords
        );
        
        console.log('\n=== VALIDATION RESULT ===');
        console.log('Is Valid:', result.isValid);
        console.log('Errors:', result.errors.length);
        console.log('Warnings:', result.warnings.length);
        console.log('Info:', result.info.length);
        
        if (result.errors.length > 0) {
            console.log('\nErrors:');
            result.errors.forEach(error => {
                console.log(`- ${error.checkName}: ${error.message}`);
            });
        }
        
        if (result.warnings.length > 0) {
            console.log('\nWarnings:');
            result.warnings.forEach(warning => {
                console.log(`- ${warning.checkName}: ${warning.message}`);
            });
        }
        
    } catch (error) {
        console.error('Validation failed:', error.message);
        console.error(error.stack);
    }
}

testValidation(); 