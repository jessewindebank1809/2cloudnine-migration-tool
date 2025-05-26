import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { encrypt } from '@/lib/utils/encryption';
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

    // Decode the state to get the organisation connection data
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      console.error('Invalid state parameter:', e);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=invalid_state`);
    }

    // Handle organisation connection
    const { orgId, userId, orgType, targetInstanceUrl } = stateData;

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
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce-org`,
      code,
    });

    const tokenResponse = await fetch(`${targetInstanceUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
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

    // Check if another organisation already has this Salesforce org ID
    const existingOrg = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: userInfo.organization_id,
        user_id: userId,
        id: { not: orgId }, // Exclude the current org being updated
      },
    });

    if (existingOrg) {
      console.error('Salesforce org already connected:', userInfo.organization_id);
      
      // Clean up the duplicate organisation record that was created
      await prisma.organisations.delete({
        where: { id: orgId },
      });
      
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=org_already_connected`);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = encrypt(tokenData.refresh_token);

    await prisma.organisations.update({
      where: { id: orgId },
      data: {
        salesforce_org_id: userInfo.organization_id,
        instance_url: tokenData.instance_url,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
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