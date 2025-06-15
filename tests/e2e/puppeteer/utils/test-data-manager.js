const TestConfig = require('./test-config');

class TestDataManager {
  static async createTestDatabase() {
    console.log('Setting up test database...');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: TestConfig.database.url
        }
      }
    });

    try {
      await prisma.$connect();
      console.log('Test database connected successfully');
      return prisma;
    } catch (error) {
      console.error('Failed to connect to test database:', error);
      throw error;
    }
  }

  static async seedTestData(prisma) {
    console.log('Seeding test data...');

    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        salesforceId: 'test_sf_id_001'
      }
    });

    const testOrg = await prisma.organization.upsert({
      where: { salesforceOrgId: 'test_org_001' },
      update: {},
      create: {
        name: 'Test Source Org',
        salesforceOrgId: 'test_org_001',
        instanceUrl: 'https://test.salesforce.com',
        userId: testUser.id
      }
    });

    const targetOrg = await prisma.organization.upsert({
      where: { salesforceOrgId: 'test_org_002' },
      update: {},
      create: {
        name: 'Test Target Org',
        salesforceOrgId: 'test_org_002',
        instanceUrl: 'https://test-target.salesforce.com',
        userId: testUser.id
      }
    });

    const testTemplate = await prisma.migrationTemplate.upsert({
      where: { name: 'Test Payroll Template' },
      update: {},
      create: {
        name: 'Test Payroll Template',
        description: 'Test template for payroll migration',
        category: 'Payroll',
        configuration: {
          objects: ['Employee__c', 'PayRate__c'],
          mappings: [
            { source: 'Employee__c.Name', target: 'Employee__c.Name' },
            { source: 'Employee__c.Email__c', target: 'Employee__c.Email__c' }
          ]
        }
      }
    });

    console.log('Test data seeded successfully');
    return { testUser, testOrg, targetOrg, testTemplate };
  }

  static async cleanupTestData(prisma) {
    console.log('Cleaning up test data...');

    await prisma.migrationLog.deleteMany({
      where: {
        migration: {
          name: {
            startsWith: 'Test_'
          }
        }
      }
    });

    await prisma.migration.deleteMany({
      where: {
        name: {
          startsWith: 'Test_'
        }
      }
    });

    await prisma.migrationTemplate.deleteMany({
      where: {
        name: {
          startsWith: 'Test'
        }
      }
    });

    await prisma.organization.deleteMany({
      where: {
        salesforceOrgId: {
          startsWith: 'test_'
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@example.com'
        }
      }
    });

    console.log('Test data cleanup completed');
  }

  static async createTestMigration(prisma, userId, sourceOrgId, targetOrgId) {
    const migration = await prisma.migration.create({
      data: {
        name: `Test_Migration_${Date.now()}`,
        description: 'E2E test migration',
        status: 'DRAFT',
        sourceOrgId: sourceOrgId,
        targetOrgId: targetOrgId,
        userId: userId,
        configuration: {
          objects: ['Contact', 'Account'],
          batchSize: 200,
          includeInactive: false
        }
      }
    });

    return migration;
  }

  static async createTestRecords(count = 100) {
    const records = [];
    
    for (let i = 1; i <= count; i++) {
      records.push({
        Name: `Test Record ${i}`,
        Email: `test${i}@example.com`,
        Phone: `555-000-${i.toString().padStart(4, '0')}`,
        Department: ['Engineering', 'Sales', 'Marketing', 'Support'][i % 4],
        Status__c: ['Active', 'Inactive'][i % 2],
        Created_Date__c: new Date().toISOString(),
        Test_Number__c: Math.floor(Math.random() * 10000),
        Test_Boolean__c: i % 2 === 0
      });
    }

    return records;
  }

  static async setupPerformanceTestData(prisma, recordCount = 10000) {
    console.log(`Setting up performance test data with ${recordCount} records...`);

    const performanceUser = await prisma.user.upsert({
      where: { email: 'performance@example.com' },
      update: {},
      create: {
        email: 'performance@example.com',
        name: 'Performance Test User',
        salesforceId: 'perf_sf_id_001'
      }
    });

    const performanceOrg = await prisma.organization.upsert({
      where: { salesforceOrgId: 'perf_org_001' },
      update: {},
      create: {
        name: 'Performance Test Org',
        salesforceOrgId: 'perf_org_001',
        instanceUrl: 'https://performance.salesforce.com',
        userId: performanceUser.id
      }
    });

    const performanceMigration = await prisma.migration.create({
      data: {
        name: `Performance_Test_${Date.now()}`,
        description: `Performance test migration with ${recordCount} records`,
        status: 'DRAFT',
        sourceOrgId: performanceOrg.id,
        targetOrgId: performanceOrg.id,
        userId: performanceUser.id,
        configuration: {
          objects: ['Contact'],
          batchSize: 1000,
          recordCount: recordCount
        }
      }
    });

    console.log('Performance test data setup completed');
    return { performanceUser, performanceOrg, performanceMigration };
  }

  static async verifyTestDataIntegrity(prisma) {
    const userCount = await prisma.user.count({
      where: {
        email: {
          endsWith: '@example.com'
        }
      }
    });

    const orgCount = await prisma.organization.count({
      where: {
        salesforceOrgId: {
          startsWith: 'test_'
        }
      }
    });

    const migrationCount = await prisma.migration.count({
      where: {
        name: {
          startsWith: 'Test_'
        }
      }
    });

    return {
      users: userCount,
      organizations: orgCount,
      migrations: migrationCount,
      isValid: userCount > 0 && orgCount > 0
    };
  }

  static generateTestSalesforceData(objectType, count = 100) {
    const data = [];
    
    const generators = {
      Contact: (i) => ({
        FirstName: `TestFirst${i}`,
        LastName: `TestLast${i}`,
        Email: `test${i}@example.com`,
        Phone: `555-${(1000 + i).toString()}`,
        Department: ['Engineering', 'Sales'][i % 2]
      }),
      
      Account: (i) => ({
        Name: `Test Account ${i}`,
        Type: ['Customer', 'Partner', 'Prospect'][i % 3],
        Industry: ['Technology', 'Manufacturing', 'Healthcare'][i % 3],
        Phone: `555-${(2000 + i).toString()}`,
        Website: `https://testaccount${i}.com`
      }),
      
      Opportunity: (i) => ({
        Name: `Test Opportunity ${i}`,
        StageName: ['Prospecting', 'Qualification', 'Closed Won'][i % 3],
        Amount: (i + 1) * 1000,
        CloseDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
      })
    };

    const generator = generators[objectType];
    if (!generator) {
      throw new Error(`No test data generator for object type: ${objectType}`);
    }

    for (let i = 1; i <= count; i++) {
      data.push(generator(i));
    }

    return data;
  }
}

module.exports = TestDataManager;