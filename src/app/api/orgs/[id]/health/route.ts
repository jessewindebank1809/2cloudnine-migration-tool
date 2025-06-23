import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/salesforce/session-manager';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await context.params;
    
    // Check if the org session exists and is healthy
    const session = await sessionManager.getSession(orgId);
    
    if (!session) {
      return NextResponse.json({ 
        isHealthy: false, 
        error: 'Organisation not found' 
      });
    }
    
    // Test the connection by making a simple API call
    try {
      const client = await sessionManager.getClient(orgId);
      // Query the org's basic info to verify the connection
      await client.query('SELECT Id FROM Organization LIMIT 1');
      
      return NextResponse.json({ 
        isHealthy: true,
        orgId: orgId
      });
    } catch (error: any) {
      // Check if it's an authentication error
      if (error.name === 'INVALID_SESSION_ID' || 
          error.errorCode === 'INVALID_SESSION_ID' ||
          error.message?.includes('expired') ||
          error.message?.includes('authentication') ||
          error.message?.includes('invalid')) {
        return NextResponse.json({ 
          isHealthy: false, 
          error: 'Access token expired or invalid',
          requiresReauth: true
        });
      }
      
      // Other errors (network, etc.)
      return NextResponse.json({ 
        isHealthy: false, 
        error: error.message || 'Connection failed'
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ 
      isHealthy: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}