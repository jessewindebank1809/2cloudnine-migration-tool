#!/bin/bash

# TC9 Migration Tool Deployment Script
# Usage: ./scripts/deploy.sh [staging|production] [branch]

set -e  # Exit on any error

# Show help first before any validation
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "TC9 Migration Tool Deployment Script"
    echo ""
    echo "Usage: $0 [staging|production] [branch]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (staging or production) [default: staging]"
    echo "  branch         Git branch to deploy [default: current branch]"
    echo ""
    echo "Environment Variables:"
    echo "  SKIP_TESTS=true     Skip local tests and checks"
    echo "  SKIP_GIT=true       Skip git operations (commit and push)"
    echo "  AUTO_COMMIT=true    Skip commit message confirmation for automated deployments"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy current branch to staging"
    echo "  $0 staging develop          # Deploy develop branch to staging"
    echo "  $0 production main          # Deploy main branch to production"
    echo "  SKIP_TESTS=true $0 staging  # Deploy to staging without running tests"
    exit 0
fi

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# Default values
ENVIRONMENT=${1:-staging}
BRANCH=${2:-$(git branch --show-current)}
SKIP_TESTS=${SKIP_TESTS:-false}
SKIP_GIT=${SKIP_GIT:-false}
AUTO_COMMIT=${AUTO_COMMIT:-false}

# Validation
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo -e "${RED}❌ Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

# Configuration based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
    FLY_APP="tc9-migration-tool-staging"
    EXPECTED_BRANCH="develop"
    FLY_CONFIG="fly.staging.toml"
else
    FLY_APP="tc9-migration-tool"
    EXPECTED_BRANCH="main"
    FLY_CONFIG="fly.toml"
fi

echo -e "${BLUE}🚀 Starting deployment to ${ENVIRONMENT}${NC}"
echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "  Environment: ${ENVIRONMENT}"
echo -e "  Current Branch: ${BRANCH}"
echo -e "  Expected Branch: ${EXPECTED_BRANCH}"
echo -e "  Fly App: ${FLY_APP}"
echo -e "  Skip Tests: ${SKIP_TESTS}"
echo -e "  Skip Git: ${SKIP_GIT}"
echo -e "  Auto Commit: ${AUTO_COMMIT}"
echo ""

# Function to run a command with status output
run_step() {
    local description="$1"
    local command="$2"
    
    echo -e "${YELLOW}🔄 ${description}...${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ ${description} completed${NC}"
    else
        echo -e "${RED}❌ ${description} failed${NC}"
        exit 1
    fi
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "next.config.js" ]; then
        echo -e "${RED}❌ Must be run from project root directory${NC}"
        exit 1
    fi
    
    # Check if required tools are installed
    command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is required${NC}"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required${NC}"; exit 1; }
    command -v git >/dev/null 2>&1 || { echo -e "${RED}❌ git is required${NC}"; exit 1; }
    command -v flyctl >/dev/null 2>&1 || { echo -e "${RED}❌ flyctl is required${NC}"; exit 1; }
    
    # Check if we're on the expected branch for production
    if [ "$ENVIRONMENT" = "production" ] && [ "$BRANCH" != "$EXPECTED_BRANCH" ]; then
        echo -e "${YELLOW}⚠️  Warning: Deploying to production from branch '${BRANCH}' instead of '${EXPECTED_BRANCH}'${NC}"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}❌ Deployment cancelled${NC}"
            exit 1
        fi
    fi
    
    # Check git status
    if [ "$SKIP_GIT" = "false" ]; then
        if [ -n "$(git status --porcelain)" ]; then
            echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
            git status --short
            read -p "Continue? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${RED}❌ Deployment cancelled${NC}"
                exit 1
            fi
        fi
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
    echo ""
}

# Function to run local tests and checks
run_local_checks() {
    if [ "$SKIP_TESTS" = "true" ]; then
        echo -e "${YELLOW}⚠️  Skipping tests (SKIP_TESTS=true)${NC}"
        return
    fi
    
    echo -e "${BLUE}🧪 Running local tests and checks...${NC}"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        run_step "Installing dependencies" "npm ci"
    fi
    
    # Generate Prisma client
    run_step "Generating Prisma client" "npx prisma generate"
    
    # Type checking
    run_step "Type checking" "npm run type-check"
    
    # Linting
    run_step "Linting" "npm run lint"
    
    # Build test
    run_step "Building application" "npm run build"
    
    echo -e "${GREEN}✅ All local checks passed${NC}"
    echo ""
}

