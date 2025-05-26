import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/database/prisma'

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
    // Use Better Auth session only
    const betterAuthSession = await auth.api.getSession({
      headers: request.headers,
    })

    if (betterAuthSession?.user) {
      return {
        user: {
          id: betterAuthSession.user.id,
          email: betterAuthSession.user.email || '',
          name: betterAuthSession.user.name || '',
          emailVerified: betterAuthSession.user.emailVerified,
          image: betterAuthSession.user.image,
          createdAt: betterAuthSession.user.createdAt,
          updatedAt: betterAuthSession.user.updatedAt,
        }
      }
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