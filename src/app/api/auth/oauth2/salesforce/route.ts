import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session-helper';
import { prisma } from '@/lib/database/prisma';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const instanceUrl = searchParams.get('instanceUrl');

    if (!orgId || !instanceUrl) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=missing_params`);
    }

    // Verify the organisation exists and belongs to the user
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: session.user.id },
    });

    if (!organisation) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=org_not_found`);
    }

    // Determine org type and credentials
    const orgType = organisation.org_type;
    const clientId = orgType === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID!
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID!;

    // Generate state parameter with organisation connection data
    const state = Buffer.from(JSON.stringify({
      orgId,
      userId: session.user.id,
      orgType,
      targetInstanceUrl: instanceUrl,
    })).toString('base64');

    // Build OAuth URL
    const oauthParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/salesforce-org`,
      state,
      scope: 'api refresh_token',
    });

    const oauthUrl = `${instanceUrl}/services/oauth2/authorize?${oauthParams.toString()}`;
    
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=unauthorized`);
    }
    
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/orgs?error=oauth_init_failed`);
  }
} 