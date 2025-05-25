#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment to Fly.io..."

# Check if fly is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI is not installed. Please install it first."
    exit 1
fi

# Check if authenticated
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not authenticated with Fly. Please run 'fly auth login' first."
    exit 1
fi

# Build the application locally first to catch errors early
echo "📦 Building application..."
npm run build

# Set production secrets if not already set
echo "🔐 Setting up secrets..."

# Check if SALESFORCE_CLIENT_ID is set
if ! fly secrets list | grep -q "SALESFORCE_CLIENT_ID"; then
    echo "⚠️  SALESFORCE_CLIENT_ID is not set. Please set it using:"
    echo "   fly secrets set SALESFORCE_CLIENT_ID=your_client_id"
    exit 1
fi

# Check if SALESFORCE_CLIENT_SECRET is set
if ! fly secrets list | grep -q "SALESFORCE_CLIENT_SECRET"; then
    echo "⚠️  SALESFORCE_CLIENT_SECRET is not set. Please set it using:"
    echo "   fly secrets set SALESFORCE_CLIENT_SECRET=your_client_secret"
    exit 1
fi

# Set callback URL
fly secrets set SALESFORCE_CALLBACK_URL=https://tc9-migration-tool.fly.dev/api/auth/salesforce/callback --stage

# Generate security keys if not already set
if ! fly secrets list | grep -q "ENCRYPTION_KEY"; then
    fly secrets set ENCRYPTION_KEY=$(openssl rand -hex 32) --stage
fi

if ! fly secrets list | grep -q "JWT_SECRET"; then
    fly secrets set JWT_SECRET=$(openssl rand -hex 32) --stage
fi

# Deploy the application
echo "🚢 Deploying to Fly.io..."
fly deploy --ha=false

# Run database migrations
echo "🗄️ Running database migrations..."
fly ssh console -C "npx prisma migrate deploy"

# Show app status
echo "✅ Deployment complete!"
fly status

echo "🌐 Your app is available at: https://tc9-migration-tool.fly.dev" 