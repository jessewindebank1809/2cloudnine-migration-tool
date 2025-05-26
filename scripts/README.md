# Development Scripts

This directory contains utility scripts for development and deployment.

## Development Server Scripts

### `dev-server.sh`

Kills all running Next.js development servers and starts a fresh one on
port 3000.

**Usage:**

```bash
# Direct execution
./scripts/dev-server.sh

# Via npm script
npm run dev:fresh
```

### `dev-server-env.sh`

Same as `dev-server.sh` but loads environment variables from the auth directory.

**Usage:**

```bash
# Direct execution
./scripts/dev-server-env.sh

# Via npm script
npm run dev:fresh:env
```

## What These Scripts Do

1. **Find and kill all running Next.js servers** - Searches for any `next dev`
   processes and terminates them
2. **Check port 3000** - Ensures port 3000 is free by killing any process using
   it
3. **Start fresh server** - Launches a new Next.js development server on port
   3000

## When to Use

- When you have multiple Next.js servers running on different ports
- When port 3000 is occupied by another process
- When you want to ensure a clean development environment
- After making configuration changes that require a server restart

## Features

- ✅ Kills all Next.js development servers
- ✅ Frees up port 3000 specifically
- ✅ Provides clear console output with emojis
- ✅ Handles both regular and environment variable setups
- ✅ Safe error handling for missing processes
