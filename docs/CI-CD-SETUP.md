# CI/CD Setup Guide

This guide covers setting up the complete CI/CD pipeline for the TC9 Migration
Tool, including GitHub Actions workflows and Fly.io deployment.

## Overview

The CI/CD pipeline includes:

- **Continuous Integration**: Automated testing, linting, and building on every
  push/PR
- **Staging Deployment**: Automatic deployment to staging environment on
  `develop` branch
- **Production Deployment**: Automatic deployment to production on `main` branch
- **Rollback Capability**: Manual rollback to previous versions
- **Health Monitoring**: Automated health checks and notifications

## Prerequisites

### 1. GitHub Repository Setup

Ensure your repository has the following branches:

- `main` - Production branch
- `develop` - Staging branch

### 2. Fly.io Setup

#### Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

#### Authenticate with Fly.io

```bash
fly auth login
```

#### Create Applications

**Production App:**

```bash
fly apps create tc9-migration-tool --org 2cloudnine
```

**Staging App:**

```bash
fly apps create tc9-migration-tool-staging --org 2cloudnine
```

**Note:** Ensure you have access to the `2cloudnine` organisation on Fly.io. If
you don't have access, contact your organisation administrator.

### 3. Database Setup

#### Production Database

```bash
fly postgres create --name tc9-migration-tool-db --region sjc --org 2cloudnine
fly postgres attach --app tc9-migration-tool tc9-migration-tool-db
```

#### Staging Database

```bash
fly postgres create --name tc9-migration-tool-staging-db --region sjc --org 2cloudnine
fly postgres attach --app tc9-migration-tool-staging tc9-migration-tool-staging-db
```

## GitHub Secrets Configuration

Navigate to your GitHub repository → Settings → Secrets and variables → Actions

### Required Secrets

#### 1. FLY_API_TOKEN

Get your Fly.io API token:

```bash
fly auth token
```

Add this as `FLY_API_TOKEN` in GitHub secrets.

#### 2. Application Secrets

Set the following secrets for both production and staging apps:

**Production:**

```bash
# Salesforce Configuration
fly secrets set SALESFORCE_CLIENT_ID="your_production_client_id" --app tc9-migration-tool
fly secrets set SALESFORCE_CLIENT_SECRET="your_production_client_secret" --app tc9-migration-tool
fly secrets set SALESFORCE_CALLBACK_URL="https://tc9-migration-tool.fly.dev/api/auth/callback/salesforce" --app tc9-migration-tool

# Security Keys
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" --app tc9-migration-tool
fly secrets set ENCRYPTION_KEY="$(openssl rand -hex 32)" --app tc9-migration-tool

# Application URLs
fly secrets set NEXT_PUBLIC_BASE_URL="https://tc9-migration-tool.fly.dev" --app tc9-migration-tool
fly secrets set NEXT_PUBLIC_APP_URL="https://tc9-migration-tool.fly.dev" --app tc9-migration-tool

# Sentry Configuration (if using)
fly secrets set NEXT_PUBLIC_SENTRY_DSN="your_sentry_dsn" --app tc9-migration-tool
fly secrets set SENTRY_DSN="your_sentry_dsn" --app tc9-migration-tool
```

**Staging:**

```bash
# Salesforce Configuration
fly secrets set SALESFORCE_CLIENT_ID="your_staging_client_id" --app tc9-migration-tool-staging
fly secrets set SALESFORCE_CLIENT_SECRET="your_staging_client_secret" --app tc9-migration-tool-staging
fly secrets set SALESFORCE_CALLBACK_URL="https://tc9-migration-tool-staging.fly.dev/api/auth/callback/salesforce" --app tc9-migration-tool-staging

# Security Keys
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" --app tc9-migration-tool-staging
fly secrets set ENCRYPTION_KEY="$(openssl rand -hex 32)" --app tc9-migration-tool-staging

# Application URLs
fly secrets set NEXT_PUBLIC_BASE_URL="https://tc9-migration-tool-staging.fly.dev" --app tc9-migration-tool-staging
fly secrets set NEXT_PUBLIC_APP_URL="https://tc9-migration-tool-staging.fly.dev" --app tc9-migration-tool-staging

# Sentry Configuration (if using)
fly secrets set NEXT_PUBLIC_SENTRY_DSN="your_staging_sentry_dsn" --app tc9-migration-tool-staging
fly secrets set SENTRY_DSN="your_staging_sentry_dsn" --app tc9-migration-tool-staging
```

## Workflow Overview

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**

- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Jobs:**

- **Test & Lint**: Runs tests, linting, and type checking
- **Build**: Builds the application
- **Security**: Runs security audits and secret scanning (PR only)

### 2. Staging Deployment (`.github/workflows/deploy-staging.yml`)

**Triggers:**

- Push to `develop` branch
- Manual trigger via GitHub Actions UI

**Process:**

1. Build application
2. Deploy to `tc9-migration-tool-staging`
3. Run database migrations
4. Perform health check
5. Notify deployment status

