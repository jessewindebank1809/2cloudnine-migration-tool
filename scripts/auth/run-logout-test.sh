#!/bin/bash

echo "🚀 Starting logout flow test..."
echo "Make sure your development server is running on http://localhost:3000"
echo "And that you're signed in to the application"
echo ""

# Navigate to the project root
cd "$(dirname "$0")/../.."

# Run the puppeteer test
node scripts/auth/test-logout-flow.js 