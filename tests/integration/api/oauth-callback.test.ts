import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GET } from '@/app/api/auth/callback/salesforce-org/route';

// Mock external dependencies
jest.mock('@/lib/utils/encryption', () => ({
  encrypt: jest.fn((value: string) => `encrypted_${value}`),
  decrypt: jest.fn((value: string) => value.replace('encrypted_', '')),
}));

jest.mock('@/lib/salesforce/token-manager', () => ({
  TokenManager: {
    getInstance: jest.fn(() => ({
      clearTokenCache: jest.fn(),
    })),
  },
}));

// Mock fetch for external API calls
global.fetch = jest.fn();

describe('OAuth Callback Integration Tests', () => {
  let prisma: PrismaClient;
  let testUsers: any[];
  let testOrgs: any[];

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

    // Create test users
    testUsers = await Promise.all([
      prisma.user.create({
        data: {
          id: 'user1',
          email: 'user1@test.com',
          name: 'User 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          id: 'user2',
          email: 'user2@test.com',
          name: 'User 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ]);

    // Create test organisations for each user
    testOrgs = await Promise.all([
      // User 1's org
      prisma.organisations.create({
        data: {
          id: 'org1',
          name: 'Test Org 1',
          org_type: 'PRODUCTION',
          instance_url: 'https://test1.salesforce.com',
          user_id: 'user1',
          created_at: new Date(),
          updated_at: new Date(),
        },
      }),
      // User 2's org (different org)
      prisma.organisations.create({
        data: {
          id: 'org2',
          name: 'Test Org 2',
          org_type: 'PRODUCTION',
          instance_url: 'https://test2.salesforce.com',
          user_id: 'user2',
          created_at: new Date(),
          updated_at: new Date(),
        },
      }),
      // User 2's second org (for testing same user, different org)
      prisma.organisations.create({
        data: {
          id: 'org3',
          name: 'Test Org 3',
          org_type: 'SANDBOX',
          instance_url: 'https://test3.salesforce.com',
          user_id: 'user2',
          created_at: new Date(),
          updated_at: new Date(),
        },
      }),
    ]);

    // Mock successful external API responses
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/services/oauth2/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'test_access_token',
            refresh_token: 'test_refresh_token',
            instance_url: 'https://test.salesforce.com',
            issued_at: Date.now().toString(),
          }),
        });
      }
      
      if (url.includes('/services/oauth2/userinfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            organization_id: '00Dxx0000000000EAA', // Same org ID for testing
            user_id: 'test_user_id',
          }),
        });
      }
      
      return Promise.resolve({ ok: false });
    });

    // Set required environment variables
    process.env.SALESFORCE_PRODUCTION_CLIENT_ID = 'test_client_id';
    process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET = 'test_client_secret';
    process.env.SALESFORCE_SANDBOX_CLIENT_ID = 'test_sandbox_client_id';
    process.env.SALESFORCE_SANDBOX_CLIENT_SECRET = 'test_sandbox_client_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.organisations.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  const createMockRequest = (params: {
    code?: string;
    state?: string;
    orgId: string;
    userId: string;
    background?: boolean;
  }) => {
    const state = Buffer.from(JSON.stringify({
      orgId: params.orgId,
      userId: params.userId,
      orgType: 'PRODUCTION',
      targetInstanceUrl: 'https://test.salesforce.com',
      codeVerifier: 'test_code_verifier',
      background: params.background || false,
    })).toString('base64');

    const url = new URL('http://localhost:3000/api/auth/callback/salesforce-org');
    url.searchParams.set('code', params.code || 'test_auth_code');
    url.searchParams.set('state', params.state || state);

    return new NextRequest(url);
  };

  describe('Test Scenario 1: Same user, different org (should succeed)', () => {
    it('should allow same user to connect different orgs', async () => {
      // Mock userinfo to return different org ID
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              access_token: 'test_access_token',
              refresh_token: 'test_refresh_token',
              instance_url: 'https://test.salesforce.com',
              issued_at: Date.now().toString(),
            }),
          });
        }
        
        if (url.includes('/services/oauth2/userinfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              organization_id: '00Dxx0000000001EAA', // Different org ID
              user_id: 'test_user_id',
            }),
          });
        }
        
        return Promise.resolve({ ok: false });
      });

      const request = createMockRequest({
        orgId: testOrgs[2].id, // User 2's second org
        userId: testUsers[1].id, // User 2
      });

      const response = await GET(request);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('success=connected');
      
      // Verify org was updated with new Salesforce org ID
      const updatedOrg = await prisma.organisations.findUnique({
        where: { id: testOrgs[2].id },
      });
      expect(updatedOrg?.salesforce_org_id).toBe('00Dxx0000000001EAA');
    });
  });

  describe('Test Scenario 2: Same user, same org (should fail)', () => {
    it('should prevent same user from connecting same org twice', async () => {
      // First, connect the org successfully
      const firstRequest = createMockRequest({
        orgId: testOrgs[0].id,
        userId: testUsers[0].id,
      });

      await GET(firstRequest);

      // Now try to connect a different org record to the same Salesforce org
      const secondRequest = createMockRequest({
        orgId: testOrgs[2].id, // Different org record
        userId: testUsers[0].id, // Same user
      });

      const response = await GET(secondRequest);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('error=org_already_connected');
      
      // Verify the duplicate org record was cleaned up
      const deletedOrg = await prisma.organisations.findUnique({
        where: { id: testOrgs[2].id },
      });
      expect(deletedOrg).toBeNull();
    });
  });

  describe('Test Scenario 3: Different user, same org (should succeed - FAILING CASE)', () => {
    it('should allow different users to connect to the same Salesforce org', async () => {
      // First user connects to Salesforce org
      const firstRequest = createMockRequest({
        orgId: testOrgs[0].id,
        userId: testUsers[0].id,
      });

      const firstResponse = await GET(firstRequest);
      expect(firstResponse.status).toBe(302);
      expect(firstResponse.headers.get('location')).toContain('success=connected');

      // Second user tries to connect to same Salesforce org
      const secondRequest = createMockRequest({
        orgId: testOrgs[1].id,
        userId: testUsers[1].id,
      });

      const secondResponse = await GET(secondRequest);
      
      // This should succeed but currently fails
      console.log('Second response status:', secondResponse.status);
      console.log('Second response location:', secondResponse.headers.get('location'));
      
      expect(secondResponse.status).toBe(302);
      expect(secondResponse.headers.get('location')).toContain('success=connected');
      
      // Verify both orgs exist with same Salesforce org ID but different users
      const orgs = await prisma.organisations.findMany({
        where: {
          salesforce_org_id: '00Dxx0000000000EAA',
        },
      });
      
      expect(orgs).toHaveLength(2);
      expect(orgs.map(org => org.user_id).sort()).toEqual([testUsers[0].id, testUsers[1].id].sort());
    });
  });

  describe('Test Scenario 4: Different user, different org (should succeed)', () => {
    it('should allow different users to connect different orgs', async () => {
      // Mock different org IDs for each user
      let callCount = 0;
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              access_token: 'test_access_token',
              refresh_token: 'test_refresh_token',
              instance_url: 'https://test.salesforce.com',
              issued_at: Date.now().toString(),
            }),
          });
        }
        
        if (url.includes('/services/oauth2/userinfo')) {
          callCount++;
          const orgId = callCount === 1 ? '00Dxx0000000001EAA' : '00Dxx0000000002EAA';
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              organization_id: orgId,
              user_id: 'test_user_id',
            }),
          });
        }
        
        return Promise.resolve({ ok: false });
      });

      // First user connects
      const firstRequest = createMockRequest({
        orgId: testOrgs[0].id,
        userId: testUsers[0].id,
      });
      
      const firstResponse = await GET(firstRequest);
      expect(firstResponse.status).toBe(302);
      expect(firstResponse.headers.get('location')).toContain('success=connected');

      // Second user connects to different org
      const secondRequest = createMockRequest({
        orgId: testOrgs[1].id,
        userId: testUsers[1].id,
      });
      
      const secondResponse = await GET(secondRequest);
      expect(secondResponse.status).toBe(302);
      expect(secondResponse.headers.get('location')).toContain('success=connected');
      
      // Verify both orgs have different Salesforce org IDs
      const firstOrg = await prisma.organisations.findUnique({
        where: { id: testOrgs[0].id },
      });
      const secondOrg = await prisma.organisations.findUnique({
        where: { id: testOrgs[1].id },
      });
      
      expect(firstOrg?.salesforce_org_id).toBe('00Dxx0000000001EAA');
      expect(secondOrg?.salesforce_org_id).toBe('00Dxx0000000002EAA');
    });
  });

  describe('Error Analysis Tests', () => {
    it('should identify the source of error for different user, same org scenario', async () => {
      // Enable console logging to capture error details
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // First user connects
        const firstRequest = createMockRequest({
          orgId: testOrgs[0].id,
          userId: testUsers[0].id,
        });
        
        await GET(firstRequest);

        // Second user attempts to connect to same org
        const secondRequest = createMockRequest({
          orgId: testOrgs[1].id,
          userId: testUsers[1].id,
        });
        
        const response = await GET(secondRequest);
        
        // Analyse what type of error occurred
        const errorLocation = response.headers.get('location');
        const consoleErrors = consoleSpy.mock.calls;
        
        console.log('=== ERROR ANALYSIS ===');
        console.log('Response status:', response.status);
        console.log('Error location:', errorLocation);
        console.log('Console errors:', consoleErrors);
        
        // Check if it's the explicit check that's failing
        const explicitCheckError = consoleErrors.find(call => 
          call[0] === 'Salesforce org already connected:'
        );
        
        // Check if it's a database constraint error
        const dbConstraintError = consoleErrors.find(call => 
          call[0] === 'Database constraint violation - org already connected to this user:'
        );
        
        if (explicitCheckError) {
          console.log('❌ ISSUE: Explicit duplicate check is incorrectly preventing different users from connecting same org');
          console.log('The existingOrg query is finding a record it should not find');
        } else if (dbConstraintError) {
          console.log('❌ ISSUE: Database constraint is preventing different users from connecting same org');
          console.log('The unique constraint @@unique([salesforce_org_id, user_id]) may not be working as expected');
        } else {
          console.log('❓ ISSUE: Unknown error source');
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should test the exact database query logic that checks for duplicates', async () => {
      // First user connects to org
      await prisma.organisations.update({
        where: { id: testOrgs[0].id },
        data: {
          salesforce_org_id: '00Dxx0000000000EAA',
        },
      });

      // Test the exact query from the route handler
      const existingOrg = await prisma.organisations.findFirst({
        where: {
          salesforce_org_id: '00Dxx0000000000EAA',
          user_id: testUsers[1].id, // Different user
          id: { not: testOrgs[1].id }, // Different org ID
        },
      });

      console.log('=== QUERY ANALYSIS ===');
      console.log('Searching for org with:');
      console.log('- salesforce_org_id: 00Dxx0000000000EAA');
      console.log('- user_id:', testUsers[1].id);
      console.log('- id not equal to:', testOrgs[1].id);
      console.log('Query result:', existingOrg);
      
      // This should be null for different users
      expect(existingOrg).toBeNull();
    });

    it('should verify database constraint allows different users same org', async () => {
      // Test direct database operations to verify constraint
      try {
        await prisma.organisations.update({
          where: { id: testOrgs[0].id },
          data: { salesforce_org_id: '00Dxx0000000000EAA' },
        });

        await prisma.organisations.update({
          where: { id: testOrgs[1].id },
          data: { salesforce_org_id: '00Dxx0000000000EAA' },
        });

        const orgs = await prisma.organisations.findMany({
          where: { salesforce_org_id: '00Dxx0000000000EAA' },
        });

        console.log('=== DATABASE CONSTRAINT TEST ===');
        console.log('Successfully created orgs with same salesforce_org_id for different users');
        console.log('Number of orgs:', orgs.length);
        console.log('User IDs:', orgs.map(org => org.user_id));

        expect(orgs).toHaveLength(2);
      } catch (error: any) {
        console.log('❌ DATABASE CONSTRAINT ERROR:', error.code, error.message);
        throw error;
      }
    });
  });

  describe('Background OAuth Tests', () => {
    it('should handle background OAuth flow correctly', async () => {
      const request = createMockRequest({
        orgId: testOrgs[0].id,
        userId: testUsers[0].id,
        background: true,
      });

      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
      
      const htmlContent = await response.text();
      expect(htmlContent).toContain('OAUTH_SUCCESS');
      expect(htmlContent).toContain(testOrgs[0].id);
    });

    it('should handle background OAuth error correctly', async () => {
      // Mock token exchange failure
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return Promise.resolve({ ok: false, text: () => 'Token exchange failed' });
        }
        return Promise.resolve({ ok: false });
      });

      const request = createMockRequest({
        orgId: testOrgs[0].id,
        userId: testUsers[0].id,
        background: true,
      });

      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
      
      const htmlContent = await response.text();
      expect(htmlContent).toContain('OAUTH_ERROR');
    });
  });
}); 