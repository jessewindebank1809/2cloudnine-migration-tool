import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { prisma } from '@/lib/database/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await context.params;
    
    // First check if the org exists in the database
    const org = await prisma.organisations.findUnique({
      where: { id: orgId },
      select: { 
        id: true, 
        name: true, 
        access_token_encrypted: true,
        refresh_token_encrypted: true 
      }
    });
    
    if (!org) {
      return NextResponse.json({ 
        isHealthy: false, 
        error: 'Organisation not found' 
      });
    }
    
    // Check if org has tokens
    if (!org.access_token_encrypted) {
      return NextResponse.json({ 
        isHealthy: false, 
        error: 'Organisation not connected. Please reconnect.',
        requiresReauth: true
      });
    }
    
    // Test the connection by making a simple API call
    try {
      const client = await sessionManager.getClient(orgId);
      // Query the org's basic info to verify the connection
      const result = await client.query('SELECT Id FROM Organization LIMIT 1');
      
      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }
      
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
    
    // Check if it's a specific connection error
    if (error instanceof Error && 
        (error.message.includes('not connected') || 
         error.message.includes('tokens expired'))) {
      return NextResponse.json({ 
        isHealthy: false, 
        error: error.message,
        requiresReauth: true
      });
    }
    
    return NextResponse.json({ 
      isHealthy: false, 
      error: 'Failed to validate organisation connection' 
    });
  }
}