# Function to generate intelligent commit message based on changed files
generate_commit_message() {
    local environment="$1"
    local changed_files=$(git status --porcelain | cut -c4-)
    local commit_parts=()
    
    # Analyze changed files and categorize them
    local has_scripts=false
    local has_api=false
    local has_components=false
    local has_config=false
    local has_deployment=false
    local has_database=false
    local has_docs=false
    local has_styles=false
    local has_types=false
    local has_lib=false
    
    while IFS= read -r file; do
        if [[ -z "$file" ]]; then continue; fi
        
        case "$file" in
            scripts/*)           has_scripts=true ;;
            src/app/api/*)       has_api=true ;;
            src/components/*)    has_components=true ;;
            src/lib/*)           has_lib=true ;;
            src/types/*)         has_types=true ;;
            *.config.js|*.config.ts|fly.toml|Dockerfile|package.json|package-lock.json) has_config=true ;;
            .github/workflows/*) has_deployment=true ;;
            prisma/*|*.sql)      has_database=true ;;
            *.md|docs/*)         has_docs=true ;;
            *.css|*.scss|src/app/globals.css) has_styles=true ;;
        esac
    done <<< "$changed_files"
    
    # Build commit message based on what changed
    if [[ "$has_scripts" == true ]]; then
        commit_parts+=("Update deployment scripts")
    fi
    
    if [[ "$has_api" == true ]]; then
        commit_parts+=("Update API routes")
    fi
    
    if [[ "$has_components" == true ]]; then
        commit_parts+=("Update UI components")
    fi
    
    if [[ "$has_lib" == true ]]; then
        commit_parts+=("Update core libraries")
    fi
    
    if [[ "$has_config" == true ]]; then
        commit_parts+=("Update configuration")
    fi
    
    if [[ "$has_deployment" == true ]]; then
        commit_parts+=("Update deployment workflows")
    fi
    
    if [[ "$has_database" == true ]]; then
        commit_parts+=("Update database schema")
    fi
    
    if [[ "$has_docs" == true ]]; then
        commit_parts+=("Update documentation")
    fi
    
    if [[ "$has_styles" == true ]]; then
        commit_parts+=("Update styling")
    fi
    
    if [[ "$has_types" == true ]]; then
        commit_parts+=("Update type definitions")
    fi
    
    # Generate final commit message
    if [[ ${#commit_parts[@]} -eq 0 ]]; then
        echo "Deploy to ${environment} - $(date '+%Y-%m-%d %H:%M:%S')"
    elif [[ ${#commit_parts[@]} -eq 1 ]]; then
        echo "${commit_parts[0]} - deploy to ${environment}"
    elif [[ ${#commit_parts[@]} -eq 2 ]]; then
        echo "${commit_parts[0]} and ${commit_parts[1],,} - deploy to ${environment}"
    else
        # More than 2 categories, summarise
        echo "Multiple updates ($(IFS=', '; echo "${commit_parts[*],,}")) - deploy to ${environment}"
    fi
}

# Function to handle git operations
handle_git() {
    if [ "$SKIP_GIT" = "true" ]; then
        echo -e "${YELLOW}⚠️  Skipping git operations (SKIP_GIT=true)${NC}"
        return
    fi
    
    echo -e "${BLUE}📝 Handling git operations...${NC}"
    
    # Add and commit if there are changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}🔄 Generating commit message based on changed files...${NC}"
        
        # Show what files changed
        echo -e "${BLUE}📋 Changed files:${NC}"
        git status --short | sed 's/^/  /'
        echo ""
        
        # Generate intelligent commit message
        commit_message=$(generate_commit_message "$ENVIRONMENT")
        echo -e "${GREEN}💡 Generated commit message: ${commit_message}${NC}"
        
        # Ask for confirmation or allow override
        if [ "$AUTO_COMMIT" = "true" ]; then
            echo -e "${YELLOW}⚠️  Auto commit enabled, using generated message${NC}"
        else
            read -p "Use this commit message? (Y/n/edit): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Ee]$ ]]; then
                read -p "Enter custom commit message: " custom_message
                if [ -n "$custom_message" ]; then
                    commit_message="$custom_message"
                fi
            elif [[ $REPLY =~ ^[Nn]$ ]]; then
                read -p "Enter commit message: " manual_message
                if [ -z "$manual_message" ]; then
                    commit_message="Deploy to ${ENVIRONMENT} - $(date '+%Y-%m-%d %H:%M:%S')"
                else
                    commit_message="$manual_message"
                fi
            fi
        fi
        
        echo -e "${YELLOW}🔄 Committing changes...${NC}"
        git add .
        git commit -m "$commit_message"
    fi
    
    # Push to remote
    run_step "Pushing to remote" "git push origin ${BRANCH}"
    
    echo -e "${GREEN}✅ Git operations completed${NC}"
    echo ""
}

# Function to create staging fly.toml if needed
create_staging_config() {
    if [ "$ENVIRONMENT" = "staging" ]; then
        echo -e "${YELLOW}🔄 Creating staging fly.toml...${NC}"
        cp fly.toml fly.staging.toml
        sed -i '' 's/app = "tc9-migration-tool"/app = "tc9-migration-tool-staging"/' fly.staging.toml
        echo -e "${GREEN}✅ Staging config created${NC}"
        echo ""
    fi
}

# Function to deploy to Fly
deploy_to_fly() {
    echo -e "${BLUE}🛫 Deploying to Fly.io...${NC}"
    
    # Check Fly authentication
    if ! flyctl auth whoami >/dev/null 2>&1; then
        echo -e "${RED}❌ Not authenticated with Fly.io${NC}"
        echo -e "${YELLOW}🔄 Please run: flyctl auth login${NC}"
        exit 1
    fi
    
    # Deploy based on environment
    if [ "$ENVIRONMENT" = "staging" ]; then
        run_step "Deploying to staging" "flyctl deploy --config ${FLY_CONFIG} --app ${FLY_APP} --strategy=immediate"
    else
        run_step "Deploying to production" "flyctl deploy --app ${FLY_APP} --strategy=rolling"
    fi
    
    # Wait for deployment and run health check
    echo -e "${YELLOW}🔄 Waiting for deployment to stabilise...${NC}"
    sleep 30
    
    # Health check
    HEALTH_URL="https://${FLY_APP}.fly.dev/api/health"
    echo -e "${YELLOW}🔄 Running health check at ${HEALTH_URL}...${NC}"
    
    for i in {1..5}; do
        if curl -f --max-time 30 --silent "$HEALTH_URL" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Health check passed${NC}"
            break
        else
            echo -e "${YELLOW}⏳ Health check attempt $i/5 failed, retrying in 15s...${NC}"
            if [ $i -eq 5 ]; then
                echo -e "${RED}❌ Health check failed after 5 attempts${NC}"
                echo -e "${YELLOW}⚠️  App may still be starting up. Check manually: ${HEALTH_URL}${NC}"
            else
                sleep 15
            fi
        fi
    done
    
    echo -e "${GREEN}✅ Deployment to Fly.io completed${NC}"
    echo ""
}

# Function to run database migrations
run_migrations() {
    echo -e "${BLUE}🗄️ Running database migrations...${NC}"
    
    # Check if app is running
    echo -e "${YELLOW}🔄 Ensuring app is running...${NC}"
    flyctl machine list --app "$FLY_APP" --json | jq -r '.[] | select(.state=="stopped") | .id' | xargs -I {} flyctl machine start {} --app "$FLY_APP" || true
    
    sleep 10
    
    # Run migrations
    run_step "Running Prisma migrations" "flyctl ssh console --app ${FLY_APP} -C 'npx prisma migrate deploy'"
    
    echo -e "${GREEN}✅ Database migrations completed${NC}"
    echo ""
}

# Function to cleanup
cleanup() {
    if [ "$ENVIRONMENT" = "staging" ] && [ -f "fly.staging.toml" ]; then
        echo -e "${YELLOW}🔄 Cleaning up...${NC}"
        rm -f fly.staging.toml
        echo -e "${GREEN}✅ Cleanup completed${NC}"
    fi
}

# Function to show deployment summary
show_summary() {
    echo -e "${GREEN}🎉 Deployment Summary${NC}"
    echo -e "${GREEN}=====================${NC}"
    echo -e "Environment: ${ENVIRONMENT}"
    echo -e "Branch: ${BRANCH}"
    echo -e "Fly App: ${FLY_APP}"
    echo -e "URL: https://${FLY_APP}.fly.dev"
    echo -e "Health Check: https://${FLY_APP}.fly.dev/api/health"
    echo ""
    echo -e "${GREEN}✅ Deployment to ${ENVIRONMENT} completed successfully!${NC}"
}

# Main execution
main() {
    # Set trap to cleanup on exit
    trap cleanup EXIT
    
    check_prerequisites
    run_local_checks
    handle_git
    create_staging_config
    deploy_to_fly
    run_migrations
    show_summary
}

# Run main function
main "$@" 