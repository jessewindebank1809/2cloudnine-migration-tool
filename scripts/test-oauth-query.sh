#!/bin/bash

# Quick OAuth Query Logic Test
# This script runs focused unit tests to identify the query logic issue

set -e

echo "🔍 Testing OAuth Query Logic..."

# Check database connection
if [ -z "$DATABASE_URL" ] && [ -z "$TEST_DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL or TEST_DATABASE_URL must be set"
    exit 1
fi

if [ -z "$TEST_DATABASE_URL" ]; then
    export TEST_DATABASE_URL="$DATABASE_URL"
fi

echo "📊 Database: $TEST_DATABASE_URL"

# Generate Prisma client
npm run db:generate > /dev/null 2>&1

# Run focused unit test
echo "🧪 Running query logic tests..."
npx jest tests/unit/oauth-query-logic.test.ts \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --testTimeout=10000

echo "✅ Query logic tests completed!" 