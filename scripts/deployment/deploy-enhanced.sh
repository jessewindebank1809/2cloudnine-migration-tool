#!/bin/bash

# Enhanced deployment script for TC9 Migration Tool
# Supports both local and CI/CD deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="tc9-migration-tool"
STAGING_APP_NAME="tc9-migration-tool-staging"
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

    # Check if authenticated (skip in CI)
    if [ -z "$CI" ] && ! fly auth whoami &> /dev/null; then
        log_error "Not authenticated with Fly. Please run 'fly auth login' first."
        exit 1
    fi

    # Check if user has access to 2cloudnine organisation
    if [ -z "$CI" ] && ! fly orgs list | grep -q "2cloudnine"; then
        log_warning "You may not have access to the 2cloudnine organisation."
        log_info "Please ensure you're a member of the 2cloudnine organisation on Fly.io"
    fi

    log_success "Prerequisites check passed"
}

determine_app_name() {
    if [ "$ENVIRONMENT" == "staging" ]; then
        echo "$STAGING_APP_NAME"
    else
        echo "$APP_NAME"
    fi
}

build_application() {
    log_info "Building application..."
    
    if [ -z "$CI" ]; then
        # Local build
        npm run build
    else
        # CI build (already built in previous step)
        log_info "Using CI-built application"
    fi
    
    log_success "Application built successfully"
}

check_secrets() {
    local app_name=$1
    log_info "Checking required secrets for $app_name..."
    
    # Required secrets
    local required_secrets=(
        "DATABASE_URL"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "BETTER_AUTH_SECRET"
        "BETTER_AUTH_URL"
        "NEXT_PUBLIC_APP_URL"
        "NEXT_PUBLIC_BASE_URL"
        "SENTRY_DSN"
        "NEXT_PUBLIC_SENTRY_DSN"
    )
    
    # Add environment-specific Salesforce secrets
    if [ "$ENVIRONMENT" == "staging" ]; then
        required_secrets+=("SALESFORCE_PRODUCTION_CLIENT_ID")
        required_secrets+=("SALESFORCE_PRODUCTION_CLIENT_SECRET")
        required_secrets+=("SALESFORCE_SANDBOX_CLIENT_ID")
        required_secrets+=("SALESFORCE_SANDBOX_CLIENT_SECRET")
    else
        required_secrets+=("SALESFORCE_PRODUCTION_CLIENT_ID")
        required_secrets+=("SALESFORCE_PRODUCTION_CLIENT_SECRET")
        required_secrets+=("SALESFORCE_SANDBOX_CLIENT_ID")
        required_secrets+=("SALESFORCE_SANDBOX_CLIENT_SECRET")
    fi
    
    for secret in "${required_secrets[@]}"; do
        if ! fly secrets list --app "$app_name" | grep -q "$secret"; then
            log_error "Required secret $secret is not set for $app_name"
            echo "Set it with: fly secrets set $secret=your_value --app $app_name"
            exit 1
        fi
    done
    
    log_success "All required secrets are configured"
}

deploy_application() {
    local app_name=$1
    log_info "Deploying to $app_name..."
    
    # Create app-specific fly.toml if needed
    local config_file="fly.toml"
    if [ "$ENVIRONMENT" == "staging" ]; then
        config_file="fly.staging.toml"
        if [ ! -f "$config_file" ]; then
            cp fly.toml "$config_file"
            sed -i.bak "s/app = .*/app = \"$STAGING_APP_NAME\"/" "$config_file"
            rm "$config_file.bak" 2>/dev/null || true
        fi
    fi
    
    # Deploy with appropriate strategy
    local strategy="rolling"
    if [ "$ENVIRONMENT" == "staging" ]; then
        strategy="immediate"
    fi
    
    fly deploy --config "$config_file" --app "$app_name" --strategy="$strategy"
    
    log_success "Deployment completed"
}

