import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { encrypt } from '@/lib/utils/encryption';
import { TokenManager } from '@/lib/salesforce/token-manager';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Get the base URL from the request or environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(`${baseUrl}/orgs?error=oauth_failed`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/orgs?error=missing_params`);
    }

    // Decode the state to get the organisation connection data
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (_) {
      console.error('Invalid state parameter');
      return NextResponse.redirect(`${baseUrl}/orgs?error=invalid_state`);
    }

    // Handle organisation connection
    const { orgId, userId, orgType, targetInstanceUrl, codeVerifier, background } = stateData;

    // Verify the organisation exists and belongs to the user
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: userId },
    });

    if (!organisation) {
      console.error('Organisation not found:', orgId);
      return NextResponse.redirect(`${baseUrl}/orgs?error=org_not_found`);
    }

    // Select credentials based on org type
    const clientId = orgType === 'PRODUCTION' 
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_ID!
      : process.env.SALESFORCE_SANDBOX_CLIENT_ID!;
    
    const clientSecret = orgType === 'PRODUCTION'
      ? process.env.SALESFORCE_PRODUCTION_CLIENT_SECRET!
      : process.env.SALESFORCE_SANDBOX_CLIENT_SECRET!;

    // Exchange the code for tokens using the target org's token endpoint with PKCE
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${baseUrl}/api/auth/callback/salesforce-org`,
      code,
      code_verifier: codeVerifier, // Include PKCE code verifier
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
      return NextResponse.redirect(`${baseUrl}/orgs?error=token_exchange_failed`);
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
      return NextResponse.redirect(`${baseUrl}/orgs?error=userinfo_failed`);
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
      
      return NextResponse.redirect(`${baseUrl}/orgs?error=org_already_connected`);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = encrypt(tokenData.refresh_token);

    // Calculate proper expiration time (Salesforce tokens typically last 2 hours)
    const tokenExpiresAt = tokenData.issued_at 
      ? new Date(parseInt(tokenData.issued_at) + (2 * 60 * 60 * 1000)) // issued_at + 2 hours
      : new Date(Date.now() + (2 * 60 * 60 * 1000)); // fallback: now + 2 hours

    await prisma.organisations.update({
      where: { id: orgId },
      data: {
        salesforce_org_id: userInfo.organization_id,
        instance_url: tokenData.instance_url,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date(),
      },
    });

    // Clear token cache to ensure fresh tokens are used
    const tokenManager = TokenManager.getInstance();
    tokenManager.clearTokenCache(orgId);

    console.log('Successfully connected organisation:', organisation.name);
    
    if (background) {
      // For background OAuth, return an HTML page that sends a message to the parent window
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Success</title>
        </head>
        <body>
          <script>
            // Send success message to parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_SUCCESS', orgId: '${orgId}' }, '${baseUrl}');
            }
            // Close the popup
            window.close();
          </script>
          <p>Authentication successful. This window will close automatically.</p>
        </body>
        </html>
      `;
      
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      // Traditional redirect for manual OAuth
      return NextResponse.redirect(`${baseUrl}/orgs?success=connected`);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Get the base URL from the request or environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    
    // Extract background flag from state if possible
    let isBackground = false;
    try {
      const searchParams = request.nextUrl.searchParams;
      const state = searchParams.get('state');
      if (state) {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        isBackground = stateData.background;
      }
    } catch (e) {
      // Ignore state parsing errors in error handler
    }
    
    if (isBackground) {
      // For background OAuth, return an HTML page that sends an error message
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Error</title>
        </head>
        <body>
          <script>
            // Send error message to parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'callback_failed' }, '${baseUrl}');
            }
            // Close the popup
            window.close();
          </script>
          <p>Authentication failed. This window will close automatically.</p>
        </body>
        </html>
      `;
      
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      return NextResponse.redirect(`${baseUrl}/orgs?error=callback_failed`);
    }
  }
} 