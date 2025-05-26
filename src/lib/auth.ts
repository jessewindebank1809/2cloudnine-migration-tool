import { betterAuth } from "better-auth"
import { genericOAuth } from "better-auth/plugins"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/database/prisma"



export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "salesforce",
          clientId: process.env.SALESFORCE_PRODUCTION_CLIENT_ID!,
          clientSecret: process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET!,
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
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    fields: {
      token: "sessionToken", // Map Better Auth's 'token' field to our 'sessionToken' field
      expiresAt: "expires", // Map Better Auth's 'expiresAt' field to our 'expires' field
    },
  },
})



export type Session = typeof auth.$Infer.Session 