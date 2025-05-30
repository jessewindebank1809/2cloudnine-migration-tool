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

# Deployment Scripts

This directory contains scripts for deploying the TC9 Migration Tool to
different environments.

## Scripts Overview

### `deploy.sh` - Full Deployment Script

The main deployment script that handles the complete deployment process:

1. **Prerequisites Check**: Validates tools and environment
2. **Local Tests**: Runs type checking, linting, and build tests
3. **Git Operations**: Commits changes and pushes to remote
4. **Fly Deployment**: Deploys to Fly.io with proper configuration
5. **Database Migrations**: Runs Prisma migrations on the deployed app
6. **Health Checks**: Verifies the deployment is working

#### Usage

```bash
# Deploy current branch to staging
./scripts/deploy.sh

# Deploy specific branch to staging
./scripts/deploy.sh staging develop

# Deploy to production
./scripts/deploy.sh production main

# Deploy with help
./scripts/deploy.sh --help
```

#### Environment Variables

- `SKIP_TESTS=true` - Skip local tests and checks
- `SKIP_GIT=true` - Skip git operations (commit and push)

```bash
# Skip tests for faster deployment
SKIP_TESTS=true ./scripts/deploy.sh staging

# Skip both tests and git
SKIP_TESTS=true SKIP_GIT=true ./scripts/deploy.sh staging
```

### `quick-deploy.sh` - Rapid Iteration Script

A wrapper around `deploy.sh` that skips tests and git operations by default.
Perfect for rapid development iterations when you want to quickly test changes
on staging.

#### Usage

```bash
# Quick deploy to staging (skips tests and git)
./scripts/quick-deploy.sh

# Quick deploy to production (still asks for confirmation)
./scripts/quick-deploy.sh production
```

## Deployment Workflow

### For Development (Staging)

1. **Make your changes** in your local environment
2. **Test locally** if needed: `npm run dev`
3. **Quick deploy**: `./scripts/quick-deploy.sh`
4. **Test on staging**: Visit https://tc9-migration-tool-staging.fly.dev
5. **If issues**: Fix locally and repeat step 3

### For Production Release

1. **Ensure you're on main branch**: `git checkout main`
2. **Pull latest changes**: `git pull origin main`
3. **Run full deployment**: `./scripts/deploy.sh production`
4. **Verify production**: Visit https://tc9-migration-tool.fly.dev

## Environment Configuration

### Staging

- **App**: `tc9-migration-tool-staging`
- **URL**: https://tc9-migration-tool-staging.fly.dev
- **Expected Branch**: `develop`
- **Strategy**: Immediate deployment

### Production

- **App**: `tc9-migration-tool`
- **URL**: https://tc9-migration-tool.fly.dev
- **Expected Branch**: `main`
- **Strategy**: Rolling deployment

## Troubleshooting

### Common Issues

1. **"Not authenticated with Fly.io"**
   ```bash
   flyctl auth login
   ```

2. **"Must be run from project root"**
   ```bash
   cd /path/to/tc9-migration-tool
   ./scripts/deploy.sh
   ```

3. **Health check failures**
   - Check Fly logs: `flyctl logs --app tc9-migration-tool-staging`
   - Restart machines: `flyctl machine restart --app tc9-migration-tool-staging`

4. **Migration failures**
   ```bash
   # Run migrations manually
   flyctl ssh console --app tc9-migration-tool-staging -C "npx prisma migrate deploy"
   ```

### Debug Mode

For more verbose output, you can modify the scripts to add debug information:

```bash
# Add debug to see all commands
set -x
./scripts/deploy.sh staging
```

## Benefits of This Approach

✅ **Local Control**: Full control over deployment process ✅ **Environment
Variables**: Uses your local environment variables ✅ **Fast Iteration**: Quick
deploy script for rapid testing ✅ **Reliability**: No GitHub Actions timing
issues ✅ **Flexibility**: Easy to customise and debug ✅ **Comprehensive**:
Includes all necessary checks and validations

## Migration from GitHub Actions

If you want to disable GitHub Actions deployment:

1. **Rename or move** the workflow files:
   ```bash
   mv .github/workflows/deploy-staging.yml .github/workflows/deploy-staging.yml.disabled
   mv .github/workflows/deploy-production.yml .github/workflows/deploy-production.yml.disabled
   ```

2. **Use the deployment scripts** instead:
   ```bash
   # For staging deployments
   ./scripts/deploy.sh staging

   # For production deployments
   ./scripts/deploy.sh production
   ```

This gives you complete control over when and how deployments happen, without
the complexity and potential issues of GitHub Actions.
