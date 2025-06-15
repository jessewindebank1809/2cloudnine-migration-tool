class TestData {
  static get users() {
    return {
      admin: {
        username: process.env.TEST_SALESFORCE_SOURCE_USERNAME,
        password: process.env.TEST_SALESFORCE_SOURCE_PASSWORD
      },
      target: {
        username: process.env.TEST_SALESFORCE_TARGET_USERNAME,
        password: process.env.TEST_SALESFORCE_TARGET_PASSWORD
      }
    };
  }

  static get migration() {
    return {
      project: {
        name: 'Test Migration Project',
        description: 'Automated test migration'
      },
      objects: [
        'Contact',
        'Account',
        'Custom_Object__c'
      ],
      recordCount: 100
    };
  }

  static get templates() {
    return {
      payroll: {
        name: 'Payroll Migration Template',
        objects: ['Employee__c', 'PayRate__c', 'Deduction__c']
      },
      product: {
        name: 'Product Migration Template',
        objects: ['Product2', 'PricebookEntry']
      }
    };
  }

  static createMigrationProject() {
    return {
      name: `Test_Migration_${Date.now()}`,
      description: 'E2E test migration project',
      sourceOrg: 'Test Source Org',
      targetOrg: 'Test Target Org',
      objects: this.migration.objects
    };
  }

  static createTestRecords(count = 10) {
    return Array.from({ length: count }, (_, i) => ({
      Name: `Test Record ${i + 1}`,
      Email: `test${i + 1}@example.com`,
      Status: 'Active'
    }));
  }

  static generateLargeDataset(recordCount = 1000) {
    return Array.from({ length: recordCount }, (_, i) => ({
      Name: `Performance Test Record ${i + 1}`,
      Description: `Test record for performance testing - ${i + 1}`,
      Value: Math.floor(Math.random() * 10000),
      Date: new Date().toISOString()
    }));
  }
}

module.exports = TestData;