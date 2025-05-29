#!/bin/bash

# Check 2cloudnine Organisation Access
# Quick verification script to ensure user has access to the required organisation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

check_fly_auth() {
    log_info "Checking Fly.io authentication..."
    
    if ! command -v fly &> /dev/null; then
        log_error "Fly CLI is not installed."
        echo "Install with: curl -L https://fly.io/install.sh | sh"
        exit 1
    fi

    if ! fly auth whoami &> /dev/null; then
        log_error "Not authenticated with Fly.io."
        echo "Run: fly auth login"
        exit 1
    fi

    local user=$(fly auth whoami)
    log_success "Authenticated as: $user"
}

check_org_access() {
    log_info "Checking access to 2cloudnine organisation..."
    
    if fly orgs list | grep -q "2cloudnine"; then
        log_success "You have access to the 2cloudnine organisation"
        
        # Show organisation details
        echo ""
        log_info "Organisation details:"
        fly orgs show 2cloudnine
        
        return 0
    else
        log_error "You don't have access to the 2cloudnine organisation"
        echo ""
        echo "Available organisations:"
        fly orgs list
        echo ""
        echo "To get access to 2cloudnine:"
        echo "1. Contact your organisation administrator"
        echo "2. Ask them to invite you to the 2cloudnine organisation"
        echo "3. Accept the invitation via email"
        echo ""
        return 1
    fi
}

check_existing_apps() {
    log_info "Checking for existing applications in 2cloudnine..."
    
    echo ""
    echo "Existing apps in 2cloudnine organisation:"
    fly apps list --org 2cloudnine || {
        log_warning "Could not list apps in 2cloudnine organisation"
        return 1
    }
}

main() {
    echo "🔍 2cloudnine Organisation Access Check"
    echo "======================================"
    echo ""
    
    check_fly_auth
    
    if check_org_access; then
        check_existing_apps
        echo ""
        log_success "All checks passed! You can proceed with the CI/CD setup."
        echo ""
        echo "Next step: ./scripts/deployment/setup-cicd.sh"
    else
        echo ""
        log_error "Organisation access check failed. Please resolve the issues above."
        exit 1
    fi
}

# Help function
show_help() {
    echo "2cloudnine Organisation Access Checker"
    echo ""
    echo "This script verifies:"
    echo "  - Fly CLI authentication"
    echo "  - Access to 2cloudnine organisation"
    echo "  - Existing applications in the organisation"
    echo ""
    echo "Usage:"
    echo "  $0              # Run checks"
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