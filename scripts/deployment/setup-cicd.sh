#!/bin/bash

# CI/CD Setup Script for TC9 Migration Tool
# This script helps set up the Fly.io applications and basic configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_APP="tc9-migration-tool"
STAGING_APP="tc9-migration-tool-staging"
REGION="sjc"
FLY_ORG="2cloudnine"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if fly is installed
    if ! command -v fly &> /dev/null; then
        log_error "Fly CLI is not installed. Please install it first."
        echo "Install with: curl -L https://fly.io/install.sh | sh"
        exit 1
    fi

    # Check if authenticated
    if ! fly auth whoami &> /dev/null; then
        log_error "Not authenticated with Fly. Please run 'fly auth login' first."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

create_apps() {
    log_info "Creating Fly.io applications in 2cloudnine organisation..."
    
    # Create production app
    if fly apps list | grep -q "$PROD_APP"; then
        log_warning "Production app $PROD_APP already exists"
    else
        log_info "Creating production app: $PROD_APP"
        fly apps create "$PROD_APP" --org "$FLY_ORG"
        log_success "Created production app: $PROD_APP"
    fi
    
    # Create staging app
    if fly apps list | grep -q "$STAGING_APP"; then
        log_warning "Staging app $STAGING_APP already exists"
    else
        log_info "Creating staging app: $STAGING_APP"
        fly apps create "$STAGING_APP" --org "$FLY_ORG"
        log_success "Created staging app: $STAGING_APP"
    fi
}

setup_databases() {
    log_info "Setting up databases in 2cloudnine organisation..."
    
    # Production database
    local prod_db="${PROD_APP}-db"
    if fly apps list | grep -q "$prod_db"; then
        log_warning "Production database $prod_db already exists"
    else
        log_info "Creating production database: $prod_db"
        fly postgres create --name "$prod_db" --region "$REGION" --org "$FLY_ORG" --initial-cluster-size 1
        fly postgres attach --app "$PROD_APP" "$prod_db"
        log_success "Created and attached production database"
    fi
    
    # Staging database
    local staging_db="${STAGING_APP}-db"
    if fly apps list | grep -q "$staging_db"; then
        log_warning "Staging database $staging_db already exists"
    else
        log_info "Creating staging database: $staging_db"
        fly postgres create --name "$staging_db" --region "$REGION" --org "$FLY_ORG" --initial-cluster-size 1
        fly postgres attach --app "$STAGING_APP" "$staging_db"
        log_success "Created and attached staging database"
    fi
}

generate_secrets() {
    log_info "Generating security secrets..."
    
    # Generate JWT secrets
    local prod_jwt_secret=$(openssl rand -hex 32)
    local staging_jwt_secret=$(openssl rand -hex 32)
    
    # Generate encryption keys
    local prod_encryption_key=$(openssl rand -hex 32)
    local staging_encryption_key=$(openssl rand -hex 32)
    
    # Set production secrets
    log_info "Setting production secrets..."
    fly secrets set JWT_SECRET="$prod_jwt_secret" --app "$PROD_APP"
    fly secrets set ENCRYPTION_KEY="$prod_encryption_key" --app "$PROD_APP"
    fly secrets set NEXT_PUBLIC_BASE_URL="https://${PROD_APP}.fly.dev" --app "$PROD_APP"
    fly secrets set NEXT_PUBLIC_APP_URL="https://${PROD_APP}.fly.dev" --app "$PROD_APP"
    
    # Set staging secrets
    log_info "Setting staging secrets..."
    fly secrets set JWT_SECRET="$staging_jwt_secret" --app "$STAGING_APP"
    fly secrets set ENCRYPTION_KEY="$staging_encryption_key" --app "$STAGING_APP"
    fly secrets set NEXT_PUBLIC_BASE_URL="https://${STAGING_APP}.fly.dev" --app "$STAGING_APP"
    fly secrets set NEXT_PUBLIC_APP_URL="https://${STAGING_APP}.fly.dev" --app "$STAGING_APP"
    
    log_success "Security secrets configured"
}

