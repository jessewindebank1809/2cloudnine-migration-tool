import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/database/prisma'
import { sessionCache } from './session-cache'

export interface AuthSession {
  user: {
    id: string
    email: string
    name: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date
    updatedAt?: Date
  }
}

/**
 * Unified session validation that works with session tokens and Better Auth
 */
export async function getAuthSession(request: NextRequest): Promise<AuthSession | null> {
  try {
    // Extract session token from headers/cookies
    const sessionToken = request.headers.get('cookie')?.match(/better-auth\.session_token=([^;]+)/)?.[1];
    
    if (!sessionToken) {
      return null;
    }

    // Check cache first
    const cachedSession = sessionCache.get(sessionToken);
    if (cachedSession) {
      return {
        user: cachedSession.user
      };
    }

    // Use Better Auth session only if not in cache
    const betterAuthSession = await auth.api.getSession({
      headers: request.headers,
    })

    if (betterAuthSession?.user) {
      const authSession = {
        user: {
          id: betterAuthSession.user.id,
          email: betterAuthSession.user.email || '',
          name: betterAuthSession.user.name || '',
          emailVerified: betterAuthSession.user.emailVerified,
          image: betterAuthSession.user.image,
          createdAt: betterAuthSession.user.createdAt,
          updatedAt: betterAuthSession.user.updatedAt,
        }
      };

      // Cache the session
      sessionCache.set(sessionToken, {
        user: authSession.user,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        cachedAt: Date.now(),
      });

      return authSession;
    }

    return null
  } catch (error) {
    console.error('Session validation error:', error)
    return null
  }
}

/**
 * Simple middleware-style function to validate auth for API routes
 */
export async function requireAuth(request: NextRequest): Promise<AuthSession> {
  try {
    const session = await getAuthSession(request)
    
    if (!session) {
      throw new Error('Unauthorized')
    }
    
    return session
  } catch (error) {
    console.error('Auth validation error:', error)
    throw new Error('Unauthorized')
  }
} 