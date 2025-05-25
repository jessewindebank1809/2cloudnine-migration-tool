# Salesforce Connected App Setup

## Quick Setup Guide

For each Salesforce org you want to use with the 2cloudnine Migration Tool:

### 1. Create Connected App

1. **Setup → Apps → App Manager → New Connected App**

2. **Basic Information:**
   - Connected App Name: `2cloudnine Migration Tool`
   - API Name: `TC9_Migration_Tool`
   - Contact Email: `your-email@company.com`
   - Description: `External migration tool for Salesforce data transfer`

3. **API (Enable OAuth Settings):**
   - ✅ Enable OAuth Settings
   - Callback URL: `http://localhost:3000/api/auth/salesforce/callback`
   - Selected OAuth Scopes:
     - ✅ `Access the identity URL service (id)`
     - ✅ `Access and manage your data (api)`
     - ✅
       `Perform requests on your behalf at any time (refresh_token, offline_access)`
     - ✅ `Access your basic information (openid)`

4. **Security:**
   - ✅ Require Secret for Web Server Flow
   - ✅ Require Secret for Refresh Token Flow
   - IP Relaxation: `Relaxed IP restrictions` (for development)

### 2. Configure Permissions

1. **Manage Connected Apps → Your App → Edit Policies**
2. **OAuth Policies:**
   - Permitted Users: `Admin approved users are pre-authorized`
   - IP Relaxation: `Relaxed IP restrictions`
   - Refresh Token Policy: `Refresh token is valid until revoked`

3. **Create Permission Set:**
   - Name: `TC9 Migration Tool Users`
   - Permissions:
     - ✅ `Modify All Data`
     - ✅ `View All Data`
     - ✅ `API Enabled`

4. **Assign Permission Set** to users who will perform migrations

### 3. Get Credentials

1. **View your Connected App**
2. **Copy Consumer Key and Consumer Secret**
3. **Add to your `.env.local`:**

```env
SALESFORCE_CLIENT_ID="your_consumer_key_here"
SALESFORCE_CLIENT_SECRET="your_consumer_secret_here"
```

## Production Considerations

### For Production Orgs:

- Set stricter IP restrictions
- Use more restrictive OAuth scopes if possible
- Regular credential rotation
- Monitor API usage limits

### For Multiple Orgs:

- You can reuse the same Consumer Key/Secret across orgs
- Consider creating a deployment script
- Document which orgs have the Connected App installed

## Troubleshooting

### Common Issues:

1. **"Invalid Client"** → Check Consumer Key/Secret
2. **"Redirect URI Mismatch"** → Verify callback URL matches exactly
3. **"Insufficient Privileges"** → Check permission sets and profiles
4. **API Limits** → Monitor daily API call limits

### Testing Connection:

```bash
# Test with the migration tool
npm run dev
# Navigate to http://localhost:3000/dashboard
# Click "Connect New Organization"
```
