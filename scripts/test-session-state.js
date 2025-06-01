#!/usr/bin/env node

/**
 * Session and State Management Test
 * This script tests if the OAuth state creation is using the correct userId from sessions
 */

const { PrismaClient } = require('@prisma/client');

async function testSessionStateIssue() {
  console.log('🔍 Testing Session State Management Issue...');
  
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
    await prisma.organisations.deleteMany({ where: { id: { startsWith: 'session-test-' } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: 'session-test-' } } });

    // Create test users that simulate the problem scenario
    console.log('👥 Creating test users...');
    const user1 = await prisma.user.create({
      data: {
        id: 'session-test-user-1',
        email: 'user1@session-test.com',
        name: 'Session Test User 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: 'session-test-user-2', 
        email: 'user2@session-test.com',
        name: 'Session Test User 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Simulate the scenario: User 1 connects first
    const org1 = await prisma.organisations.create({
      data: {
        id: 'session-test-org-1',
        name: 'User 1 Test Org',
        org_type: 'PRODUCTION',
        instance_url: 'https://login.salesforce.com',
        user_id: user1.id,
        salesforce_org_id: '00DSESSION0000001EAA',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log('✅ User 1 connected to Salesforce org successfully');
    console.log(`   - User ID: ${user1.id}`);
    console.log(`   - Org ID: ${org1.id}`);
    console.log(`   - Salesforce Org ID: ${org1.salesforce_org_id}`);

    // Now User 2 creates an org record
    const org2 = await prisma.organisations.create({
      data: {
        id: 'session-test-org-2',
        name: 'User 2 Test Org',
        org_type: 'PRODUCTION',
        instance_url: 'https://login.salesforce.com',
        user_id: user2.id, // User 2's org
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log('\n✅ User 2 created org record');
    console.log(`   - User ID: ${user2.id}`);
    console.log(`   - Org ID: ${org2.id}`);
    console.log(`   - Salesforce Org ID: ${org2.salesforce_org_id || 'Not connected yet'}`);

    // Simulate the OAuth state that would be created when User 2 initiates OAuth
    console.log('\n🧪 Testing OAuth state creation for User 2...');
    
    // This simulates the state creation in /api/auth/oauth2/salesforce/route.ts line 53-60
    const mockStateDataUser2 = {
      orgId: org2.id,
      userId: user2.id, // This should be User 2's ID
      orgType: 'PRODUCTION',
      targetInstanceUrl: 'https://login.salesforce.com',
      codeVerifier: 'mock_code_verifier',
      background: false,
    };

    console.log('Expected OAuth state for User 2:');
    console.log(JSON.stringify(mockStateDataUser2, null, 2));

    // Encode the state as it would be in the OAuth URL
    const encodedState = Buffer.from(JSON.stringify(mockStateDataUser2)).toString('base64');
    console.log(`\nEncoded state: ${encodedState.substring(0, 50)}...`);

    // Simulate what happens when the OAuth callback receives this state
    console.log('\n🔄 Simulating OAuth callback with User 2 state...');
    
    const decodedState = JSON.parse(Buffer.from(encodedState, 'base64').toString());
    console.log('Decoded state in callback:');
    console.log(JSON.stringify(decodedState, null, 2));

    // Verify the org belongs to the user in the state
    const organisation = await prisma.organisations.findFirst({
      where: { 
        id: decodedState.orgId, 
        user_id: decodedState.userId 
      },
    });

    if (!organisation) {
      console.log('❌ CRITICAL ISSUE: Organisation verification failed!');
      console.log(`   Looking for org ${decodedState.orgId} with user ${decodedState.userId}`);
      
      // Check what org actually exists
      const actualOrg = await prisma.organisations.findUnique({
        where: { id: decodedState.orgId },
      });
      
      if (actualOrg) {
        console.log(`   Found org ${actualOrg.id} but it belongs to user ${actualOrg.user_id}`);
        console.log(`   State expects user ${decodedState.userId}`);
        console.log('   🚨 This indicates a session management issue!');
      }
      return;
    }

    console.log('✅ Organisation verification passed');
    console.log(`   Org ${organisation.id} belongs to user ${organisation.user_id}`);

    // Now test the problematic query with the WRONG scenario
    console.log('\n🚨 Testing the WRONG scenario (if User 1 ID was in User 2 state):');
    
    const wrongStateData = {
      orgId: org2.id, // User 2's org
      userId: user1.id, // WRONG: User 1's ID in User 2's OAuth state!
      orgType: 'PRODUCTION',
      targetInstanceUrl: 'https://login.salesforce.com',
      codeVerifier: 'mock_code_verifier',
      background: false,
    };

    console.log('Wrong state data (User 1 ID with User 2 org):');
    console.log(JSON.stringify(wrongStateData, null, 2));

    // Test the duplicate check query with wrong state
    const mockUserInfo = { organization_id: '00DSESSION0000001EAA' }; // Same as User 1
    
    const existingOrgWrongUser = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: mockUserInfo.organization_id,
        user_id: wrongStateData.userId, // User 1 ID (wrong!)
        id: { not: wrongStateData.orgId }, // User 2's org
      },
    });

    console.log('\nDuplicate check with WRONG user ID:');
    console.log(`   Query: salesforce_org_id='${mockUserInfo.organization_id}' AND user_id='${wrongStateData.userId}' AND id!='${wrongStateData.orgId}'`);
    console.log(`   Result: ${existingOrgWrongUser ? 'FOUND' : 'null'}`);
    
    if (existingOrgWrongUser) {
      console.log('❌ FOUND EXISTING ORG - This would block the connection!');
      console.log('   Found org:', {
        id: existingOrgWrongUser.id,
        user_id: existingOrgWrongUser.user_id,
        salesforce_org_id: existingOrgWrongUser.salesforce_org_id,
      });
      console.log('\n🎯 ROOT CAUSE IDENTIFIED:');
      console.log('   If User 1 ID ends up in User 2 OAuth state, the query finds User 1 org');
      console.log('   and incorrectly blocks User 2 from connecting to the same Salesforce org!');
    }

    // Test with correct User 2 ID
    console.log('\n✅ Testing with CORRECT user ID:');
    const existingOrgCorrectUser = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: mockUserInfo.organization_id,
        user_id: user2.id, // Correct User 2 ID
        id: { not: org2.id },
      },
    });

    console.log(`   Query: salesforce_org_id='${mockUserInfo.organization_id}' AND user_id='${user2.id}' AND id!='${org2.id}'`);
    console.log(`   Result: ${existingOrgCorrectUser ? 'FOUND' : 'null'}`);
    
    if (!existingOrgCorrectUser) {
      console.log('✅ NULL RESULT - Connection would proceed correctly');
    }

    console.log('\n🔍 INVESTIGATION SUMMARY:');
    console.log('   1. The query logic in OAuth callback is CORRECT');
    console.log('   2. The database schema allows multiple users to connect same Salesforce org');
    console.log('   3. The issue is likely in SESSION MANAGEMENT:');
    console.log('      - Wrong userId gets into the OAuth state parameter');
    console.log('      - This could be due to:');
    console.log('        * Session cookies being shared between browser tabs/windows');
    console.log('        * Session persistence issues in Better Auth');
    console.log('        * Race conditions in session handling');
    console.log('        * Authentication state not being properly isolated per user');

    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Check Better Auth session management');
    console.log('   2. Verify session isolation between different users');
    console.log('   3. Add logging to track userId in OAuth initiation');
    console.log('   4. Test with multiple browser sessions to reproduce the issue');

  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await prisma.organisations.deleteMany({ where: { id: { startsWith: 'session-test-' } } });
      await prisma.user.deleteMany({ where: { id: { startsWith: 'session-test-' } } });
    } catch (e) {
      console.log('⚠️ Cleanup warning:', e.message);
    }
    await prisma.$disconnect();
  }
}

testSessionStateIssue().catch(console.error); 