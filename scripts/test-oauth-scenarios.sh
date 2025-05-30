#!/bin/bash

# OAuth Callback Test Runner
# This script sets up the test environment and runs the OAuth callback tests

set -e

echo "🚀 Starting OAuth Callback Tests..."

# Check if database is available
if [ -z "$DATABASE_URL" ] && [ -z "$TEST_DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL or TEST_DATABASE_URL must be set"
    echo "Please set one of these environment variables:"
    echo "  export TEST_DATABASE_URL='postgresql://user:password@localhost:5432/test_db'"
    echo "  export DATABASE_URL='postgresql://user:password@localhost:5432/your_db'"
    exit 1
fi

# Set test database URL if not provided
if [ -z "$TEST_DATABASE_URL" ]; then
    export TEST_DATABASE_URL="$DATABASE_URL"
fi

echo "📊 Database URL: $TEST_DATABASE_URL"

# Generate Prisma client if needed
echo "🔧 Generating Prisma client..."
npm run db:generate

# Apply migrations to test database
echo "🔄 Applying database migrations..."
npx prisma db push --force-reset

echo "🧪 Running OAuth callback tests..."

# Run the specific test file with verbose output
npx jest tests/integration/api/oauth-callback.test.ts \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --testTimeout=30000

echo "✅ OAuth callback tests completed!"

# Optional: Show test coverage for the callback route
echo "📈 Generating coverage report for callback route..."
npx jest tests/integration/api/oauth-callback.test.ts \
    --coverage \
    --collectCoverageFrom="src/app/api/auth/callback/**/*.ts" \
    --coverageReporters=text \
    --silent

echo "🎉 All done! Check the output above for test results and error analysis." 