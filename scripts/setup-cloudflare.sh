#!/bin/bash
# Setup Cloudflare D1 Database and Workers for LocalFirst Arizona

set -e  # Exit on any error

echo "🚀 Setting up Cloudflare infrastructure for LocalFirst Arizona..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler@latest
fi

# Check if user is authenticated
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare. Please run 'wrangler login' first."
    exit 1
fi

echo "✅ Authenticated with Cloudflare"

# Navigate to API directory
cd packages/api

echo "📦 Creating D1 databases..."

# Create production database
echo "Creating production D1 database..."
PROD_DB_OUTPUT=$(wrangler d1 create localfirst-prod --json 2>/dev/null || echo "Database may already exist")
if [[ $PROD_DB_OUTPUT == *"database_id"* ]]; then
    PROD_DB_ID=$(echo $PROD_DB_OUTPUT | jq -r '.database_id')
    echo "✅ Production database created with ID: $PROD_DB_ID"
    
    # Update wrangler.toml with actual database ID
    sed -i.bak "s/PLACEHOLDER_DATABASE_ID/$PROD_DB_ID/g" wrangler.toml
else
    echo "ℹ️ Production database already exists or failed to create"
fi

# Create development database
echo "Creating development D1 database..."
DEV_DB_OUTPUT=$(wrangler d1 create localfirst-dev --json 2>/dev/null || echo "Database may already exist")
if [[ $DEV_DB_OUTPUT == *"database_id"* ]]; then
    DEV_DB_ID=$(echo $DEV_DB_OUTPUT | jq -r '.database_id')
    echo "✅ Development database created with ID: $DEV_DB_ID"
    
    # Update wrangler.toml with actual database ID
    sed -i.bak "s/PLACEHOLDER_DEV_DATABASE_ID/$DEV_DB_ID/g" wrangler.toml
else
    echo "ℹ️ Development database already exists or failed to create"
fi

echo "🔄 Running database migrations..."

# Run migrations for production
echo "Migrating production database..."
wrangler d1 migrations apply localfirst-prod --env production || echo "Migration may have already been applied"

# Run migrations for development
echo "Migrating development database..."
wrangler d1 migrations apply localfirst-dev --env development || echo "Migration may have already been applied"

echo "🔑 Setting up secrets..."

# Check if JWT_SECRET exists, if not prompt to set it
if ! wrangler secret list --env production | grep -q "JWT_SECRET"; then
    echo "Setting JWT_SECRET for production..."
    echo "Please enter a secure JWT secret (press Enter to generate one):"
    read -r JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        echo "Generated JWT secret: $JWT_SECRET"
    fi
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env production
fi

echo "✅ Cloudflare setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy API: npm run deploy"
echo "2. Deploy mobile app: cd ../mobile && npm run build:production"
echo "3. Set up Cloudflare Pages project for mobile app"
echo ""
echo "📝 Don't forget to update your mobile app's .env.production with the actual Worker URL!"