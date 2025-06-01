#!/usr/bin/env node

/**
 * Test Actual Scenario
 * Simulate exactly what happens when different users try to connect to the same Salesforce org
 */

const { PrismaClient } = require('@prisma/client');

async function testActualScenario() {
  console.log('🔍 Testing Actual OAuth Scenario...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await prisma.organisations.deleteMany({ where: { id: { startsWith: 'scenario-test-' } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: 'scenario-test-' } } });

    // Create users
    const user1 = await prisma.user.create({
      data: {
        id: 'scenario-test-user-1',
        email: 'user1@scenario.com',
        name: 'User 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: 'scenario-test-user-2',
        email: 'user2@scenario.com',
        name: 'User 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Created test users');

    // STEP 1: User 1 successfully connects to a Salesforce org
    console.log('\n📝 STEP 1: User 1 connects to Salesforce org...');
    
    const user1Org = await prisma.organisations.create({
      data: {
        id: 'scenario-test-org-1',
        name: 'User 1 Org',
        org_type: 'PRODUCTION',
        instance_url: 'https://login.salesforce.com',
        user_id: user1.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Simulate successful OAuth completion for User 1
    await prisma.organisations.update({
      where: { id: user1Org.id },
      data: {
        salesforce_org_id: '00DSCENARIO000001EAA', // Salesforce org ID
        access_token_encrypted: 'encrypted_token_1',
        refresh_token_encrypted: 'encrypted_refresh_1',
        token_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
        updated_at: new Date(),
      },
    });

    console.log('✅ User 1 successfully connected to Salesforce org:', '00DSCENARIO000001EAA');

    // STEP 2: User 2 creates an org record and initiates OAuth
    console.log('\n📝 STEP 2: User 2 creates org and attempts OAuth...');
    
    const user2Org = await prisma.organisations.create({
      data: {
        id: 'scenario-test-org-2',
        name: 'User 2 Org',
        org_type: 'PRODUCTION',
        instance_url: 'https://login.salesforce.com',
        user_id: user2.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log('✅ User 2 created org record');

    // STEP 3: Simulate OAuth callback for User 2 trying to connect to SAME Salesforce org
    console.log('\n📝 STEP 3: Simulating OAuth callback for User 2...');
    
    const mockUserInfo = { organization_id: '00DSCENARIO000001EAA' }; // Same as User 1!
    const userId = user2.id; // User 2's ID (correct session)
    const orgId = user2Org.id; // User 2's org record

    console.log('Mock OAuth callback data:');
    console.log('  - Salesforce Org ID:', mockUserInfo.organization_id);
    console.log('  - User ID from state:', userId);
    console.log('  - Org record to update:', orgId);

    // Test 1: Organisation ownership verification (should pass)
    console.log('\n🧪 TEST 1: Organisation ownership verification...');
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: userId },
    });

    if (!organisation) {
      console.log('❌ Organisation ownership verification failed');
      return;
    }
    console.log('✅ Organisation ownership verified');

    // Test 2: Duplicate check (this is where the issue likely occurs)
    console.log('\n🧪 TEST 2: Duplicate check query...');
    const existingOrg = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: mockUserInfo.organization_id,
        user_id: userId,
        id: { not: orgId },
      },
    });

    console.log('Duplicate check query:');
    console.log(`  WHERE salesforce_org_id = '${mockUserInfo.organization_id}'`);
    console.log(`    AND user_id = '${userId}'`);
    console.log(`    AND id != '${orgId}'`);
    console.log(`  Result: ${existingOrg ? 'FOUND ORG' : 'null'}`);

    if (existingOrg) {
      console.log('❌ EXPLICIT CHECK ERROR: Found existing org, would block connection');
      console.log('   Found:', {
        id: existingOrg.id,
        name: existingOrg.name,
        user_id: existingOrg.user_id,
        salesforce_org_id: existingOrg.salesforce_org_id,
      });
      console.log('   🚨 This should NOT happen for different users!');
      return;
    }
    console.log('✅ Duplicate check passed');

    // Test 3: Database update (constraint check)
    console.log('\n🧪 TEST 3: Database constraint test...');
    try {
      await prisma.organisations.update({
        where: { id: orgId },
        data: {
          salesforce_org_id: mockUserInfo.organization_id,
          access_token_encrypted: 'encrypted_token_2',
          refresh_token_encrypted: 'encrypted_refresh_2',
          token_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
          updated_at: new Date(),
        },
      });
      
      console.log('✅ Database update succeeded!');
      console.log('   User 2 successfully connected to same Salesforce org as User 1');

      // Verify final state
      const finalOrgs = await prisma.organisations.findMany({
        where: { salesforce_org_id: mockUserInfo.organization_id },
        select: { id: true, user_id: true, name: true },
      });

      console.log('\n📊 FINAL STATE:');
      console.log(`   Total orgs connected to ${mockUserInfo.organization_id}: ${finalOrgs.length}`);
      finalOrgs.forEach(org => {
        console.log(`   - ${org.name} (${org.id}) - User: ${org.user_id}`);
      });

      if (finalOrgs.length === 2) {
        console.log('\n🎉 SUCCESS: Both users connected to same Salesforce org!');
        console.log('   The OAuth flow would work correctly.');
        console.log('   The issue might be elsewhere in the system.');
      }

    } catch (dbError) {
      console.log('❌ DATABASE CONSTRAINT ERROR:', dbError.code);
      
      if (dbError.code === 'P2002') {
        console.log('   🚨 UNIQUE CONSTRAINT VIOLATION');
        console.log('   This means the database is preventing different users from connecting same org!');
        console.log('   Constraint details:', dbError.meta);
        
        // Check what the constraint actually is
        if (dbError.meta?.target?.includes('salesforce_org_id')) {
          console.log('   The constraint is on salesforce_org_id');
          console.log('   This should allow multiple users if the constraint is [salesforce_org_id, user_id]');
          console.log('   But might block if it\'s just [salesforce_org_id]');
        }
        
        console.log('\n🔍 INVESTIGATION: Check the actual constraint in the database:');
        console.log('   Expected: @@unique([salesforce_org_id, user_id])');
        console.log('   Actual: Check what constraint exists');
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await prisma.organisations.deleteMany({ where: { id: { startsWith: 'scenario-test-' } } });
      await prisma.user.deleteMany({ where: { id: { startsWith: 'scenario-test-' } } });
    } catch (e) {
      console.log('⚠️ Cleanup warning:', e.message);
    }
    await prisma.$disconnect();
  }
}

testActualScenario().catch(console.error); 