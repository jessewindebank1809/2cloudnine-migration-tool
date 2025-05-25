import { NextRequest, NextResponse } from 'next/server'
import { AUTH_BYPASS_ENABLED, createBypassSession } from '@/lib/auth'
import { prisma } from '@/lib/database/prisma'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  if (!AUTH_BYPASS_ENABLED) {
    return NextResponse.json(
      { error: 'Auth bypass is not enabled' },
      { status: 403 }
    )
  }

  try {
    // Create a mock session for development
    const sessionData = createBypassSession()
    
    // Ensure the dev user exists in the database
    console.log('Creating/updating dev user:', sessionData.user.id, sessionData.user.email);
    const user = await prisma.user.upsert({
      where: { id: sessionData.user.id },
      create: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: sessionData.user.name,
        emailVerified: sessionData.user.emailVerified,
        createdAt: sessionData.user.createdAt,
        updatedAt: sessionData.user.updatedAt,
      },
      update: {
        updatedAt: new Date(),
      },
    })
    console.log('User created/updated successfully:', user.id)
    
    // Create a proper Better Auth session in the database
    const session = await prisma.session.create({
      data: {
        id: sessionData.session.id,
        userId: user.id,
        expiresAt: sessionData.session.expiresAt,
        token: sessionData.session.token,
        ipAddress: sessionData.session.ipAddress,
        userAgent: sessionData.session.userAgent || 'Development Bypass',
      },
    })
    console.log('Session created in database:', session.id)
    
    // Set the Better Auth session cookie format
    const cookieStore = cookies()
    cookieStore.set('better-auth.session_token', session.token, {
      httpOnly: true,
      secure: false, // Allow HTTP for local development
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
      sameSite: 'lax'
    })

    // Return the session data in the format expected by the client
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        token: session.token
      }
    })
  } catch (error) {
    console.error('Bypass auth error:', error)
    return NextResponse.json(
      { error: 'Failed to create bypass session' },
      { status: 500 }
    )
  }
} 