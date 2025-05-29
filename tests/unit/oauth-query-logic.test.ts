import { PrismaClient } from '@prisma/client';

describe('OAuth Query Logic Unit Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
      },
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.organisations.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.organisations.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Duplicate Check Query Analysis', () => {
    it('should identify why the duplicate check query fails for different users', async () => {
      // Create test users
      const user1 = await prisma.user.create({
        data: {
          id: 'user1',
          email: 'user1@test.com',
          name: 'User 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const user2 = await prisma.user.create({
        data: {
          id: 'user2',
          email: 'user2@test.com',
          name: 'User 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create orgs for each user
      const org1 = await prisma.organisations.create({
        data: {
          id: 'org1',
          name: 'User 1 Org',
          org_type: 'PRODUCTION',
          instance_url: 'https://test1.salesforce.com',
          user_id: user1.id,
          salesforce_org_id: '00Dxx0000000000EAA', // Same Salesforce org
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const org2 = await prisma.organisations.create({
        data: {
          id: 'org2',
          name: 'User 2 Org',
          org_type: 'PRODUCTION',
          instance_url: 'https://test2.salesforce.com',
          user_id: user2.id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      console.log('=== SETUP COMPLETE ===');
      console.log('User 1 ID:', user1.id);
      console.log('User 2 ID:', user2.id);
      console.log('Org 1 ID:', org1.id, '(User 1, has Salesforce org ID)');
      console.log('Org 2 ID:', org2.id, '(User 2, no Salesforce org ID yet)');

      // Test the exact query from the OAuth callback route
      // This simulates User 2 trying to connect to the same Salesforce org
      const existingOrg = await prisma.organisations.findFirst({
        where: {
          salesforce_org_id: '00Dxx0000000000EAA', // Same as User 1's org
          user_id: user2.id, // User 2 trying to connect
          id: { not: org2.id }, // Exclude the current org being updated
        },
      });

      console.log('=== QUERY TEST ===');
      console.log('Query: Find org with salesforce_org_id=00Dxx0000000000EAA AND user_id=user2 AND id!=org2');
      console.log('Result:', existingOrg);
      console.log('Expected: null (should allow different user to connect)');
      console.log('Actual:', existingOrg ? 'FOUND (blocks connection)' : 'null (allows connection)');

      // This should be null because user2 doesn't have any org with this Salesforce org ID
      expect(existingOrg).toBeNull();

      // Now test the problematic scenario: what if the query is wrong?
      const problematicQuery = await prisma.organisations.findFirst({
        where: {
          salesforce_org_id: '00Dxx0000000000EAA',
          // Missing user_id filter - this would be the bug!
          id: { not: org2.id },
        },
      });

      console.log('=== PROBLEMATIC QUERY TEST ===');
      console.log('Query: Find org with salesforce_org_id=00Dxx0000000000EAA AND id!=org2 (missing user_id)');
      console.log('Result:', problematicQuery);
      console.log('This would incorrectly find User 1\'s org and block User 2');

      // This demonstrates the bug - if user_id is missing from the query
      expect(problematicQuery).not.toBeNull();
      expect(problematicQuery?.user_id).toBe(user1.id);
    });

    it('should test database constraint behaviour', async () => {
      // Create users
      const user1 = await prisma.user.create({
        data: {
          id: 'user1',
          email: 'user1@test.com',
          name: 'User 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const user2 = await prisma.user.create({
        data: {
          id: 'user2',
          email: 'user2@test.com',
          name: 'User 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Test: Same user, same Salesforce org (should fail)
      await prisma.organisations.create({
        data: {
          id: 'org1',
          name: 'User 1 Org 1',
          org_type: 'PRODUCTION',
          instance_url: 'https://test1.salesforce.com',
          user_id: user1.id,
          salesforce_org_id: '00Dxx0000000000EAA',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      try {
        await prisma.organisations.create({
          data: {
            id: 'org2',
            name: 'User 1 Org 2',
            org_type: 'SANDBOX',
            instance_url: 'https://test2.salesforce.com',
            user_id: user1.id, // Same user
            salesforce_org_id: '00Dxx0000000000EAA', // Same Salesforce org
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        console.log('❌ Database constraint should have prevented this!');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        console.log('✅ Database constraint correctly prevented duplicate:', error.code);
        expect(error.code).toBe('P2002'); // Unique constraint violation
      }

      // Test: Different users, same Salesforce org (should succeed)
      try {
        await prisma.organisations.create({
          data: {
            id: 'org3',
            name: 'User 2 Org',
            org_type: 'PRODUCTION',
            instance_url: 'https://test3.salesforce.com',
            user_id: user2.id, // Different user
            salesforce_org_id: '00Dxx0000000000EAA', // Same Salesforce org
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        console.log('✅ Different users can connect to same Salesforce org');

        // Verify both records exist
        const orgs = await prisma.organisations.findMany({
          where: { salesforce_org_id: '00Dxx0000000000EAA' },
        });

        console.log('Total orgs with same Salesforce org ID:', orgs.length);
        console.log('User IDs:', orgs.map(org => org.user_id));

        expect(orgs).toHaveLength(2);
        expect(orgs.map(org => org.user_id).sort()).toEqual([user1.id, user2.id].sort());
      } catch (error: any) {
        console.log('❌ Database should allow different users same org:', error);
        throw error;
      }
    });

    it('should reproduce the exact OAuth callback scenario', async () => {
      // Create test users
      const userId1 = 'auth-user-1';
      const userId2 = 'auth-user-2';

      await prisma.user.create({
        data: {
          id: userId1,
          email: 'user1@oauth.test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await prisma.user.create({
        data: {
          id: userId2,
          email: 'user2@oauth.test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Simulate OAuth flow: User 1 successfully connects
      const org1 = await prisma.organisations.create({
        data: {
          id: 'oauth-org-1',
          name: 'OAuth Test Org 1',
          org_type: 'PRODUCTION',
          instance_url: 'https://oauth1.salesforce.com',
          user_id: userId1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Update with Salesforce org ID (simulating successful OAuth)
      await prisma.organisations.update({
        where: { id: org1.id },
        data: { salesforce_org_id: '00DOAuth00000001EAA' },
      });

      console.log('User 1 connected to Salesforce org: 00DOAuth00000001EAA');

      // Simulate OAuth flow: User 2 creates org record and attempts to connect
      const org2 = await prisma.organisations.create({
        data: {
          id: 'oauth-org-2',
          name: 'OAuth Test Org 2',
          org_type: 'PRODUCTION',
          instance_url: 'https://oauth2.salesforce.com',
          user_id: userId2,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Simulate the exact check from the OAuth callback
      // This is what happens when User 2 tries to connect to the SAME Salesforce org
      const userInfo = { organization_id: '00DOAuth00000001EAA' }; // Same as User 1
      const orgId = org2.id; // User 2's org record
      const userId = userId2; // User 2

      const existingOrg = await prisma.organisations.findFirst({
        where: {
          salesforce_org_id: userInfo.organization_id,
          user_id: userId,
          id: { not: orgId },
        },
      });

      console.log('=== OAUTH CALLBACK SIMULATION ===');
      console.log('User 2 trying to connect to Salesforce org:', userInfo.organization_id);
      console.log('User 2 ID:', userId);
      console.log('User 2 org record ID:', orgId);
      console.log('Existing org check result:', existingOrg);

      // This should be null (User 2 doesn't have this Salesforce org yet)
      expect(existingOrg).toBeNull();

      // Now simulate User 2 successfully connecting
      await prisma.organisations.update({
        where: { id: org2.id },
        data: { salesforce_org_id: userInfo.organization_id },
      });

      // Verify both users are connected to the same Salesforce org
      const allOrgs = await prisma.organisations.findMany({
        where: { salesforce_org_id: userInfo.organization_id },
      });

      console.log('Final state: Both users connected to same Salesforce org');
      console.log('Number of org records:', allOrgs.length);
      console.log('Users:', allOrgs.map(org => org.user_id));

      expect(allOrgs).toHaveLength(2);
    });
  });
}); 