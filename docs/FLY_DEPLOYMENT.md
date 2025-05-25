# Fly.io Deployment Guide for 2cloudnine Migration Tool

## 🚀 Quick Start

The app has been created under the **2cloudnine** organization on Fly.io.

### Prerequisites

1. Fly CLI installed and authenticated
2. Salesforce Connected App credentials

### App Details

- **App Name**: tc9-migration-tool
- **Organization**: 2cloudnine
- **URL**: https://tc9-migration-tool.fly.dev
- **Region**: San Jose (sjc)
- **Database**: PostgreSQL (automatically provisioned)

## 📝 Pre-Deployment Setup

### 1. Set Salesforce Credentials

You must set your Salesforce OAuth credentials before deploying:

```bash
# Set your Salesforce Connected App credentials
fly secrets set SALESFORCE_CLIENT_ID=your_actual_client_id
fly secrets set SALESFORCE_CLIENT_SECRET=your_actual_client_secret
```

### 2. Verify Secrets

Check that all required secrets are set:

```bash
fly secrets list
```

You should see:

- `DATABASE_URL` (automatically set by Fly.io)
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`

## 🚢 Deploy the Application

Run the deployment script:

```bash
./scripts/deploy.sh
```

Or deploy manually:

```bash
# Deploy the application
fly deploy

# Run database migrations
fly ssh console -C "npx prisma migrate deploy"
```

## 🔧 Post-Deployment

### 1. Verify Deployment

```bash
# Check app status
fly status

# View logs
fly logs

# Check health endpoint
curl https://tc9-migration-tool.fly.dev/api/health
```

### 2. Configure Salesforce Connected App

Update your Salesforce Connected App with the callback URL:

```
https://tc9-migration-tool.fly.dev/api/auth/salesforce/callback
```

### 3. Database Access

To connect to the production database:

```bash
# Open a psql session
fly postgres connect -a tc9-migration-tool-db

# Or proxy the connection locally
fly proxy 5433:5432 -a tc9-migration-tool-db
# Then connect with: psql postgres://postgres:your_password@localhost:5433/tc9_migration_tool
```

## 🔐 Security Notes

- All secrets are encrypted at rest by Fly.io
- The `ENCRYPTION_KEY` and `JWT_SECRET` are automatically generated on first
  deploy
- Database credentials are managed by Fly.io
- HTTPS is enforced for all connections

## 🛠️ Troubleshooting

### Migration Issues

If migrations fail during deployment:

```bash
# SSH into the app
fly ssh console

# Run migrations manually
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

### Environment Variables

View current environment:

```bash
fly ssh console -C "printenv | grep -E '^(DATABASE_URL|SALESFORCE|NEXT_PUBLIC)'"
```

### Scaling

To scale the application:

```bash
# Scale to 2 instances
fly scale count 2

# Scale memory/CPU
fly scale vm shared-cpu-2x
```

## 📊 Monitoring

- **Logs**: `fly logs`
- **Metrics**: https://fly.io/apps/tc9-migration-tool/metrics
- **Status**: `fly status`

## 🔄 Updates

To update the application:

1. Make your code changes
2. Run `npm run build` locally to verify
3. Deploy: `fly deploy`

## 📞 Support

- Fly.io Status: https://status.fly.io/
- Fly.io Community: https://community.fly.io/
- App Dashboard: https://fly.io/apps/tc9-migration-tool
