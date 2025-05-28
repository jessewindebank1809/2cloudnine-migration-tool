const puppeteer = require('puppeteer');

/**
 * End-to-End Test for Migration Results Validation
 * This test validates that migration results are displayed correctly
 */
class MigrationResultsValidator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async setup() {
    console.log('🚀 Setting up browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      defaultViewport: null,
      args: ['--start-maximized'],
      slowMo: 100 // Slow down for debugging
    });
    
    // Enable console logging from the page
    this.page.on('console', msg => {
      if (msg.text().includes('DEBUGGING RECORD RESULTS')) {
        console.log('📊 Page Console:', msg.text());
      }
    });

    // Navigate to the application
    await this.page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
  }

  async navigateToMigrationBuilder() {
    console.log('📍 Navigating to migration builder...');
    await this.page.goto('http://localhost:3000/migrations/new', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await this.page.screenshot({ 
      path: 'screenshots/test-01-migration-builder.png', 
      fullPage: true 
    });
  }

  async performMigrationSteps(steps) {
    console.log('🔄 Performing migration steps...');
    
    for (const [index, step] of steps.entries()) {
      console.log(`📝 Step ${index + 1}: ${step.description}`);
      
      try {
        await step.action(this.page);
        await this.page.screenshot({ 
          path: `screenshots/test-step-${index + 1}-${step.name}.png`, 
          fullPage: true 
        });
        
        // Wait for any loading states
        await this.page.waitForTimeout(1000);
        
      } catch (error) {
        console.error(`❌ Step ${index + 1} failed:`, error.message);
        this.testResults.errors.push({
          step: step.name,
          error: error.message
        });
      }
    }
  }

  async validateMigrationResults(expectedResults) {
    console.log('🔍 Validating migration results...');
    
    // Wait for results to load
    await this.page.waitForSelector('[data-testid="migration-results"]', { 
      timeout: 60000 
    });

    // Extract actual results from the page
    const actualResults = await this.page.evaluate(() => {
      const results = {
        totalSuccessful: 0,
        totalFailed: 0,
        records: []
      };

      // Get overall totals
      const successElement = document.querySelector('[data-testid="total-successful"]');
      const failedElement = document.querySelector('[data-testid="total-failed"]');
      
      if (successElement) results.totalSuccessful = parseInt(successElement.textContent);
      if (failedElement) results.totalFailed = parseInt(failedElement.textContent);

      // Get individual record results
      const recordElements = document.querySelectorAll('[data-testid="record-result"]');
      recordElements.forEach(element => {
        const sourceId = element.getAttribute('data-source-id');
        const successText = element.querySelector('[data-testid="record-successful"]')?.textContent;
        const failedText = element.querySelector('[data-testid="record-failed"]')?.textContent;
        
        results.records.push({
          sourceId,
          successful: successText ? parseInt(successText.replace(' successful', '')) : 0,
          failed: failedText ? parseInt(failedText.replace(' failed', '')) : 0
        });
      });

      return results;
    });

    // Validate results
    this.validateTotals(actualResults, expectedResults);
    this.validateIndividualRecords(actualResults.records, expectedResults.records);
    
    return actualResults;
  }

  validateTotals(actual, expected) {
    console.log('📊 Validating totals...');
    
    if (actual.totalSuccessful === expected.totalSuccessful) {
      console.log(`✅ Total successful matches: ${actual.totalSuccessful}`);
      this.testResults.passed++;
    } else {
      console.log(`❌ Total successful mismatch: expected ${expected.totalSuccessful}, got ${actual.totalSuccessful}`);
      this.testResults.failed++;
      this.testResults.errors.push({
        test: 'Total Successful',
        expected: expected.totalSuccessful,
        actual: actual.totalSuccessful
      });
    }

    if (actual.totalFailed === expected.totalFailed) {
      console.log(`✅ Total failed matches: ${actual.totalFailed}`);
      this.testResults.passed++;
    } else {
      console.log(`❌ Total failed mismatch: expected ${expected.totalFailed}, got ${actual.totalFailed}`);
      this.testResults.failed++;
      this.testResults.errors.push({
        test: 'Total Failed',
        expected: expected.totalFailed,
        actual: actual.totalFailed
      });
    }
  }

  validateIndividualRecords(actualRecords, expectedRecords) {
    console.log('📋 Validating individual records...');
    
    expectedRecords.forEach(expectedRecord => {
      const actualRecord = actualRecords.find(r => r.sourceId === expectedRecord.sourceId);
      
      if (!actualRecord) {
        console.log(`❌ Record not found: ${expectedRecord.sourceId}`);
        this.testResults.failed++;
        return;
      }

      if (actualRecord.successful === expectedRecord.successful) {
        console.log(`✅ Record ${expectedRecord.sourceId} successful count matches: ${actualRecord.successful}`);
        this.testResults.passed++;
      } else {
        console.log(`❌ Record ${expectedRecord.sourceId} successful mismatch: expected ${expectedRecord.successful}, got ${actualRecord.successful}`);
        this.testResults.failed++;
        this.testResults.errors.push({
          test: `Record ${expectedRecord.sourceId} Successful`,
          expected: expectedRecord.successful,
          actual: actualRecord.successful
        });
      }

      if (actualRecord.failed === expectedRecord.failed) {
        console.log(`✅ Record ${expectedRecord.sourceId} failed count matches: ${actualRecord.failed}`);
        this.testResults.passed++;
      } else {
        console.log(`❌ Record ${expectedRecord.sourceId} failed mismatch: expected ${expectedRecord.failed}, got ${actualRecord.failed}`);
        this.testResults.failed++;
        this.testResults.errors.push({
          test: `Record ${expectedRecord.sourceId} Failed`,
          expected: expectedRecord.failed,
          actual: actualRecord.failed
        });
      }
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test || error.step}: ${error.error || `Expected ${error.expected}, got ${error.actual}`}`);
      });
    }
    
    console.log(`\n🎯 Success Rate: ${(this.testResults.passed / (this.testResults.passed + this.testResults.failed) * 100).toFixed(1)}%`);
  }
}

// Test configuration for your specific scenario
const testConfig = {
  expectedResults: {
    totalSuccessful: 203, // 94 + 1 + 109 + 1 (child records + parent records)
    totalFailed: 0,
    records: [
      {
        sourceId: 'a149j00000jcCxVAAU', // Your first record ID
        successful: 95, // 94 child + 1 parent
        failed: 0
      },
      {
        sourceId: 'a149j00000ji3ZRAAY', // Your second record ID  
        successful: 110, // 109 child + 1 parent
        failed: 0
      }
    ]
  },
  migrationSteps: [
    {
      name: 'select-template',
      description: 'Select migration template',
      action: async (page) => {
        // Add your specific steps here
        await page.waitForSelector('[data-testid="template-selector"]');
        await page.click('[data-testid="template-selector"]');
      }
    },
    {
      name: 'select-records',
      description: 'Select records for migration',
      action: async (page) => {
        // Add your specific record selection steps
        await page.waitForSelector('[data-testid="record-selector"]');
        // Select your specific records
      }
    },
    {
      name: 'execute-migration',
      description: 'Execute the migration',
      action: async (page) => {
        await page.click('[data-testid="execute-migration"]');
        // Wait for migration to complete
        await page.waitForSelector('[data-testid="migration-results"]', { timeout: 120000 });
      }
    }
  ]
};

// Main test function
async function runMigrationResultsTest() {
  const validator = new MigrationResultsValidator();
  
  try {
    await validator.setup();
    await validator.navigateToMigrationBuilder();
    await validator.performMigrationSteps(testConfig.migrationSteps);
    await validator.validateMigrationResults(testConfig.expectedResults);
    
  } catch (error) {
    console.error('🚨 Test execution failed:', error);
    validator.testResults.errors.push({
      test: 'Test Execution',
      error: error.message
    });
  } finally {
    validator.printResults();
    await validator.cleanup();
  }
}

// Export for use in other tests
module.exports = { MigrationResultsValidator, runMigrationResultsTest };

// Run if called directly
if (require.main === module) {
  runMigrationResultsTest().catch(console.error);
}
