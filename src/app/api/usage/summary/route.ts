import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-check';
import { usageTracker } from '@/lib/usage-tracker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Require admin access for all usage endpoints
    const session = await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const viewType = searchParams.get('admin') === 'true' ? 'system' : 'user';

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
      // User-specific usage summary (admin viewing their own data)
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
    
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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