run_migrations() {
    local app_name=$1
    log_info "Running database migrations for $app_name..."
    
    # Ensure the app is started (scale up if needed)
    log_info "Ensuring app is running..."
    fly scale count 1 --app "$app_name" || true
    
    # Wait for the app to be ready and try multiple times
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Attempt $attempt/$max_attempts: Checking if app is ready..."
        
        # Check if VMs are running
        if fly status --app "$app_name" | grep -q "started"; then
            log_info "App is running, attempting migration..."
            
            # Try to run migrations
            if fly ssh console --app "$app_name" -C "npx prisma migrate deploy"; then
                log_success "Database migrations completed"
                return 0
            else
                log_warning "Migration failed, retrying in 15 seconds..."
            fi
        else
            log_info "App not ready yet, waiting 30 seconds..."
            sleep 30
        fi
        
        attempt=$((attempt + 1))
        
        if [ $attempt -le $max_attempts ]; then
            sleep 15
        fi
    done
    
    log_error "Failed to run migrations after $max_attempts attempts"
    log_info "You may need to run migrations manually with:"
    log_info "fly ssh console --app $app_name -C 'npx prisma migrate deploy'"
    exit 1
}

ensure_app_running() {
    local app_name=$1
    log_info "Ensuring $app_name is running..."
    
    # Scale to at least 1 instance
    fly scale count 1 --app "$app_name" || true
    
    # Wait for the app to start
    local max_wait=120  # 2 minutes
    local elapsed=0
    local sleep_interval=10
    
    while [ $elapsed -lt $max_wait ]; do
        if fly status --app "$app_name" | grep -q "started"; then
            log_success "App is running"
            return 0
        fi
        
        log_info "Waiting for app to start... (${elapsed}s/${max_wait}s)"
        sleep $sleep_interval
        elapsed=$((elapsed + sleep_interval))
    done
    
    log_error "App failed to start within $max_wait seconds"
    return 1
}

health_check() {
    local app_name=$1
    log_info "Performing health check for $app_name..."
    
    # Ensure app is running first
    ensure_app_running "$app_name"
    
    local url
    if [ "$ENVIRONMENT" == "staging" ]; then
        url="https://tc9-migration-tool-staging.fly.dev"
    else
        url="https://tc9-migration-tool.fly.dev"
    fi
    
    # Wait a bit more for app to be fully ready
    sleep 15
    
    # Check health endpoint with retries
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        if curl -f --max-time 30 "$url/api/health" > /dev/null 2>&1; then
            log_success "Health check passed"
            log_success "Application is available at: $url"
            return 0
        else
            log_warning "Health check failed, retrying in 15 seconds..."
            sleep 15
            attempt=$((attempt + 1))
        fi
    done
    
    log_error "Health check failed after $max_attempts attempts"
    log_warning "Application may not be responding correctly, but deployment completed"
    log_info "Manual check URL: $url"
}

show_status() {
    local app_name=$1
    log_info "Application status:"
    fly status --app "$app_name"
}

cleanup() {
    # Clean up temporary files
    if [ "$ENVIRONMENT" == "staging" ] && [ -f "fly.staging.toml" ]; then
        rm -f "fly.staging.toml"
    fi
}

# Main deployment flow
main() {
    log_info "Starting deployment to $ENVIRONMENT environment"
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    local app_name
    app_name=$(determine_app_name)
    
    check_prerequisites
    build_application
    check_secrets "$app_name"
    deploy_application "$app_name"
    run_migrations "$app_name"
    health_check "$app_name"
    show_status "$app_name"
    
    log_success "Deployment to $ENVIRONMENT completed successfully!"
    
    if [ "$ENVIRONMENT" == "staging" ]; then
        log_info "Staging URL: https://tc9-migration-tool-staging.fly.dev"
    else
        log_info "Production URL: https://tc9-migration-tool.fly.dev"
    fi
}

# Help function
show_help() {
    echo "Usage: $0 [environment]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (production|staging) [default: production]"
    echo ""
    echo "Examples:"
    echo "  $0                 # Deploy to production"
    echo "  $0 production      # Deploy to production"
    echo "  $0 staging         # Deploy to staging"
    echo ""
    echo "Environment Variables:"
    echo "  CI                 # Set in CI/CD environment"
    echo "  FLY_API_TOKEN      # Fly.io API token (required in CI)"
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    production|staging|"")
        main
        ;;
    *)
        log_error "Invalid environment: $1"
        show_help
        exit 1
        ;;
esac 