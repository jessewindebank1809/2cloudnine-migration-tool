#!/bin/bash

# Quick Deploy Script - For rapid iteration
# Skips tests and git operations by default

# Set environment variables to skip steps and auto-commit
export SKIP_TESTS=true
export SKIP_GIT=false
export AUTO_COMMIT=true

# Call the main deploy script
./scripts/deploy.sh "$@" 