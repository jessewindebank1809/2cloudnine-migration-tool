import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, promoteToAdmin } from '@/lib/auth/admin-check';
import { prisma } from '@/lib/database/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Require admin access
    await requireAdmin(request);
    
    const { email, userId } = await request.json();
    
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or userId is required' },
        { status: 400 }
      );
    }
    
    let targetUserId = userId;
    
    // If email provided, find user by email
    if (email && !userId) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      targetUserId = user.id;
    }
    
    // Promote user to admin
    await promoteToAdmin(targetUserId);
    
    return NextResponse.json({
      success: true,
      message: 'User promoted to admin successfully',
      userId: targetUserId,
    });
    
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to promote user to admin',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}