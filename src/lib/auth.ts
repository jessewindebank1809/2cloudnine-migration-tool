import { betterAuth } from "better-auth"
import { genericOAuth } from "better-auth/plugins"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/database/prisma"
import { autoPromoteAdmin } from "@/lib/auth/admin-check"

// Use placeholder values during build time when secrets aren't available
const getClientId = () => process.env.SALESFORCE_PRODUCTION_CLIENT_ID || 'build-time-placeholder-client-id';
const getClientSecret = () => process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET || 'build-time-placeholder-client-secret';
const getBaseURL = () => process.env.BETTER_AUTH_URL || "http://localhost:3000";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: getBaseURL(),
  secret: process.env.BETTER_AUTH_SECRET || 'build-time-placeholder-secret-key-for-development',
  // Performance optimisations
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'warn' : 'error',
    disabled: process.env.NODE_ENV === 'production',
  },
  // Optimise session handling
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Only update session once per day
    fields: {
      token: "sessionToken", // Map Better Auth's 'token' field to our 'sessionToken' field
      expiresAt: "expires", // Map Better Auth's 'expiresAt' field to our 'expires' field
    },
  },
  callbacks: {
    user: {
      created: async ({ user }: { user: any }) => {
        // Auto-promote admin users based on email
        if (user.email) {
          try {
            // Extract the original email from the unique Salesforce email format
            const originalEmail = user.email.split('+')[0];
            await autoPromoteAdmin(originalEmail, user.id);
          } catch (error) {
            console.error('Error during auto-promotion:', error);
          }
        }
      },
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "salesforce",
          clientId: getClientId(),
          clientSecret: getClientSecret(),
          authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
          tokenUrl: "https://login.salesforce.com/services/oauth2/token",
          userInfoUrl: "https://login.salesforce.com/services/oauth2/userinfo",
          scopes: ["openid", "profile", "email", "api", "refresh_token"],
          pkce: true,
          authorizationUrlParams: {
            prompt: "login",
          },
          mapProfileToUser: (profile) => {
            // Debug: Log the profile to see what fields are available
            console.log('Salesforce profile data:', JSON.stringify(profile, null, 2));
            
            // Create a unique identifier using email + org ID to prevent user collision
            const orgId = profile.organization_id || 'unknown';
            const uniqueEmail = `${profile.email}+${orgId.toLowerCase()}@salesforce.local`;
            
            // Extract instance URL from the custom_domain or rest URL
            const instanceUrl = profile.urls?.custom_domain || 
                              profile.urls?.rest?.replace('/services/data/v{version}/', '') ||
                              null;
            
            return {
              email: uniqueEmail,
              name: profile.name || profile.preferred_username,
              image: profile.picture || profile.photos?.picture,
              // Store original Salesforce data for reference
              salesforceOrgId: profile.organization_id,
              salesforceInstanceUrl: instanceUrl,
            };
          },
        },
      ],
    }),
  ],
})

export type Session = typeof auth.$Infer.Session 