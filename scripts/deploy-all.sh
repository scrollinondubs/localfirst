#!/bin/bash
# Complete deployment script for LocalFirst Arizona to Cloudflare

set -e  # Exit on any error

echo "🚀 Deploying LocalFirst Arizona to Cloudflare..."
echo "This script will deploy both the API and mobile app"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler@latest"
    exit 1
fi

# Check if user is authenticated
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare. Please run 'wrangler login' first."
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Deploy API
echo "📡 Deploying API to Cloudflare Workers..."
cd packages/api

# Check if database IDs are set up
if grep -q "PLACEHOLDER_DATABASE_ID" wrangler.toml; then
    echo "❌ Database not set up. Running setup script first..."
    cd ../..
    ./scripts/setup-cloudflare.sh
    cd packages/api
fi

echo "Deploying to production..."
wrangler deploy --env production

# Get the Worker URL
WORKER_URL=$(wrangler list | grep localfirst-api | awk '{print $2}' || echo "localfirst-api.PLACEHOLDER-ACCOUNT.workers.dev")

echo "✅ API deployed to: https://$WORKER_URL"
echo ""

# Update mobile app configuration with real Worker URL
echo "🔄 Updating mobile app configuration..."
cd ../mobile

# Update .env.production with actual Worker URL
sed -i.bak "s|localfirst-api.PLACEHOLDER-ACCOUNT.workers.dev|$WORKER_URL|g" .env.production
sed -i.bak "s|localfirst-api.PLACEHOLDER-ACCOUNT.workers.dev|$WORKER_URL|g" .cloudflare/pages.toml
sed -i.bak "s|localfirst-api.PLACEHOLDER-ACCOUNT.workers.dev|$WORKER_URL|g" config/api.js
sed -i.bak "s|localfirst-api.PLACEHOLDER-ACCOUNT.workers.dev|$WORKER_URL|g" components/AuthContext.js

echo "✅ Mobile app configuration updated"
echo ""

# Build mobile app
echo "📱 Building mobile app..."
npm run build:production

echo "✅ Mobile app built successfully"
echo ""

# Deploy to Cloudflare Pages
echo "🌐 Deploying mobile app to Cloudflare Pages..."

# Check if pages project exists, if not create it
PAGES_PROJECT="localfirst-mobile"
if ! wrangler pages project list | grep -q "$PAGES_PROJECT"; then
    echo "Creating Cloudflare Pages project..."
    wrangler pages project create "$PAGES_PROJECT" --production-branch main
fi

# Deploy to pages
wrangler pages deploy web-build --project-name="$PAGES_PROJECT" --branch=main

# Get the Pages URL
PAGES_URL=$(wrangler pages project list | grep "$PAGES_PROJECT" | awk '{print $3}' || echo "$PAGES_PROJECT.pages.dev")

echo "✅ Mobile app deployed to: https://$PAGES_URL"
echo ""

# Final summary
echo "🎉 Deployment complete!"
echo ""
echo "📋 Summary:"
echo "  • API: https://$WORKER_URL"
echo "  • Mobile App: https://$PAGES_URL"
echo ""
echo "🧪 Test your deployment:"
echo "  1. Visit the mobile app URL"
echo "  2. Try creating an account"
echo "  3. Test business search functionality"
echo ""
echo "🔧 Next steps:"
echo "  1. Set up custom domain (optional)"
echo "  2. Configure Chrome extension to use production API"
echo "  3. Set up monitoring and analytics"

cd ../..