import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { SalesforceClient } from '@/lib/salesforce/client';
import { validateSoqlQuery } from '@/lib/security/soql-sanitizer';
import { handleApiError, createTokenErrorResponse } from '@/lib/salesforce/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, query, returnUrl } = body;

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
      return createTokenErrorResponse(
        new Error('Organisation not connected'),
        orgId,
        returnUrl
      );
    }

    // Get Salesforce client with valid tokens
    const client = await SalesforceClient.createWithValidTokens(orgId, org.org_type === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX');
    
    if (!client) {
      return createTokenErrorResponse(
        new Error('Organisation needs to be reconnected. Please reconnect your Salesforce organisation.'),
        orgId,
        returnUrl
      );
    }

    // Validate SOQL query for security
    try {
      validateSoqlQuery(query);
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Invalid SOQL query', 
          details: validationError instanceof Error ? validationError.message : 'Query validation failed'
        },
        { status: 400 }
      );
    }

    // Execute SOQL query
    const result = await client.query(query);
    if (!result.success) {
      // Check if the error is token-related
      if (result.error && (
        result.error.includes('expired') ||
        result.error.includes('invalid_grant') ||
        result.error.includes('INVALID_SESSION_ID')
      )) {
        return createTokenErrorResponse(
          new Error(result.error),
          orgId,
          returnUrl
        );
      }
      
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
    return handleApiError(error, 'Failed to execute query');
  }
} 