prompt_salesforce_config() {
    log_info "Salesforce configuration required..."
    log_warning "You need to manually set the following secrets:"
    
    echo ""
    echo "Production Salesforce secrets:"
    echo "fly secrets set SALESFORCE_CLIENT_ID=\"your_prod_client_id\" --app $PROD_APP"
    echo "fly secrets set SALESFORCE_CLIENT_SECRET=\"your_prod_client_secret\" --app $PROD_APP"
    echo "fly secrets set SALESFORCE_CALLBACK_URL=\"https://${PROD_APP}.fly.dev/api/auth/callback/salesforce\" --app $PROD_APP"
    
    echo ""
    echo "Staging Salesforce secrets:"
    echo "fly secrets set SALESFORCE_CLIENT_ID=\"your_staging_client_id\" --app $STAGING_APP"
    echo "fly secrets set SALESFORCE_CLIENT_SECRET=\"your_staging_client_secret\" --app $STAGING_APP"
    echo "fly secrets set SALESFORCE_CALLBACK_URL=\"https://${STAGING_APP}.fly.dev/api/auth/callback/salesforce\" --app $STAGING_APP"
    
    echo ""
    log_info "Optional Sentry configuration:"
    echo "fly secrets set NEXT_PUBLIC_SENTRY_DSN=\"your_sentry_dsn\" --app $PROD_APP"
    echo "fly secrets set SENTRY_DSN=\"your_sentry_dsn\" --app $PROD_APP"
    echo "fly secrets set NEXT_PUBLIC_SENTRY_DSN=\"your_staging_sentry_dsn\" --app $STAGING_APP"
    echo "fly secrets set SENTRY_DSN=\"your_staging_sentry_dsn\" --app $STAGING_APP"
}

show_github_setup() {
    log_info "GitHub Actions setup required..."
    
    echo ""
    echo "1. Get your Fly.io API token:"
    echo "   fly auth token"
    echo ""
    echo "2. Add the token as a GitHub secret:"
    echo "   - Go to your GitHub repository"
    echo "   - Settings → Secrets and variables → Actions"
    echo "   - Add new secret: FLY_API_TOKEN"
    echo ""
    echo "3. Ensure you have the following branches:"
    echo "   - main (production)"
    echo "   - develop (staging)"
    echo ""
    echo "4. The CI/CD workflows are already configured in .github/workflows/"
}

show_next_steps() {
    log_success "CI/CD setup completed!"
    
    echo ""
    log_info "Next steps:"
    echo "1. Configure Salesforce secrets (see commands above)"
    echo "2. Set up GitHub Actions (see instructions above)"
    echo "3. Test the deployment:"
    echo "   ./scripts/deployment/deploy-enhanced.sh staging"
    echo "4. Review the setup guide: docs/CI-CD-SETUP.md"
    
    echo ""
    log_info "Application URLs:"
    echo "Production:  https://${PROD_APP}.fly.dev"
    echo "Staging:     https://${STAGING_APP}.fly.dev"
    
    echo ""
    log_info "Health check URLs:"
    echo "Production:  https://${PROD_APP}.fly.dev/api/health"
    echo "Staging:     https://${STAGING_APP}.fly.dev/api/health"
}

# Main setup flow
main() {
    echo "🚀 TC9 Migration Tool CI/CD Setup"
    echo "=================================="
    echo ""
    
    check_prerequisites
    create_apps
    setup_databases
    generate_secrets
    
    echo ""
    echo "📋 Manual Configuration Required"
    echo "================================"
    prompt_salesforce_config
    
    echo ""
    echo "🔧 GitHub Actions Setup"
    echo "======================="
    show_github_setup
    
    echo ""
    show_next_steps
}

# Help function
show_help() {
    echo "TC9 Migration Tool CI/CD Setup Script"
    echo ""
    echo "This script sets up:"
    echo "  - Fly.io applications (production and staging) in 2cloudnine organisation"
    echo "  - PostgreSQL databases in 2cloudnine organisation"
    echo "  - Basic security secrets"
    echo ""
    echo "Prerequisites:"
    echo "  - Fly CLI installed and authenticated"
    echo "  - Access to 2cloudnine organisation on Fly.io"
    echo "  - OpenSSL for generating secrets"
    echo ""
    echo "Usage:"
    echo "  $0              # Run setup"
    echo "  $0 --help      # Show this help"
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Invalid argument: $1"
        show_help
        exit 1
        ;;
esac 