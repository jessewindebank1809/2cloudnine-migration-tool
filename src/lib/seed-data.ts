import { prisma } from '@/lib/database/prisma';

export async function seedData(userId: string) {
  try {
    // Check if data already exists
    const existingOrgs = await prisma.organisations.count();
    if (existingOrgs > 0) {
      console.log('Seed data already exists');
      return;
    }

    // Create sample organisations
    const productionOrg = await prisma.organisations.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Production Org',
        org_type: 'PRODUCTION',
        instance_url: 'https://login.salesforce.com',
        salesforce_org_id: '00D000000000001',
        user_id: userId,
        updated_at: new Date(),
      },
    });

    const sandboxOrg = await prisma.organisations.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Development Sandbox',
        org_type: 'SANDBOX',
        instance_url: 'https://test.salesforce.com',
        salesforce_org_id: '00D000000000002',
        user_id: userId,
        updated_at: new Date(),
      },
    });

    // Create sample migration project
    const migrationProject = await prisma.migration_projects.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Q4 2024 Pay Code Migration',
        description: 'Migrating pay codes and interpretation rules from production to sandbox for testing',
        source_org_id: productionOrg.id,
        target_org_id: sandboxOrg.id,
        status: 'DRAFT',
        user_id: userId,
        updated_at: new Date(),
        config: {
          objects: ['tc9_pay_code__c', 'tc9_interpretation_rule__c'],
          preserveRelationships: true,
          useBulkApi: true,
        },
      },
    });

    // Create a completed migration project
    const completedProject = await prisma.migration_projects.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Leave Rules Sync',
        description: 'Syncing leave rules configuration to sandbox',
        source_org_id: productionOrg.id,
        target_org_id: sandboxOrg.id,
        status: 'COMPLETED',
        user_id: userId,
        updated_at: new Date(),
        config: {
          objects: ['tc9_leave_rule__c'],
          preserveRelationships: true,
          useBulkApi: false,
        },
      },
    });

    // Create sample migration sessions
    const session = await prisma.migration_sessions.create({
      data: {
        id: crypto.randomUUID(),
        project_id: completedProject.id,
        object_type: 'tc9_leave_rule__c',
        status: 'COMPLETED',
        total_records: 150,
        processed_records: 150,
        successful_records: 147,
        failed_records: 3,
        started_at: new Date('2024-01-15T10:00:00Z'),
        completed_at: new Date('2024-01-15T10:05:00Z'),
        error_log: [
          { recordId: 'a01000000000001', error: 'Required field missing' },
          { recordId: 'a01000000000002', error: 'Duplicate name' },
          { recordId: 'a01000000000003', error: 'Invalid picklist value' },
        ],
      },
    });

    console.log('Seed data created successfully!');
    console.log(`Created organisations: ${productionOrg.name}, ${sandboxOrg.name}`);
    console.log(`Created projects: ${migrationProject.name}, ${completedProject.name}`);
    console.log(`Created session for: ${session.object_type}`);

  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
} 