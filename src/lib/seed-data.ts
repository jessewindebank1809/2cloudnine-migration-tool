import { prisma } from '@/lib/database/prisma';

export async function seedData(userId: string) {
  try {
    // Check if data already exists
    const existingOrgs = await prisma.organisation.count();
    if (existingOrgs > 0) {
      console.log('Seed data already exists');
      return;
    }

    // Create sample organisations
    const productionOrg = await prisma.organisation.create({
      data: {
        name: 'Production Org',
        orgType: 'PRODUCTION',
        instanceUrl: 'https://login.salesforce.com',
        salesforceOrgId: '00D000000000001',
        userId: userId,
      },
    });

    const sandboxOrg = await prisma.organisation.create({
      data: {
        name: 'Development Sandbox',
        orgType: 'SANDBOX',
        instanceUrl: 'https://test.salesforce.com',
        salesforceOrgId: '00D000000000002',
        userId: userId,
      },
    });

    // Create sample migration project
    const migrationProject = await prisma.migrationProject.create({
      data: {
        name: 'Q4 2024 Pay Code Migration',
        description: 'Migrating pay codes and interpretation rules from production to sandbox for testing',
        sourceOrgId: productionOrg.id,
        targetOrgId: sandboxOrg.id,
        status: 'DRAFT',
        userId: userId,
        config: {
          objects: ['tc9_pay_code__c', 'tc9_interpretation_rule__c'],
          preserveRelationships: true,
          useBulkApi: true,
        },
      },
    });

    // Create a completed migration project
    const completedProject = await prisma.migrationProject.create({
      data: {
        name: 'Leave Rules Sync',
        description: 'Syncing leave rules configuration to sandbox',
        sourceOrgId: productionOrg.id,
        targetOrgId: sandboxOrg.id,
        status: 'COMPLETED',
        userId: userId,
        config: {
          objects: ['tc9_leave_rule__c'],
          preserveRelationships: true,
          useBulkApi: false,
        },
      },
    });

    // Create sample migration sessions
    const session = await prisma.migrationSession.create({
      data: {
        projectId: completedProject.id,
        objectType: 'tc9_leave_rule__c',
        status: 'COMPLETED',
        totalRecords: 150,
        processedRecords: 150,
        successfulRecords: 147,
        failedRecords: 3,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:05:00Z'),
        errorLog: [
          { recordId: 'a01000000000001', error: 'Required field missing' },
          { recordId: 'a01000000000002', error: 'Duplicate name' },
          { recordId: 'a01000000000003', error: 'Invalid picklist value' },
        ],
      },
    });

    console.log('Seed data created successfully!');
    console.log(`Created organisations: ${productionOrg.name}, ${sandboxOrg.name}`);
    console.log(`Created projects: ${migrationProject.name}, ${completedProject.name}`);
    console.log(`Created session for: ${session.objectType}`);

  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
} 