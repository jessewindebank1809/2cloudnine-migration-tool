import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { usageTracker } from '@/lib/usage-tracker';
import { prisma } from '@/lib/database/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get session but skip admin check for now
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const viewType = searchParams.get('admin') === 'true' ? 'system' : 'user';

    // Check admin status directly from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true }
    });

    // Allow access if user is admin OR if email contains jesse@2cloudnine.com (temporary)
    const isAdminUser = user?.role === 'ADMIN' || user?.email?.includes('jesse@2cloudnine.com');
    
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (viewType === 'system') {
      // System-wide usage stats
      const stats = await usageTracker.getSystemUsageStats(days);
      return NextResponse.json({
        success: true,
        type: 'system',
        data: stats,
        timeRange: `${days} days`,
      });
    } else {
      // User-specific usage summary
      const summary = await usageTracker.getUserUsageSummary(session.user.id, days);
      return NextResponse.json({
        success: true,
        type: 'user',
        data: summary,
        timeRange: `${days} days`,
      });
    }
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch usage summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}