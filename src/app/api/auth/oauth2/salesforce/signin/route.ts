import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Use production credentials only for user authentication
    const clientId = process.env.SALESFORCE_PRODUCTION_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Salesforce production client ID not configured' },
        { status: 500 }
      );
    }

    // Always use production login URL for user authentication
    const baseUrl = 'https://login.salesforce.com';
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce`;
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Store signin type and PKCE verifier in state parameter
    const state = Buffer.from(JSON.stringify({ 
      type: 'signin',
      codeVerifier, // Store PKCE code verifier for token exchange
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = new URL(`${baseUrl}/services/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email api refresh_token');
    authUrl.searchParams.set('state', state);
    // Add PKCE parameters
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Redirect to Salesforce OAuth
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('OAuth signin initiation error:', error);
    
    return NextResponse.json(
      { error: 'Failed to initiate OAuth signin' },
      { status: 500 }
    );
  }
} 