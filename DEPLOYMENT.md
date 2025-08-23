# 🚀 Cloudflare Deployment Guide

This guide covers deploying the LocalFirst Arizona application stack to Cloudflare.

## 📋 Prerequisites

1. **Cloudflare Account**: Create account at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler@latest
   ```
3. **Authentication**: Set up Cloudflare credentials
   ```bash
   # Option 1: Interactive login (browser-based)
   wrangler login
   
   # Option 2: API Token (recommended for CI/non-interactive)
   # Create API token at: https://dash.cloudflare.com/profile/api-tokens
   # Store in .env.local:
   # CLOUDFLARE_API_TOKEN="your_api_token"
   # CLOUDFLARE_ACCOUNT_ID="your_account_id"
   
   # Load credentials from .env.local
   source .env.local && export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
   ```

## 🏗️ Architecture Overview

- **API**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite at the edge)  
- **Mobile App**: Cloudflare Pages (React Native Web)
- **Chrome Extension**: Connects to Workers API

## ⚡ Quick Deployment

### Option 1: Automated Deployment (Recommended)
```bash
# Run complete deployment
./scripts/deploy-all.sh
```

### Option 2: Manual Step-by-step

1. **Setup Cloudflare Infrastructure**
   ```bash
   ./scripts/setup-cloudflare.sh
   ```

2. **Deploy API**
   ```bash
   cd packages/api
   npm run deploy
   ```

3. **Deploy Mobile App**
   ```bash
   cd packages/mobile
   npm run build:production
   wrangler pages deploy web-build --project-name=localfirst-mobile
   ```

## 🔧 Configuration

### Environment Variables

**API (.env or Cloudflare secrets)**:
- `JWT_SECRET`: Secure random string for JWT tokens
- `NODE_ENV`: Set to "production"

**Mobile App (.env.production)**:
- `REACT_APP_API_URL`: Your Workers API URL
- `REACT_APP_API_BASE_URL`: Your Workers API URL + "/api"
- `NODE_ENV`: Set to "production"

### Database Setup

The deployment creates two D1 databases:
- `localfirst-prod`: Production database
- `localfirst-dev`: Development database

Migrations are automatically applied during setup.

## 📱 Mobile App Deployment

### Build Configuration
- Build command: `npm run build:production`
- Output directory: `web-build`
- Node version: 18

### Environment Variables (Pages Dashboard)
Set these in your Cloudflare Pages project settings:
```
REACT_APP_API_URL=https://your-worker.workers.dev
REACT_APP_API_BASE_URL=https://your-worker.workers.dev/api
NODE_ENV=production
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure mobile app domain is added to CORS origins in API
   - Check that API is deployed before mobile app

2. **Environment Variables Not Loading**
   - Verify `.env.production` exists and has correct values
   - Check Cloudflare Pages environment variables

3. **Database Connection Errors**
   - Run `./scripts/setup-cloudflare.sh` to ensure D1 setup
   - Check database IDs in `wrangler.toml`

4. **Authentication Not Working**
   - Verify JWT_SECRET is set in Workers secrets
   - Check API endpoints are accessible

### Debugging Commands

```bash
# View API logs
cd packages/api && npm run cf:tail

# Test API endpoints
curl https://your-worker.workers.dev/api/businesses/search?q=coffee

# Check D1 database
cd packages/api && npm run d1:console

# View Pages deployment logs
wrangler pages deployment tail
```

## 🔒 Security Considerations

1. **Secrets Management**
   - JWT secrets stored in Cloudflare Workers secrets
   - Environment variables not committed to repo
   - Use strong, unique JWT secrets

2. **CORS Configuration**
   - Only allow necessary origins
   - Mobile app and extension domains only

3. **Rate Limiting**
   - Configured in Workers for API protection
   - Consider adding additional protection for high-traffic

## 🌐 Custom Domains (Optional)

To use custom domains like `api.localfirstaz.com`:

1. **Add domain to Cloudflare**
   - Add domain in Cloudflare dashboard
   - Update nameservers

2. **Configure Workers Route**
   ```toml
   # In wrangler.toml
   [routes]
   pattern = "api.localfirstaz.com/*"
   zone_name = "localfirstaz.com"
   ```

3. **Configure Pages Custom Domain**
   - Go to Pages project settings
   - Add custom domain: `app.localfirstaz.com`
   - SSL certificate auto-provisioned

## 📊 Monitoring

### Built-in Monitoring
- **Workers Analytics**: Automatic request metrics
- **Pages Analytics**: Web vitals and performance
- **D1 Analytics**: Database usage and performance

### Custom Monitoring
Consider adding:
- **Sentry**: Error tracking
- **LogTail**: Centralized logging
- **Uptime monitoring**: External service monitoring

## 🔄 Updates and Maintenance

### Updating API
```bash
cd packages/api
npm run deploy
```

### Updating Mobile App
```bash
cd packages/mobile
npm run build:production
wrangler pages deploy web-build --project-name=localfirst-mobile
```

### Database Migrations
```bash
cd packages/api
# Create new migration file
wrangler d1 migrations create "your_migration_name"
# Apply migration
npm run d1:migrate
```

## 📞 Support

- **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com)
- **Wrangler CLI**: [github.com/cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk)
- **Project Issues**: See Linear project board