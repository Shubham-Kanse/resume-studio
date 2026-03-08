#!/bin/bash

# AI Resume Generator - Setup Verification Script
# Run this after setup to verify everything is configured correctly

echo "🔍 Verifying AI Resume Generator Setup..."
echo ""

# Check Node.js version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Node.js installed: $NODE_VERSION"
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo "   ✅ Version is 18 or higher"
    else
        echo "   ⚠️  Warning: Node.js 18+ recommended, you have $NODE_VERSION"
    fi
else
    echo "   ❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo ""

# Check pnpm
echo "2️⃣  Checking pnpm..."
PNPM_VERSION=$(pnpm --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ pnpm installed: $PNPM_VERSION"
else
    echo "   ⚠️  pnpm not found. Install with: npm install -g pnpm"
fi
echo ""

# Check if node_modules exists
echo "3️⃣  Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules directory exists"
else
    echo "   ⚠️  Dependencies not installed. Run: pnpm install"
fi
echo ""

# Check .env.local
echo "4️⃣  Checking environment configuration..."
if [ -f ".env.local" ]; then
    echo "   ✅ .env.local file exists"
    
    # Check for API key
    if grep -q "OPENROUTER_API_KEY=" .env.local; then
        API_KEY=$(grep "OPENROUTER_API_KEY=" .env.local | cut -d'=' -f2)
        if [ "$API_KEY" = "your_openrouter_api_key_here" ] || [ -z "$API_KEY" ]; then
            echo "   ⚠️  OPENROUTER_API_KEY not set. Add your key from https://openrouter.ai/keys"
        else
            echo "   ✅ OPENROUTER_API_KEY is configured"
        fi
    else
        echo "   ⚠️  OPENROUTER_API_KEY not found in .env.local"
    fi
else
    echo "   ⚠️  .env.local not found. Copy .env.example and add your API key"
fi
echo ""

# Check key files
echo "5️⃣  Checking project files..."
FILES=(
    "app/page.tsx"
    "app/api/generate-resume/route.ts"
    "app/api/latex-to-pdf/route.ts"
    "lib/llm-context.ts"
    "components/resume-input-panel.tsx"
    "components/resume-preview-panel.tsx"
    "package.json"
)

ALL_FILES_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file missing"
        ALL_FILES_EXIST=false
    fi
done
echo ""

# Check for old files that should be deleted
echo "6️⃣  Checking for old files..."
if [ -f "components/resume-preview-panel-old.tsx" ]; then
    echo "   ⚠️  Old file found: components/resume-preview-panel-old.tsx (should be deleted)"
else
    echo "   ✅ No old files found"
fi
echo ""

# Check package.json for removed dependencies
echo "7️⃣  Checking dependencies..."
if grep -q "@heyputer/puter.js" package.json; then
    echo "   ⚠️  Old dependency found: @heyputer/puter.js (should be removed)"
else
    echo "   ✅ @heyputer/puter.js removed"
fi

if grep -q "vue-router" package.json; then
    echo "   ⚠️  Wrong dependency found: vue-router (should be removed)"
else
    echo "   ✅ vue-router removed"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".env.local" ] && [ -d "node_modules" ] && [ "$ALL_FILES_EXIST" = true ]; then
    echo "✅ Setup looks good!"
    echo ""
    echo "Next steps:"
    echo "  1. Make sure OPENROUTER_API_KEY is set in .env.local"
    echo "  2. Run: pnpm dev"
    echo "  3. Open: http://localhost:3000"
    echo "  4. Paste a job description and upload a resume to test"
else
    echo "⚠️  Some issues found. Please fix them before running the app."
    echo ""
    echo "Quick fixes:"
    if [ ! -f ".env.local" ]; then
        echo "  • Create .env.local: cp .env.example .env.local"
    fi
    if [ ! -d "node_modules" ]; then
        echo "  • Install dependencies: pnpm install"
    fi
fi

echo ""
echo "📚 Documentation:"
echo "  • SETUP.md - Setup guide"
echo "  • README.md - Project overview"
echo "  • CHANGELOG.md - Notable updates"
echo ""
