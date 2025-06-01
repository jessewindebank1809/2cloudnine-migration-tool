#!/bin/bash

# Script to load environment variables from the auth directory
# This can be sourced by other scripts that need environment variables

ENV_FILE="/Users/jessewindebank/Documents/code/auth/tc9-migration-tool/variables.prod.env"

if [ -f "$ENV_FILE" ]; then
    echo "📋 Loading environment variables from auth directory..."
    source "$ENV_FILE"
    echo "✅ Environment variables loaded from $ENV_FILE"
    echo "🔗 DATABASE_URL: ${DATABASE_URL:0:50}..." # Show first 50 chars for verification
else
    echo "⚠️  Environment file not found at $ENV_FILE"
    echo "❌ Cannot proceed without environment variables"
    exit 1
fi 