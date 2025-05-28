import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { prisma } from '@/lib/database/prisma';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const instanceUrl = searchParams.get('instanceUrl');
    const background = searchParams.get('background') === 'true';

    if (!orgId) {
      if (background) {
        return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=missing_params`);
    }

    // Verify the organisation exists and belongs to the user
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: session.user.id },
    });

    if (!organisation) {
      if (background) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=org_not_found`);
    }

    // Use instanceUrl from parameter or fall back to organisation's instance URL
    const targetInstanceUrl = instanceUrl || organisation.instance_url;

    if (!targetInstanceUrl) {
      if (background) {
        return NextResponse.json({ error: 'Instance URL not available' }, { status: 400 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=missing_params`);
    }

    // Determine org type and credentials
    const orgType = organisation.org_type;
    const clientId = orgType === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID!
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID!;

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Generate state parameter with organisation connection data and code verifier
    const state = Buffer.from(JSON.stringify({
      orgId,
      userId: session.user.id,
      orgType,
      targetInstanceUrl,
      codeVerifier, // Include code verifier in state for callback
      background, // Include background flag
    })).toString('base64');

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

    const oauthUrl = `${targetInstanceUrl}/services/oauth2/authorize?${oauthParams.toString()}`;
    
    if (background) {
      // Return OAuth URL as JSON for background processing
      return NextResponse.json({ url: oauthUrl });
    } else {
      // Traditional redirect for manual OAuth
      return NextResponse.redirect(oauthUrl);
    }
  } catch (error) {
    console.error('OAuth initiation error:', error);
    
    // Extract background flag from search params
    const { searchParams } = new URL(request.url);
    const background = searchParams.get('background') === 'true';
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      if (background) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=unauthorized`);
    }
    
    if (background) {
      return NextResponse.json({ error: 'OAuth initialization failed' }, { status: 500 });
    }
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=oauth_init_failed`);
  }
} 