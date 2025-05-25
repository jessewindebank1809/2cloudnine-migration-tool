import { betterAuth } from "better-auth"
import { genericOAuth } from "better-auth/plugins"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/database/prisma"

// Development bypass flag
export const AUTH_BYPASS_ENABLED = process.env.AUTH_BYPASS === 'true'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // adjust if using different DB
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "salesforce",
          clientId: process.env.SALESFORCE_CLIENT_ID!,
          clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
          authorizationUrl: "https://site-site-6377-dev-ed.scratch.my.salesforce.com/services/oauth2/authorize",
          tokenUrl: "https://site-site-6377-dev-ed.scratch.my.salesforce.com/services/oauth2/token",
          userInfoUrl: "https://site-site-6377-dev-ed.scratch.my.salesforce.com/services/oauth2/userinfo",
          scopes: ["openid", "profile", "email", "api", "refresh_token"],
          pkce: true, // Enable PKCE for enhanced security
          redirectURI: "http://localhost:3000/api/auth/oauth2/callback/salesforce", // Explicitly set callback URL
        },
      ],
    }),
  ],
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
  },
})

// Development bypass session helper
export const createBypassSession = () => {
  if (!AUTH_BYPASS_ENABLED) {
    throw new Error('Auth bypass is not enabled')
  }
  
  return {
    user: {
      id: 'dev-user-1',
      email: 'dev@example.com',
      name: 'Development User',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    session: {
      id: 'dev-session-1',
      userId: 'dev-user-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      token: 'dev-bypass-token',
      ipAddress: '127.0.0.1',
      userAgent: 'Development Bypass'
    }
  }
}

export type Session = typeof auth.$Infer.Session 