import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { CloningService } from '@/lib/migration/cloning-service';
import { usageTracker } from '@/lib/usage-tracker';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authSession = await requireAuth(request);
    
    // Parse request body
    const body = await request.json();
    const { sourceOrgId, targetOrgId, leaveRuleId } = body;
    
    // Validate required parameters
    if (!sourceOrgId || !targetOrgId || !leaveRuleId) {
      return NextResponse.json(
        { error: 'Missing required parameters: sourceOrgId, targetOrgId, and leaveRuleId are required' },
        { status: 400 }
      );
    }
    
    // Clone the leave rule
    const result = await CloningService.cloneRecord({
      sourceOrgId,
      targetOrgId,
      sourceRecordId: leaveRuleId,
      objectApiName: 'tc9_pr__Leave_Rule__c'
    });
    
    // Track the cloning event
    try {
      await usageTracker.trackEvent({
        eventType: 'leave_rule_cloned',
        userId: authSession.user.id,
        metadata: {
          sourceOrgId,
          targetOrgId,
          leaveRuleId,
          success: result.success,
          error: result.error
        }
      });
    } catch (trackingError) {
      console.error('Failed to track cloning event:', trackingError);
    }
    
    // Return appropriate response
    if (result.success) {
      return NextResponse.json({
        success: true,
        recordId: result.recordId,
        externalId: result.externalId,
        message: result.error || 'Leave rule cloned successfully'
      });
    } else {
      // Check if it's a token-related error
      if (result.error && (
        result.error.includes('invalid_grant') || 
        result.error.includes('expired') ||
        result.error.includes('INVALID_SESSION_ID') ||
        result.error.includes('Authentication token has expired')
      )) {
        return NextResponse.json(
          { 
            error: 'Authentication token has expired. Please reconnect the organisation.',
            code: 'TOKEN_EXPIRED',
            reconnectUrl: '/orgs'
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to clone leave rule'
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in clone-leave-rule endpoint:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to clone leave rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}