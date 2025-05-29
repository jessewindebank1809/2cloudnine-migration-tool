# CI/CD Pipeline - Quick Start

This repository includes a complete CI/CD pipeline for deploying the TC9
Migration Tool to Fly.io with GitHub Actions.

## 🚀 Quick Setup

### Prerequisites

- Fly CLI installed and authenticated
- Access to the `2cloudnine` organisation on Fly.io
- GitHub repository with `main` and `develop` branches

### 1. Run the Setup Script

```bash
./scripts/deployment/setup-cicd.sh
```

This script will:

- Create Fly.io applications (production & staging) in 2cloudnine organisation
- Set up PostgreSQL databases in 2cloudnine organisation
- Generate security secrets
- Provide configuration instructions

### 2. Configure GitHub Secrets

Add your Fly.io API token to GitHub:

```bash
# Get your token
fly auth token

# Add to GitHub: Settings → Secrets → FLY_API_TOKEN
```

### 3. Configure Salesforce Secrets

Set your Salesforce credentials:

```bash
# Production
fly secrets set SALESFORCE_CLIENT_ID="your_prod_id" --app tc9-migration-tool
fly secrets set SALESFORCE_CLIENT_SECRET="your_prod_secret" --app tc9-migration-tool

# Staging  
fly secrets set SALESFORCE_CLIENT_ID="your_staging_id" --app tc9-migration-tool-staging
fly secrets set SALESFORCE_CLIENT_SECRET="your_staging_secret" --app tc9-migration-tool-staging
```

## 📋 Workflow Overview

| Trigger           | Environment | Workflow                | Description                  |
| ----------------- | ----------- | ----------------------- | ---------------------------- |
| Push to `develop` | Staging     | `deploy-staging.yml`    | Auto-deploy to staging       |
| Push to `main`    | Production  | `deploy-production.yml` | Auto-deploy to production    |
| Pull Request      | -           | `ci.yml`                | Run tests & build            |
| Manual            | Any         | `rollback.yml`          | Rollback to previous version |

## 🌐 Application URLs

- **Production**: https://tc9-migration-tool.fly.dev
- **Staging**: https://tc9-migration-tool-staging.fly.dev
- **Health Checks**: Add `/api/health` to any URL

## 🔧 Local Deployment

Use the enhanced deployment script:

```bash
# Deploy to staging
./scripts/deployment/deploy-enhanced.sh staging

# Deploy to production  
./scripts/deployment/deploy-enhanced.sh production

# Get help
./scripts/deployment/deploy-enhanced.sh --help
```

## 📚 Documentation

- **Complete Setup Guide**: [docs/CI-CD-SETUP.md](docs/CI-CD-SETUP.md)
- **Troubleshooting**: See the setup guide for common issues
- **Security**: All secrets are managed via Fly.io and GitHub

## 🚨 Emergency Procedures

### Quick Rollback

1. Go to GitHub Actions
2. Run "Rollback Deployment" workflow
3. Select environment and version

### Manual Deployment

```bash
fly deploy --app tc9-migration-tool          # Production
fly deploy --app tc9-migration-tool-staging  # Staging
```

## ✅ What's Included

- ✅ Automated testing and linting
- ✅ Staging and production environments
- ✅ Database migrations
- ✅ Health checks
- ✅ Security scanning
- ✅ Automatic releases
- ✅ Rollback capability
- ✅ Comprehensive monitoring

## 🔍 Monitoring

Check application status:

```bash
fly status --app tc9-migration-tool
fly logs --app tc9-migration-tool
```

---

**Need help?** Check the [complete setup guide](docs/CI-CD-SETUP.md) or run
`./scripts/deployment/setup-cicd.sh --help`
