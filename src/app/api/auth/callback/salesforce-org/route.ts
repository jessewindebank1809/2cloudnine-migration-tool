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

    console.log('🟢 OAuth Callback - Processing request');

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
      console.log('🟢 OAuth Callback - Decoding state parameter...');
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      console.log('🟢 OAuth Callback - State decoded:', {
        orgId: stateData.orgId,
        userId: stateData.userId,
        orgType: stateData.orgType,
        timestamp: stateData.timestamp,
      });
    } catch {
      console.error('💥 OAuth Callback - Invalid state parameter');
      return NextResponse.redirect(`${baseUrl}/orgs?error=invalid_state`);
    }

    // Handle organisation connection
    const { orgId, userId, orgType, targetInstanceUrl, codeVerifier, background, timestamp } = stateData;

    // Basic timestamp validation (optional)
    if (timestamp && Date.now() - timestamp > 30 * 60 * 1000) { // 30 minutes max
      console.warn('⚠️ OAuth Callback - State is quite old, but proceeding...');
    }

    console.log('🟢 OAuth Callback - Verifying organisation ownership...');
    // Verify the organisation exists and belongs to the user
    const organisation = await prisma.organisations.findFirst({
      where: { id: orgId, user_id: userId },
    });

    if (!organisation) {
      console.error('❌ OAuth Callback - Organisation not found:', {
        orgId,
        userId,
      });
      
      // Additional debugging: check if org exists but with different user
      const orgCheck = await prisma.organisations.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, user_id: true },
      });
      
      if (orgCheck) {
        console.error('⚠️ Organisation exists but belongs to different user:', {
          orgId: orgCheck.id,
          actualUserId: orgCheck.user_id,
          stateUserId: userId,
        });
        console.error('🚨 This indicates a potential session or state management issue!');
      }
      
      return NextResponse.redirect(`${baseUrl}/orgs?error=org_not_found`);
    }

    console.log('✅ OAuth Callback - Organisation verified:', {
      orgId: organisation.id,
      orgName: organisation.name,
    });

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
        'Authorisation': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to fetch user info');
      return NextResponse.redirect(`${baseUrl}/orgs?error=userinfo_failed`);
    }

    const userInfo = await userInfoResponse.json();

    console.log('🟢 OAuth Callback - Retrieved Salesforce org info:', {
      organisationId: userInfo.organization_id,
      userId: userInfo.user_id,
    });

    console.log('🟢 OAuth Callback - Performing duplicate check...');
    // Check if another organisation already has this Salesforce org ID
    const existingOrg = await prisma.organisations.findFirst({
      where: {
        salesforce_org_id: userInfo.organization_id,
        user_id: userId,
        id: { not: orgId }, // Exclude the current org being updated
      },
    });

    console.log('🟢 OAuth Callback - Duplicate check query:', {
      salesforceOrgId: userInfo.organization_id,
      userId: userId,
      excludeOrgId: orgId,
      foundExisting: !!existingOrg,
    });

    if (existingOrg) {
      console.error('🚨 OAuth Callback - Duplicate org found!');
      console.error('   User:', userId, 'already has org connected to Salesforce org:', userInfo.organization_id);
      console.error('   Existing org:', existingOrg.id, existingOrg.name);
      console.error('   This should only happen if same user tries to connect same org twice');
      
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

    console.log('🟢 OAuth Callback - Updating organisation with tokens...');
    try {
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
      
      console.log('✅ OAuth Callback - Organisation updated successfully');
    } catch (dbError: unknown) {
      // Handle database constraint violations (e.g., duplicate salesforce_org_id for same user)
      if (dbError && typeof dbError === 'object' && 'code' in dbError && dbError.code === 'P2002' && 
          'meta' in dbError && dbError.meta && typeof dbError.meta === 'object' && 
          'target' in dbError.meta && Array.isArray(dbError.meta.target) && 
          dbError.meta.target.includes('salesforce_org_id')) {
        console.error('💥 Database constraint violation:', {
          code: (dbError as any).code,
          constraint: (dbError as any).meta?.target,
          salesforceOrgId: userInfo.organization_id,
          userId: userId,
        });
        console.error('   This means the database constraint prevented the update');
        console.error('   Constraint should be: @@unique([salesforce_org_id, user_id])');
        
        // Clean up the organisation record that was created
        await prisma.organisations.delete({
          where: { id: orgId },
        });
        
        return NextResponse.redirect(`${baseUrl}/orgs?error=org_already_connected`);
      }
      throw dbError; // Re-throw if it's not a constraint violation we can handle
    }

    // Clear token cache to ensure fresh tokens are used
    const tokenManager = TokenManager.getInstance();
    tokenManager.clearTokenCache(orgId);

    console.log('🎉 OAuth Callback - Successfully connected organisation:', organisation.name);
    
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
    console.error('💥 OAuth callback error:', error);
    
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
    } catch (_e) {
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