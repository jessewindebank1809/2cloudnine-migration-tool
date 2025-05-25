const crypto = require('crypto');

// Simulate the OAuth URL generation logic
function generateOAuthUrl() {
  const baseUrl = 'https://login.salesforce.com';
  const clientId = process.env.SALESFORCE_PRODUCTION_CLIENT_ID || 'test-client-id';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/salesforce`;
  
  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  // Create state parameter
  const state = Buffer.from(JSON.stringify({ 
    orgId: 'test-org-id', 
    userId: 'test-user-id',
    orgType: 'PRODUCTION',
    targetInstanceUrl: 'https://login.salesforce.com',
    codeVerifier
  })).toString('base64');

  const authUrl = new URL(`${baseUrl}/services/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email api refresh_token');
  authUrl.searchParams.set('state', state);
  // Add PKCE parameters
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    url: authUrl.toString(),
    codeVerifier,
    codeChallenge,
    state
  };
}

console.log('🔧 Testing OAuth URL generation with PKCE...');
console.log('');

const result = generateOAuthUrl();

console.log('🔗 Generated OAuth URL:');
console.log(result.url);
console.log('');

console.log('🔑 PKCE Parameters:');
console.log('  Code Verifier:', result.codeVerifier);
console.log('  Code Challenge:', result.codeChallenge);
console.log('');

console.log('📝 State (decoded):');
const stateData = JSON.parse(Buffer.from(result.state, 'base64').toString());
console.log('  ', JSON.stringify(stateData, null, 2));

console.log('');
console.log('✅ OAuth URL should now include PKCE parameters:');
console.log('  - code_challenge');
console.log('  - code_challenge_method=S256');
console.log('');
console.log('💡 This should resolve the "missing required code challenge" error'); 