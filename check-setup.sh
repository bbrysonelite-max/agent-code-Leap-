#!/bin/bash

# ==============================================================================
# AI Prospecting Agent - Setup Validation Script
# ==============================================================================
# This script checks if your environment is properly configured before starting
# Run this before trying to start the application
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
PASSED=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     AI Prospecting Agent - Setup Validation                   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

section_header() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "─────────────────────────────────────────────────────────────────"
}

# ==============================================================================
# CHECK 1: SYSTEM PREREQUISITES
# ==============================================================================

section_header "System Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed ($NODE_VERSION)"
else
    check_fail "Node.js NOT installed (required for backend)"
fi

# Check Encore CLI
if command -v encore &> /dev/null; then
    ENCORE_VERSION=$(encore version 2>&1 | head -n 1)
    check_pass "Encore CLI installed ($ENCORE_VERSION)"
else
    check_fail "Encore CLI NOT installed (CRITICAL - backend won't run)"
    echo -e "   ${YELLOW}Install:${NC}"
    echo "   macOS: brew install encoredev/tap/encore"
    echo "   Linux: curl -L https://encore.dev/install.sh | bash"
fi

# Check Bun
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    check_pass "Bun installed (v$BUN_VERSION)"
else
    check_warn "Bun NOT installed (recommended for faster builds)"
    echo -e "   ${YELLOW}Install:${NC} npm install -g bun"
fi

# Check Docker (optional but recommended)
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    check_pass "Docker installed ($DOCKER_VERSION)"
else
    check_warn "Docker NOT installed (optional, but needed for production)"
fi

# ==============================================================================
# CHECK 2: PROJECT STRUCTURE
# ==============================================================================

section_header "Project Structure"

# Check backend directory
if [ -d "backend" ]; then
    check_pass "Backend directory exists"
else
    check_fail "Backend directory NOT found"
fi

# Check frontend directory
if [ -d "frontend" ]; then
    check_pass "Frontend directory exists"
else
    check_fail "Frontend directory NOT found"
fi

# Check encore.app file
if [ -f "backend/encore.app" ]; then
    check_pass "Encore app configuration found"
else
    check_fail "backend/encore.app NOT found (backend won't start)"
fi

# Check package.json files
if [ -f "backend/package.json" ]; then
    check_pass "Backend package.json found"
else
    check_fail "backend/package.json NOT found"
fi

if [ -f "frontend/package.json" ]; then
    check_pass "Frontend package.json found"
else
    check_fail "frontend/package.json NOT found"
fi

# ==============================================================================
# CHECK 3: ENVIRONMENT CONFIGURATION
# ==============================================================================

section_header "Environment Configuration"

# Check if .env exists
if [ -f ".env" ]; then
    check_pass ".env file exists"

    # Load .env for checking
    set -a
    source .env 2>/dev/null || true
    set +a

    # Check OpenAI Key (CRITICAL)
    if [ ! -z "$OpenAIKey" ] && [ "$OpenAIKey" != "your_openai_api_key_starting_with_sk" ]; then
        if [[ $OpenAIKey == sk-* ]]; then
            check_pass "OpenAI API key configured (starts with sk-)"
        else
            check_warn "OpenAI API key set but doesn't start with 'sk-' (may be invalid)"
        fi
    else
        check_fail "OpenAI API key NOT configured (CRITICAL - AI features won't work)"
        echo -e "   ${YELLOW}Get key from:${NC} https://platform.openai.com/api-keys"
    fi

    # Check SMTP Configuration
    if [ ! -z "$SMTP_USER" ] && [ "$SMTP_USER" != "your_email@gmail.com" ]; then
        check_pass "SMTP email configured ($SMTP_USER)"
    else
        check_fail "SMTP email NOT configured (emails won't send)"
    fi

    if [ ! -z "$SMTP_PASS" ] && [ "$SMTP_PASS" != "your_gmail_app_password" ]; then
        check_pass "SMTP password configured"
    else
        check_fail "SMTP password NOT configured (emails won't send)"
    fi

    # Check Database URL
    if [ ! -z "$DATABASE_URL" ]; then
        check_pass "Database URL configured"
    else
        check_warn "Database URL not set (Encore will auto-configure)"
    fi

    # Check Clerk Keys (Optional but recommended)
    if [ ! -z "$CLERK_PUBLISHABLE_KEY" ] && [ "$CLERK_PUBLISHABLE_KEY" != "pk_test_your_clerk_publishable_key" ]; then
        check_pass "Clerk authentication configured"
    else
        check_warn "Clerk keys not configured (using test key from App.tsx)"
        echo -e "   ${YELLOW}Note:${NC} Test key works for development, but use your own for production"
    fi

    # Check Optional: HubSpot
    if [ ! -z "$HUBSPOT_API_KEY" ] && [ "$HUBSPOT_API_KEY" != "your_hubspot_private_app_token" ]; then
        check_pass "HubSpot API key configured"
    else
        check_warn "HubSpot API key not configured (HubSpot integration disabled)"
    fi

    # Check Optional: Stripe
    if [ ! -z "$STRIPE_SECRET_KEY" ] && [ "$STRIPE_SECRET_KEY" != "sk_test_your_stripe_secret_key" ]; then
        check_pass "Stripe API key configured"
    else
        check_warn "Stripe API key not configured (payment features disabled)"
    fi

