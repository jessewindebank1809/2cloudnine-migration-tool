import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import crypto from 'crypto';

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
  scope: string;
}

interface SalesforceUserInfo {
  user_id: string;
  organization_id: string;
  username: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  organization_type: string;
  photos: {
    picture: string;
    thumbnail: string;
  };
}

async function handleSigninCallback(request: NextRequest, code: string, stateData: any): Promise<NextResponse> {
  try {
    const clientId = process.env.SALESFORCE_PRODUCTION_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Salesforce production credentials');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=config_error`);
    }

    // Exchange code for tokens using PKCE
    const tokenUrl = 'https://login.salesforce.com/services/oauth2/token';
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce`,
      code: code,
      code_verifier: stateData.codeVerifier,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=token_exchange_failed`);
    }

    const tokenData: SalesforceTokenResponse = await tokenResponse.json();

    // Get user info from Salesforce
    const userInfoResponse = await fetch(`${tokenData.instance_url}/services/oauth2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info:', await userInfoResponse.text());
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=user_info_failed`);
    }

    const userInfo: SalesforceUserInfo = await userInfoResponse.json();

    // Create or update user in database
    const userName = userInfo.display_name || 
      (userInfo.first_name && userInfo.last_name ? `${userInfo.first_name} ${userInfo.last_name}` : null) || 
      userInfo.email;

    const user = await prisma.user.upsert({
      where: { email: userInfo.email },
      update: {
        name: userName,
        salesforceOrgId: userInfo.organization_id,
        image: userInfo.photos?.picture || null,
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        email: userInfo.email,
        name: userName,
        salesforceOrgId: userInfo.organization_id,
        image: userInfo.photos?.picture || null,
        updatedAt: new Date(),
      },
    });

    // Create a simple session cookie for now - we'll integrate with session helper
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Set session cookie
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/home`);
    response.cookies.set('salesforce-session', JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name,
      sessionToken,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }), {
      httpOnly: false, // Allow client-side access for now
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('OAuth signin callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=callback_error`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=oauth_failed`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=missing_params`);
    }

    // Decode the state to get the request type and data
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      console.error('Invalid state parameter:', e);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=invalid_state`);
    }

    // Check if this is a signin request or organisation connection
    if (stateData.type === 'signin') {
      return handleSigninCallback(request, code, stateData);
    }

    // Handle organisation connection (existing logic)
    const { orgId, userId, orgType, targetInstanceUrl, codeVerifier } = stateData;

    // Verify the organisation exists and belongs to the user
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: userId },
    });

    if (!organisation) {
      console.error('Organisation not found:', orgId);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=org_not_found`);
    }

    // Select credentials based on org type
    const clientId = orgType === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID!
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID!;
    
    const clientSecret = orgType === 'PRODUCTION'
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET!
      : process.env.SALESFORCE_SANDBOX_CLIENT_SECRET!;

    // Exchange the code for tokens using the target org's token endpoint
    // This is key: we use the target org's instance URL for token exchange
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce`,
      code,
    };

    // Add PKCE code verifier if present
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    const tokenResponse = await fetch(`${targetInstanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info to retrieve the org ID
    const userInfoResponse = await fetch(`${tokenData.instance_url}/services/oauth2/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to fetch user info');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=userinfo_failed`);
    }

    const userInfo = await userInfoResponse.json();

    // TODO: Encrypt tokens before storing
    // For now, storing as-is but this should be encrypted in production
    await prisma.organisations.update({
      where: { id: orgId },
      data: {
        salesforce_org_id: userInfo.organization_id,
        instance_url: tokenData.instance_url,
        access_token_encrypted: tokenData.access_token, // TODO: Encrypt
        refresh_token_encrypted: tokenData.refresh_token, // TODO: Encrypt
        token_expires_at: tokenData.issued_at ? new Date(parseInt(tokenData.issued_at)) : null,
        updated_at: new Date(),
      },
    });

    console.log('Successfully connected organisation:', organisation.name);
    
    // Redirect back to organisations page with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?success=connected`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=callback_failed`);
  }
} 