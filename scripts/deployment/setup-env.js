const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a secure secret
const generateSecret = () => crypto.randomBytes(32).toString('hex');

// Template for environment variables
const envTemplate = `# Database
DATABASE_URL="postgresql://username:password@localhost:5432/tc9_migration_tool"

# Better Auth - REQUIRED
BETTER_AUTH_SECRET="${generateSecret()}"
BETTER_AUTH_URL="http://localhost:3000"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Salesforce OAuth (configure these when setting up Salesforce integration)
SALESFORCE_CLIENT_ID="your-salesforce-connected-app-client-id"
SALESFORCE_CLIENT_SECRET="your-salesforce-connected-app-client-secret"
SALESFORCE_REDIRECT_URI="http://localhost:3000/api/auth/callback/salesforce"

# Encryption key for Salesforce tokens
ENCRYPTION_KEY="${generateSecret()}"
`;

const envPath = path.join(__dirname, '..', '.env.local');

// Check if .env.local already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env.local already exists');
  console.log('Please manually update it with the required variables:');
  console.log('\n' + envTemplate);
} else {
  // Create .env.local
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env.local with generated secrets');
  console.log('📝 Please update the DATABASE_URL with your actual database connection string');
  console.log('📝 Update Salesforce OAuth credentials when ready to connect to Salesforce');
}

console.log('\n🔧 Next steps:');
console.log('1. Update DATABASE_URL in .env.local');
console.log('2. Run: npm run db:migrate');
console.log('3. Run: npm run dev'); 