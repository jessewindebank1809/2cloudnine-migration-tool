import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { SalesforceClient } from '@/lib/salesforce/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, query } = body;

    if (!orgId || !query) {
      return NextResponse.json(
        { error: 'orgId and query are required' },
        { status: 400 }
      );
    }

    // Get organisation from database
    const org = await prisma.organisations.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    if (!org.access_token_encrypted) {
      return NextResponse.json(
        { error: 'Organisation not connected' },
        { status: 401 }
      );
    }

    // Get Salesforce client with valid tokens
    const client = await SalesforceClient.createWithValidTokens(orgId, org.org_type === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX');
    
    if (!client) {
      return NextResponse.json(
        { 
          error: 'Organisation needs to be reconnected. Please reconnect your Salesforce organisation.',
          code: 'RECONNECT_REQUIRED',
          reconnectUrl: `/orgs?reconnect=${orgId}`
        },
        { status: 401 }
      );
    }

    // Execute SOQL query
    const result = await client.query(query);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to execute query', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      records: result.data || [],
      totalSize: result.totalSize || 0
    });

  } catch (error) {
    console.error('Salesforce query error:', error);
    
    // Check if it's a token-related error
    if (error instanceof Error && (
      error.message.includes('invalid_grant') || 
      error.message.includes('expired') ||
      error.message.includes('INVALID_SESSION_ID') ||
      error.message.includes('Authentication token has expired')
    )) {
      return NextResponse.json(
        { 
          error: 'Authentication token has expired. Please reconnect the organisation.',
          code: 'TOKEN_EXPIRED'
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to execute query' },
      { status: 500 }
    );
  }
} 