import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { prisma } from '@/lib/database/prisma';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await requireAuth(request);
    
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');
    const instanceUrl = searchParams.get('instanceUrl');
    
    if (!orgId || !instanceUrl) {
      return NextResponse.json(
        { error: 'Organisation ID and instance URL are required' },
        { status: 400 }
      );
    }

    // Get the organisation to determine environment type
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: session.user.id },
    });

    if (!organisation) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    // Select credentials based on org type
    const clientId = organisation.org_type === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: `Salesforce ${organisation.org_type.toLowerCase()} client ID not configured` },
        { status: 500 }
      );
    }

    // Build the OAuth URL for the specific Salesforce instance
    // The user will authenticate against their specific org, but using our central Connected App
    const baseUrl = instanceUrl.includes('test.salesforce.com') 
      ? 'https://test.salesforce.com' 
      : instanceUrl.includes('login.salesforce.com')
      ? 'https://login.salesforce.com'
      : instanceUrl; // For custom domains

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce`;
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Store orgId, original instanceUrl, and PKCE verifier in state parameter
    const state = Buffer.from(JSON.stringify({ 
      orgId, 
      userId: session.user.id,
      orgType: organisation.org_type, // Include org type for callback
      targetInstanceUrl: instanceUrl, // Store the target org's instance URL
      codeVerifier // Store PKCE code verifier for token exchange
    })).toString('base64');

    const authUrl = new URL(`${baseUrl}/services/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email api refresh_token');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'login'); // Force login prompt
    // Add PKCE parameters
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Redirect to Salesforce OAuth
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('OAuth initiation error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
} 