### 3. Production Deployment (`.github/workflows/deploy-production.yml`)

**Triggers:**

- Push to `main` branch
- Manual trigger via GitHub Actions UI

**Process:**

1. Build application
2. Verify production secrets
3. Deploy to `tc9-migration-tool` with rolling strategy
4. Run database migrations
5. Perform health checks and smoke tests
6. Create GitHub release
7. Notify deployment status

### 4. Rollback Workflow (`.github/workflows/rollback.yml`)

**Triggers:**

- Manual trigger only

**Process:**

1. Checkout specified version
2. Deploy to selected environment
3. Perform health check
4. Notify rollback status

## Local Development Scripts

### Enhanced Deployment Script

Use the enhanced deployment script for local deployments:

```bash
# Deploy to production
./scripts/deployment/deploy-enhanced.sh production

# Deploy to staging
./scripts/deployment/deploy-enhanced.sh staging

# Get help
./scripts/deployment/deploy-enhanced.sh --help
```

## Monitoring and Health Checks

### Health Check Endpoint

The application includes a health check endpoint at `/api/health` that verifies:

- Application status
- Database connectivity
- Environment information
- Uptime

### Monitoring URLs

- **Production**: https://tc9-migration-tool.fly.dev/api/health
- **Staging**: https://tc9-migration-tool-staging.fly.dev/api/health

## Deployment Process

### Development Workflow

1. **Feature Development**
   ```bash
   git checkout develop
   git checkout -b feature/your-feature
   # Make changes
   git commit -m "feat: your feature"
   git push origin feature/your-feature
   ```

2. **Create Pull Request**
   - Create PR to `develop` branch
   - CI workflow runs automatically
   - Review and merge

3. **Staging Deployment**
   - Merge to `develop` triggers staging deployment
   - Test on staging environment

4. **Production Release**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```
   - Push to `main` triggers production deployment

### Emergency Procedures

#### Quick Rollback

1. Go to GitHub Actions
2. Run "Rollback Deployment" workflow
3. Select environment and version
4. Confirm rollback

#### Manual Deployment

```bash
# Production
fly deploy --app tc9-migration-tool

# Staging
fly deploy --app tc9-migration-tool-staging
```

## Troubleshooting

### Common Issues

#### 1. Deployment Fails with Secret Errors

```bash
# Check secrets are set
fly secrets list --app tc9-migration-tool
fly secrets list --app tc9-migration-tool-staging
```

#### 2. Database Migration Fails

```bash
# Connect to app and run migrations manually
fly ssh console --app tc9-migration-tool
npx prisma migrate deploy
```

#### 3. Health Check Fails

```bash
# Check application logs
fly logs --app tc9-migration-tool

# Check application status
fly status --app tc9-migration-tool
```

#### 4. Build Fails in CI

- Check Node.js version compatibility
- Verify all dependencies are in `package.json`
- Check environment variables in build step

### Debugging Commands

```bash
# View application logs
fly logs --app tc9-migration-tool

# Check application status
fly status --app tc9-migration-tool

# Connect to application console
fly ssh console --app tc9-migration-tool

# View secrets (names only)
fly secrets list --app tc9-migration-tool

# Scale application
fly scale count 2 --app tc9-migration-tool
```

## Security Considerations

### Secret Management

- Never commit secrets to repository
- Use GitHub secrets for CI/CD
- Use Fly.io secrets for runtime configuration
- Rotate secrets regularly

### Access Control

- Limit GitHub repository access
- Use branch protection rules
- Require PR reviews for production changes
- Monitor deployment logs

### Environment Isolation

- Separate staging and production environments
- Use different Salesforce orgs for each environment
- Separate databases and secrets

## Maintenance

### Regular Tasks

1. **Update Dependencies**
   ```bash
   npm audit
   npm update
   ```

2. **Monitor Resource Usage**
   ```bash
   fly status --app tc9-migration-tool
   fly metrics --app tc9-migration-tool
   ```

3. **Database Maintenance**
   ```bash
   # Check database status
   fly postgres connect --app tc9-migration-tool-db
   ```

4. **Log Monitoring**
   ```bash
   # Monitor application logs
   fly logs --app tc9-migration-tool --follow
   ```

### Scaling

#### Horizontal Scaling

```bash
# Scale to multiple instances
fly scale count 3 --app tc9-migration-tool
```

#### Vertical Scaling

```bash
# Increase memory
fly scale memory 2048 --app tc9-migration-tool

# Increase CPU
fly scale vm shared-cpu-2x --app tc9-migration-tool
```

## Support

For issues with:

- **GitHub Actions**: Check workflow logs in GitHub Actions tab
- **Fly.io Deployment**: Check `fly logs` and Fly.io dashboard
- **Application Issues**: Check health endpoint and application logs
- **Database Issues**: Check Postgres logs and connection status

## Next Steps

1. Set up monitoring and alerting
2. Configure backup strategies
3. Implement blue-green deployments
4. Add performance monitoring
5. Set up log aggregation
