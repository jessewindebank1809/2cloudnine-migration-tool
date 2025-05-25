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
    const cookieStore = cookies()
    
    // First try our Salesforce session cookie
    const salesforceSession = cookieStore.get('salesforce-session')
    if (salesforceSession) {
      try {
        const sessionData = JSON.parse(salesforceSession.value)
        
        // Check if session is expired
        if (new Date(sessionData.expires) > new Date()) {
          // Get fresh user data from database
          const user = await prisma.user.findUnique({
            where: { id: sessionData.userId },
          })

          if (user) {
            return {
              user: {
                id: user.id,
                email: user.email || '',
                name: user.name || '',
                emailVerified: user.emailVerified,
                image: user.image,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              }
            }
          }
        }
      } catch (error) {
        console.error('Error validating Salesforce session:', error)
      }
    }

    // Fallback to Better Auth session if no direct session
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