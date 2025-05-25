# Setting Up Salesforce Authentication

This guide explains how to configure Salesforce as an authentication provider
for the TC9 Migration Tool.

## Prerequisites

1. Access to a Salesforce org (Production, Sandbox, or Developer Edition)
2. System Administrator or equivalent permissions to create Connected Apps

## Step 1: Create a Connected App in Salesforce

1. Log in to your Salesforce org
2. Go to **Setup** > **App Manager**
3. Click **New Connected App**
4. Fill in the basic information:
   - **Connected App Name**: `TC9 Migration Tool`
   - **API Name**: `TC9_Migration_Tool`
   - **Contact Email**: Your email address

## Step 2: Configure OAuth Settings

1. Check **Enable OAuth Settings**
2. Set **Callback URL**: `http://localhost:3000/api/auth/callback/salesforce`
   (for development)
   - For production: `https://yourdomain.com/api/auth/callback/salesforce`
3. **Selected OAuth Scopes**:
   - `Access the identity URL service (id, profile, email, address, phone)`
   - `Access your basic information (id, profile, email, address, phone)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - `Access and manage your data (api)`

4. **Require Secret for Web Server Flow**: Check this box
5. **Require Secret for Refresh Token Flow**: Check this box

## Step 3: Get Your Credentials

After creating the Connected App:

1. Go to **Setup** > **App Manager**
2. Find your app and click the dropdown arrow > **View**
3. Copy the **Consumer Key** (this is your `SALESFORCE_CLIENT_ID`)
4. Click **Click to reveal** next to Consumer Secret and copy it (this is your
   `SALESFORCE_CLIENT_SECRET`)

## Step 4: Environment Variables

Add these to your `.env.local` file:

```env
# Salesforce OAuth (for authentication)
SALESFORCE_CLIENT_ID="your_consumer_key_from_connected_app"
SALESFORCE_CLIENT_SECRET="your_consumer_secret_from_connected_app"
SALESFORCE_AUTH_URL="https://login.salesforce.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL="https://login.salesforce.com/services/oauth2/token"

# Public environment variables (exposed to browser)
NEXT_PUBLIC_SALESFORCE_CLIENT_ID="your_consumer_key_from_connected_app"
```

### For Different Org Types

**Production Orgs:**

```env
SALESFORCE_AUTH_URL="https://login.salesforce.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL="https://login.salesforce.com/services/oauth2/token"
```

**Sandbox Orgs:**

```env
SALESFORCE_AUTH_URL="https://test.salesforce.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL="https://test.salesforce.com/services/oauth2/token"
```

**Scratch Orgs:** Use the scratch org's custom domain (e.g.,
`site-site-6377-dev-ed.scratch.my.salesforce-sites.com`):

```env
SALESFORCE_AUTH_URL="https://your-scratch-org-domain.scratch.my.salesforce-sites.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL="https://your-scratch-org-domain.scratch.my.salesforce-sites.com/services/oauth2/token"
```

## Step 5: Test the Integration

1. Restart your development server
2. Go to `/auth/signin`
3. Click **Continue with Salesforce**
4. You should be redirected to Salesforce login
5. After successful authentication, you'll be redirected back to the home page

## Benefits of Salesforce Authentication

When users authenticate with Salesforce:

1. **Single Sign-On**: Users don't need separate credentials
2. **Auto-Organisation Setup**: Their authenticated org is automatically added
   to their organisation list
3. **Seamless API Access**: OAuth tokens can be used for subsequent API calls
4. **Trust & Security**: Users trust Salesforce's authentication system

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS callback URLs in production
2. **Token Storage**: Access tokens should be encrypted when stored
3. **Scope Limitation**: Only request necessary OAuth scopes
4. **Regular Rotation**: Implement token refresh logic for long-term access

## Troubleshooting

### "Invalid Client ID" Error

- Verify the `SALESFORCE_CLIENT_ID` matches your Connected App's Consumer Key
- Ensure the Connected App is deployed and active

### "Redirect URI Mismatch" Error

- Check that the callback URL in your Connected App settings exactly matches
  your application URL
- For local development, use
  `http://localhost:3000/api/auth/callback/salesforce`

### "Invalid Scope" Error

- Verify all required OAuth scopes are enabled in your Connected App
- Check that scopes in the auth request match what's configured

## Next Steps

Once Salesforce authentication is working:

1. Consider implementing automatic organisation connection for authenticated
   users
2. Set up token refresh logic for long-term API access
3. Add support for multiple Salesforce orgs per user
4. Implement role-based access control based on Salesforce user permissions
