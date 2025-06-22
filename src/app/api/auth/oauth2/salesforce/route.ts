import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { prisma } from '@/lib/database/prisma';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔵 OAuth Initiation - Getting session...');
    const session = await requireAuth(request);
    console.log('🔵 OAuth Initiation - Session retrieved:', {
      userId: session.user.id,
      userEmail: session.user.email,
    });
    
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const instanceUrl = searchParams.get('instanceUrl');
    const background = searchParams.get('background') === 'true';
    const returnUrl = searchParams.get('returnUrl');

    if (!orgId) {
      if (background) {
        return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=missing_params`);
    }

    console.log('🔵 OAuth Initiation - Verifying organisation ownership...');
    // Verify the organisation exists and belongs to the user
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: session.user.id },
    });

    if (!organisation) {
      console.log('❌ OAuth Initiation - Organisation not found:', {
        orgId,
        userId: session.user.id,
      });
      
      if (background) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=org_not_found`);
    }

    console.log('✅ OAuth Initiation - Organisation verified:', {
      orgId: organisation.id,
      orgName: organisation.name,
      userId: organisation.user_id,
    });

    // Determine org type and credentials first
    const orgType = organisation.org_type;

    console.log('🔵 OAuth Initiation - Instance URL resolution:', {
      fromParameter: instanceUrl,
      fromOrganisation: organisation.instance_url,
    });

    // If organisation's instance_url is null/undefined, force reconnection
    if (!organisation.instance_url || organisation.instance_url === 'undefined') {
      console.log('⚠️ OAuth Initiation - Organisation not properly connected, forcing reconnect');
      if (background) {
        return NextResponse.json({ 
          error: 'Organisation not connected', 
          requiresReconnect: true,
          orgId: orgId 
        }, { status: 400 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=org_not_connected&orgId=${encodeURIComponent(orgId)}`);
    }

    // Use instanceUrl from parameter or fall back to organisation's instance URL
    const targetInstanceUrl = instanceUrl || organisation.instance_url;

    if (!targetInstanceUrl) {
      console.log('❌ OAuth Initiation - No valid instance URL provided');
      if (background) {
        return NextResponse.json({ error: 'Instance URL not available' }, { status: 400 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=missing_params`);
    }
    const clientId = orgType === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID!
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID!;

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Generate state parameter with organisation connection data and code verifier
    const stateData = {
      orgId,
      userId: session.user.id,
      orgType,
      targetInstanceUrl,
      codeVerifier,
      background,
      returnUrl,
      timestamp: Date.now(), // Add timestamp for debugging
    };
    
    console.log('🔵 OAuth Initiation - Creating state parameter:', {
      orgId: stateData.orgId,
      userId: stateData.userId,
      orgType: stateData.orgType,
    });
    
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Build OAuth URL with PKCE parameters and force login prompt
    const oauthParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce-org`,
      state,
      scope: 'api refresh_token',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login', // Force user to login even if they have an existing session
    });

    const oauthUrl = `${targetInstanceUrl}/services/oauth2/authorise?${oauthParams.toString()}`;
    
    console.log('✅ OAuth Initiation - Redirecting to Salesforce');
    
    if (background) {
      // Return OAuth URL as JSON for background processing
      return NextResponse.json({ url: oauthUrl });
    } else {
      // Traditional redirect for manual OAuth
      return NextResponse.redirect(oauthUrl);
    }
  } catch (error) {
    console.error('💥 OAuth initiation error:', error);
    
    // Extract background flag from search params
    const { searchParams } = new URL(request.url);
    const background = searchParams.get('background') === 'true';
    
    if (error instanceof Error && error.message === 'Unauthorised') {
      console.log('🚨 OAuth Initiation - Unauthorised error (no valid session)');
      if (background) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=unauthorised`);
    }
    
    if (background) {
      return NextResponse.json({ error: 'OAuth initialisation failed' }, { status: 500 });
    }
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=oauth_init_failed`);
  }
} 