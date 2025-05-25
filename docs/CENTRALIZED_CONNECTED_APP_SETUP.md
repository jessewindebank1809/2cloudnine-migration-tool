# Centralized Connected App Setup

## Overview

Instead of creating Connected Apps in each client org, we use ONE Connected App
in our control org that can authenticate users from any Salesforce org.

## Benefits

- ✅ **Zero Setup in Client Orgs**: No Connected App creation needed
- ✅ **Centralized Management**: All OAuth settings in one place
- ✅ **Scalable**: Works with unlimited client orgs
- ✅ **True SaaS Approach**: External tool with minimal client org footprint

## Connected App Configuration

### 1. Create Connected App in Your Control Org

In your dev/test/prod Salesforce org (not client orgs):

1. **Setup → App Manager → New Connected App**
2. **Basic Information**:
   - Connected App Name: `2cloudnine Migration Tool`
   - API Name: `tc9_migration_tool`
   - Contact Email: `your-email@company.com`

3. **API (Enable OAuth Settings)**:
   - ✅ Enable OAuth Settings
   - **Callback URL**: `http://localhost:3000/api/auth/callback/salesforce`
     (dev)
   - **Callback URL**: `https://yourdomain.com/api/auth/callback/salesforce`
     (prod)
   - **Selected OAuth Scopes**:
     - `Access the identity URL service (id, profile, email, address, phone)`
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
     - `Access your basic information (openid)`

4. **Advanced Settings**:
   - ✅ **Enable for Device Flow**: No
   - ✅ **Require Secret for Web Server Flow**: Yes
   - ✅ **Require Secret for Refresh Token**: Yes
   - **IP Relaxation**: `Relax IP restrictions` (for cross-org access)

### 2. Environment Variables

```env
# Your central Connected App credentials
SALESFORCE_CLIENT_ID="3MVG9rZSDEiGkwu_..."  # Consumer Key from your control org
SALESFORCE_CLIENT_SECRET="189AB85D4882C43D..."  # Consumer Secret from your control org

# Your app's callback URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Dev
# NEXT_PUBLIC_APP_URL="https://yourdomain.com"  # Production
```

## How Cross-Org OAuth Works

### Traditional Approach (What We Avoided)

```
Client Org A → Has Connected App A → OAuth through Org A
Client Org B → Has Connected App B → OAuth through Org B
```

### Centralized Approach (What We Implemented)

```
Control Org → Has ONE Connected App → OAuth for any org
├── User from Client Org A → Authenticates via Control App
├── User from Client Org B → Authenticates via Control App
└── User from Client Org C → Authenticates via Control App
```

### OAuth Flow Explanation

1. **User wants to connect Org A**: `sandbox.my.salesforce.com`
2. **OAuth URL**:
   `https://test.salesforce.com/services/oauth2/authorize?client_id=YOUR_CENTRAL_APP_ID`
3. **User authenticates**: Against their specific org (Org A)
4. **Token exchange**: Uses Org A's token endpoint with central app credentials
5. **Result**: Tokens valid for Org A, managed centrally

## Key Technical Points

### 1. Instance URL Routing

```typescript
// OAuth authorization - use target org's login URL
const authUrl = `${targetOrgInstanceUrl}/services/oauth2/authorize`;

// Token exchange - use target org's token URL
const tokenUrl = `${targetOrgInstanceUrl}/services/oauth2/token`;

// API calls - use tokens against target org
const apiUrl = `${targetOrgInstanceUrl}/services/data/v63.0/sobjects/Account`;
```

### 2. State Parameter

```typescript
const state = {
   orgId: "uuid-for-our-db-record",
   userId: "user-id-in-our-system",
   targetInstanceUrl: "https://client-org.my.salesforce.com",
};
```

### 3. Token Storage

```typescript
// Store tokens associated with specific org
await prisma.organisation.update({
   where: { id: orgId },
   data: {
      salesforceOrgId: userInfo.organization_id, // Target org's ID
      instanceUrl: tokenData.instance_url, // Target org's URL
      accessTokenEncrypted: tokenData.access_token,
      refreshTokenEncrypted: tokenData.refresh_token,
   },
});
```

## Advantages of This Approach

1. **Zero Client Org Setup**: No Connected Apps needed in client orgs
2. **Centralized Security**: All OAuth settings managed in one place
3. **Scalable**: Works with unlimited client orgs
4. **Professional**: True SaaS approach with external architecture
5. **Maintainable**: Single point of configuration and updates

## Security Considerations

- **IP Relaxation**: Required for cross-org authentication
- **HTTPS Required**: For production callback URLs
- **State Validation**: Prevents CSRF attacks
- **Token Encryption**: Store tokens securely (implement AES-256-GCM)
- **Token Refresh**: Implement automatic refresh logic

## Testing the Setup

1. **Create test org**: Any Salesforce org for testing
2. **Connect org**: Use the migration tool's "Connect Organisation"
3. **OAuth flow**: Should redirect to test org's login
4. **Authentication**: User logs in with their test org credentials
5. **Success**: Tokens stored and associated with the org record
