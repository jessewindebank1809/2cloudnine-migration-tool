import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { isUserAdmin } from '@/lib/auth/admin-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 5000)
    );

    const authPromise = (async () => {
      const session = await requireAuth(request);
      const isAdmin = await isUserAdmin(session.user.id);
      return { session, isAdmin };
    })();

    const { session, isAdmin } = await Promise.race([authPromise, timeoutPromise]) as any;
    
    return NextResponse.json({
      success: true,
      isAdmin,
      user: {
        id: session.user.id,
        email: session.user.email,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to check admin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}