else
    check_fail ".env file NOT found (CRITICAL)"
    echo -e "   ${YELLOW}Run:${NC} cp .env.example .env"
    echo -e "   ${YELLOW}Then edit .env with your API keys${NC}"
fi

# ==============================================================================
# CHECK 4: DEPENDENCIES
# ==============================================================================

section_header "Dependencies"

# Check backend node_modules
if [ -d "backend/node_modules" ]; then
    check_pass "Backend dependencies installed"
else
    check_warn "Backend dependencies NOT installed"
    echo -e "   ${YELLOW}Run:${NC} cd backend && bun install"
fi

# Check frontend node_modules
if [ -d "frontend/node_modules" ]; then
    check_pass "Frontend dependencies installed"
else
    check_warn "Frontend dependencies NOT installed"
    echo -e "   ${YELLOW}Run:${NC} cd frontend && bun install"
fi

# ==============================================================================
# CHECK 5: PORT AVAILABILITY
# ==============================================================================

section_header "Port Availability"

# Check if port 4000 is available (backend)
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    check_warn "Port 4000 (backend) already in use"
    echo -e "   ${YELLOW}To free:${NC} lsof -ti:4000 | xargs kill -9"
else
    check_pass "Port 4000 (backend) available"
fi

# Check if port 5173 is available (frontend)
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    check_warn "Port 5173 (frontend) already in use"
    echo -e "   ${YELLOW}To free:${NC} lsof -ti:5173 | xargs kill -9"
else
    check_pass "Port 5173 (frontend) available"
fi

# ==============================================================================
# CHECK 6: BACKEND SERVICES
# ==============================================================================

section_header "Backend Services"

# Count backend services
if [ -d "backend" ]; then
    SERVICE_COUNT=$(find backend -name "encore.service.ts" 2>/dev/null | wc -l | tr -d ' ')
    if [ $SERVICE_COUNT -gt 0 ]; then
        check_pass "$SERVICE_COUNT microservices found"
    else
        check_fail "No microservices found (backend won't work)"
    fi
fi

# Check critical services exist
CRITICAL_SERVICES=("agent" "prospect" "scoring" "email" "ai" "nurturing")
for service in "${CRITICAL_SERVICES[@]}"; do
    if [ -d "backend/$service" ]; then
        check_pass "Service '$service' exists"
    else
        check_fail "Critical service '$service' NOT found"
    fi
done

# ==============================================================================
# CHECK 7: FRONTEND COMPONENTS
# ==============================================================================

section_header "Frontend Components"

# Check critical components
CRITICAL_COMPONENTS=("Dashboard.tsx" "AgentControls.tsx" "ProspectManagement.tsx" "EmailCampaigns.tsx")
COMPONENT_FOUND=0

for component in "${CRITICAL_COMPONENTS[@]}"; do
    if [ -f "frontend/components/$component" ]; then
        ((COMPONENT_FOUND++))
    fi
done

if [ $COMPONENT_FOUND -eq ${#CRITICAL_COMPONENTS[@]} ]; then
    check_pass "All critical UI components present"
else
    check_warn "Some UI components missing ($COMPONENT_FOUND/${#CRITICAL_COMPONENTS[@]} found)"
fi

# Check for .bak files (backed up components)
BAK_COUNT=$(find frontend/components -name "*.bak" 2>/dev/null | wc -l | tr -d ' ')
if [ $BAK_COUNT -gt 0 ]; then
    check_warn "$BAK_COUNT component backup files found (can be restored later)"
else
    check_pass "No backup files (all components active)"
fi

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  VALIDATION SUMMARY                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}Passed:${NC}   $PASSED checks"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS issues"
echo -e "${RED}Errors:${NC}   $ERRORS critical problems"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ Perfect! Your environment is fully configured.${NC}"
        echo ""
        echo -e "${BLUE}Ready to start:${NC}"
        echo "  1. Backend:  cd backend && encore run"
        echo "  2. Frontend: cd frontend && bun run dev"
        echo "  3. Open:     http://localhost:5173"
    else
        echo -e "${YELLOW}⚠ Good to go, but with some warnings.${NC}"
        echo "  The app will run, but some features may be limited."
        echo "  Review warnings above and configure as needed."
        echo ""
        echo -e "${BLUE}Start anyway:${NC}"
        echo "  1. Backend:  cd backend && encore run"
        echo "  2. Frontend: cd frontend && bun run dev"
    fi
else
    echo -e "${RED}✗ Critical issues found! Fix errors before starting.${NC}"
    echo "  Review the errors above and follow the suggested fixes."
    echo ""
    echo -e "${BLUE}Common fixes:${NC}"
    echo "  1. Install Encore CLI (most critical)"
    echo "  2. Create .env from .env.example"
    echo "  3. Add OpenAI API key to .env"
    echo "  4. Configure SMTP credentials in .env"
    echo "  5. Run: cd backend && bun install"
    echo "  6. Run: cd frontend && bun install"
fi

echo ""
echo -e "${BLUE}Need help? Check:${NC}"
echo "  • QUICKSTART.md (step-by-step setup guide)"
echo "  • .env.example (configuration template)"
echo "  • README.md (general documentation)"
echo ""

# Exit with error code if there are critical errors
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi
