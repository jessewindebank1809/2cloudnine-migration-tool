import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { autoPromoteAdmin } from '@/lib/auth/admin-check';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Test endpoint to create a user and test admin promotion
 * Only for development/testing purposes
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { email, name = 'Test User' } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: 'User already exists',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
        },
      });
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        id: nanoid(),
        email,
        name,
        emailVerified: true,
      },
    });

    // Try auto-promotion
    await autoPromoteAdmin(email, user.id);

    // Fetch updated user to check role
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, role: true, name: true },
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: updatedUser,
      promoted: updatedUser?.role === 'ADMIN',
    });

  } catch (error) {
    console.error('Error creating test user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}