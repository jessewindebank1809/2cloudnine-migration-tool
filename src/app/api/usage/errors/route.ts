import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-check';
import { usageTracker } from '@/lib/usage-tracker';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    await requireAdmin(request);
    
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const migrationId = searchParams.get('migrationId');
    
    // If specific migration ID provided, get replication data
    if (migrationId) {
      const replicationData = await usageTracker.getErrorReplicationData(migrationId);
      
      if (!replicationData) {
        return NextResponse.json(
          { error: 'Migration error data not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: replicationData,
      });
    }
    
    // Otherwise, get error analysis
    const errorAnalysis = await usageTracker.getMigrationErrorAnalysis(days);
    
    return NextResponse.json({
      success: true,
      days,
      data: errorAnalysis,
    });
  } catch (error) {
    console.error('Error in usage errors endpoint:', error);
    
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch error analysis' },
      { status: 500 }
    );
  }
}