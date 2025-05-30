#!/usr/bin/env node

/**
 * Direct OAuth Query Logic Test
 * This script tests the OAuth callback query logic directly without Jest
 */

const { PrismaClient } = require('@prisma/client');

async function runTests() {
  console.log('🔍 Testing OAuth Query Logic...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    // Clean up only test data (avoid foreign key issues)
    console.log('🧹 Cleaning up previous test data...');
    await prisma.organisations.deleteMany({ where: { id: { startsWith: 'test-oauth-' } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: 'test-oauth-' } } });

    // Create test users
    console.log('👥 Creating test users...');
    const user1 = await prisma.user.create({
      data: {
        id: 'test-oauth-user-1',
        email: 'user1@oauth-test.com',
        name: 'Test User 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: 'test-oauth-user-2',
        email: 'user2@oauth-test.com',
        name: 'Test User 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Users created:', { user1: user1.id, user2: user2.id });

    // Create organisations
    console.log('🏢 Creating test organisations...');
    const org1 = await prisma.organisations.create({
      data: {
        id: 'test-oauth-org-1',
        name: 'Test Org 1',
        org_type: 'PRODUCTION',
        instance_url: 'https://test1.salesforce.com',
        user_id: user1.id,
        salesforce_org_id: '00DTEST000000001EAA', // User 1 connected to this org
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const org2 = await prisma.organisations.create({
      data: {
        id: 'test-oauth-org-2',
        name: 'Test Org 2',
        org_type: 'PRODUCTION',
        instance_url: 'https://test2.salesforce.com',
        user_id: user2.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log('✅ Organisations created:');
    console.log(`   - Org 1: ${org1.id} (User: ${org1.user_id}, SF Org: ${org1.salesforce_org_id})`);
    console.log(`   - Org 2: ${org2.id} (User: ${org2.user_id}, SF Org: ${org2.salesforce_org_id || 'None'})`);

    // Test Scenario: User 2 tries to connect to the same Salesforce org as User 1
    console.log('\n🧪 Testing OAuth callback scenario...');
    console.log('Scenario: User 2 wants to connect to the same Salesforce org as User 1');
    
    const userInfo = { organization_id: '00DTEST000000001EAA' }; // Same as User 1
    const orgId = org2.id; // User 2's org record
    const userId = user2.id; // User 2

    console.log(`   - Salesforce Org ID: ${userInfo.organization_id}`);
    console.log(`   - User trying to connect: ${userId}`);
    console.log(`   - Org record to update: ${orgId}`);

    // This is the EXACT query from the OAuth callback route (lines 92-106)
    const existingOrg = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: userInfo.organization_id,
        user_id: userId,
        id: { not: orgId },
      },
    });

    console.log('\n📊 QUERY RESULT ANALYSIS:');
    console.log('Query: organisations.findFirst({');
    console.log(`  salesforce_org_id: "${userInfo.organization_id}",`);
    console.log(`  user_id: "${userId}",`);
    console.log(`  id: { not: "${orgId}" }`);
    console.log('})');
    console.log(`\nResult: ${existingOrg ? 'FOUND' : 'null'}`);
    
    if (existingOrg) {
      console.log('❌ ERROR: Query found an existing org, blocking connection');
      console.log('   This should NOT happen for different users!');
      console.log('   Found org:', {
        id: existingOrg.id,
        user_id: existingOrg.user_id,
        salesforce_org_id: existingOrg.salesforce_org_id,
      });
      console.log('\n🔍 ROOT CAUSE: The query logic is correct, but something else is wrong');
    } else {
      console.log('✅ CORRECT: Query returned null, allowing connection');
      console.log('   User 2 can connect to the same Salesforce org as User 1');
      console.log('\n🤔 CONCLUSION: The query logic in the OAuth callback is NOT the issue');
    }

    // Test what happens if we remove the user_id filter (demonstrate the bug that WOULD happen)
    console.log('\n🐛 Demonstrating what would happen with incorrect query:');
    const buggyQuery = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: userInfo.organization_id,
        // Missing user_id filter!
        id: { not: orgId },
      },
    });

    console.log('Incorrect Query: organisations.findFirst({');
    console.log(`  salesforce_org_id: "${userInfo.organization_id}",`);
    console.log(`  // Missing user_id filter!`);
    console.log(`  id: { not: "${orgId}" }`);
    console.log('})');
    console.log(`\nResult: ${buggyQuery ? 'FOUND' : 'null'}`);
    
    if (buggyQuery) {
      console.log('❌ DEMONSTRATES BUG: Without user_id filter, query incorrectly finds:');
      console.log('   Found org:', {
        id: buggyQuery.id,
        user_id: buggyQuery.user_id,
        salesforce_org_id: buggyQuery.salesforce_org_id,
      });
      console.log('   This WOULD block User 2 from connecting if the code was wrong');
    }

    // Test database constraint behaviour
    console.log('\n🔒 Testing database constraints...');
    
    // Test 1: Same user, same org (should fail)
    console.log('Test 1: Same user connecting same org twice (should fail)');
    try {
      await prisma.organisations.create({
        data: {
          id: 'test-oauth-duplicate',
          name: 'Duplicate Org',
          org_type: 'SANDBOX',
          instance_url: 'https://duplicate.salesforce.com',
          user_id: user1.id, // Same user
          salesforce_org_id: '00DTEST000000001EAA', // Same Salesforce org
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      console.log('❌ ERROR: Database should have prevented this duplicate!');
    } catch (error) {
      console.log(`✅ CORRECT: Database constraint prevented duplicate (${error.code})`);
    }

    // Test 2: Different users, same org (should succeed)
    console.log('\nTest 2: Different users connecting same org (should succeed)');
    try {
      const org3 = await prisma.organisations.create({
        data: {
          id: 'test-oauth-shared-org',
          name: 'Shared Org',
          org_type: 'PRODUCTION',
          instance_url: 'https://shared.salesforce.com',
          user_id: user2.id, // Different user
          salesforce_org_id: '00DTEST000000001EAA', // Same Salesforce org
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      console.log('✅ CORRECT: Different users can connect to same Salesforce org');
      console.log(`   Created org: ${org3.id} (User: ${org3.user_id})`);
    } catch (error) {
      console.log(`❌ ERROR: Database incorrectly prevented this (${error.code})`);
      console.log('   Different users should be allowed to connect to same Salesforce org');
    }

    // Verify final state
    console.log('\n📈 Final verification:');
    const allOrgs = await prisma.organisations.findMany({
      where: { salesforce_org_id: '00DTEST000000001EAA' },
      select: { id: true, user_id: true, name: true },
    });

    console.log(`Total orgs connected to Salesforce org 00DTEST000000001EAA: ${allOrgs.length}`);
    allOrgs.forEach(org => {
      console.log(`   - ${org.name} (${org.id}) - User: ${org.user_id}`);
    });

    if (allOrgs.length >= 2) {
      console.log('✅ SUCCESS: Multiple users can connect to same Salesforce org');
      console.log('\n🔍 NEXT STEPS: The database and query logic are working correctly.');
      console.log('   The issue must be elsewhere in the OAuth callback flow.');
      console.log('   Check the actual error handling or token exchange process.');
    } else {
      console.log('❌ ISSUE: Only one user connected - something is blocking multiple connections');
    }

    // Test the actual OAuth callback route logic more thoroughly
    console.log('\n🔬 Testing complete OAuth callback logic simulation...');
    
    // Simulate user 2 OAuth callback after user 1 is already connected
    console.log('Simulating User 2 OAuth callback with same Salesforce org...');
    
    // Mock the userInfo response
    const mockUserInfo = { organization_id: '00DTEST000000001EAA' };
    
    // Check if another organisation already has this Salesforce org ID (lines 92-106 in route)
    const existingOrgCheck = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: mockUserInfo.organization_id,
        user_id: user2.id,
        id: { not: org2.id }, // Exclude the current org being updated
      },
    });

    console.log('OAuth Callback Check Result:');
    console.log(`   existingOrg: ${existingOrgCheck ? 'FOUND' : 'null'}`);
    
    if (existingOrgCheck) {
      console.log('   ❌ This would trigger "org_already_connected" error');
      console.log('   🚨 BUT THIS IS WRONG - different users should be allowed!');
    } else {
      console.log('   ✅ This would allow the connection to proceed');
      console.log('   📋 The OAuth callback query logic is working correctly');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  } finally {
    // Clean up test data only
    console.log('\n🧹 Cleaning up test data...');
    try {
      await prisma.organisations.deleteMany({ where: { id: { startsWith: 'test-oauth-' } } });
      await prisma.user.deleteMany({ where: { id: { startsWith: 'test-oauth-' } } });
    } catch (cleanupError) {
      console.log('⚠️ Cleanup warning (non-critical):', cleanupError.message);
    }
    await prisma.$disconnect();
    console.log('✅ Test completed and cleaned up');
  }
}

// Run the tests
runTests().catch(console.error); 