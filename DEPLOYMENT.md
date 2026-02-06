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

## ⚡ Development vs Production Deployment

### 🏠 Local Development Setup

You have **two options** for running the API server locally. Choose based on your needs:

#### Option 1: Node.js Development Server (Recommended for Most Development)

**When to use**: General development, debugging, faster startup, easier debugging with Node.js tools.

```bash
# ✅ RECOMMENDED: Start both API and mobile app simultaneously
npm run dev:all

# 🔍 Alternative: Start servers individually (if needed)
npm run dev:api    # Starts API server on http://localhost:8787 (Node.js)
npm run dev:mobile:web  # Starts mobile web app on http://localhost:8081
```

**Features**:
- Uses Node.js with `@hono/node-server`
- Faster startup and restart
- Full Node.js debugging capabilities
- Uses local SQLite database directly
- Hot reload with nodemon

#### Option 2: Cloudflare Workers Development (Wrangler Dev)

**When to use**: Testing Cloudflare Workers-specific features, environment variable handling, D1 database interactions, or preparing for deployment.

```bash
# Start API with Cloudflare Workers runtime
cd packages/api
wrangler dev --env development  # Starts API on http://localhost:8787 (Workers runtime)

# In another terminal, start mobile app
cd packages/mobile
npm run web  # Starts mobile web app on http://localhost:8081
```

**Features**:
- Uses actual Cloudflare Workers runtime
- Tests D1 database bindings
- Environment variables via `c.env`
- Scheduled Workers/cron testing
- Identical to production environment

#### 🚨 Port Conflict Resolution

If you get `EADDRINUSE: address already in use :::8787`:

1. **Kill conflicting processes**:
```bash
# Kill any existing processes on port 8787
pkill -f "wrangler.*dev" || pkill -f "npm run dev" || true
lsof -ti tcp:8787 | xargs -r kill -9 2>/dev/null || true
```

2. **Or use different ports temporarily**:
```bash
# Option A: Change Node.js dev server port in packages/api/dev-server.js
const port = 8788; // Instead of 8787

# Option B: Use wrangler on different port
cd packages/api && wrangler dev --env development --port 8788
```

**Important**: Never run both Node.js dev server AND wrangler dev simultaneously - they both use port 8787 by default.

#### 🎯 Development Workflow Recommendations

- **Daily development**: Use `npm run dev:all` (Node.js)
- **Pre-deployment testing**: Use `wrangler dev --env development`  
- **Database testing**: Use `wrangler dev` to test D1 interactions
- **Environment variable testing**: Use `wrangler dev` to test `c.env` access
- **Debugging**: Use Node.js dev server for better debugging tools

**Common Issue Prevention**: 
- Registration and other API calls will fail with "❌ Registration failed" if only the mobile app is running
- The mobile app expects the API server on port 8787 - ensure both servers are running
- Use `npm run dev:all` to avoid this issue entirely

### ☁️ Production Deployment to Cloudflare

#### Option 1: Automated Deployment (Recommended)
```bash
# Run complete production deployment
./scripts/deploy-all.sh
```

#### Option 2: Manual Step-by-step

1. **Setup Cloudflare Infrastructure**
   ```bash
   ./scripts/setup-cloudflare.sh
   ```

2. **Deploy API to Cloudflare Workers**
   ```bash
   cd packages/api
   npm run deploy
   ```

3. **Deploy Mobile App to Cloudflare Pages**
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

## 🚨 Critical Issues & Lessons Learned

### Local Development Server Dependencies

**Issue**: User registration failing with "❌ Registration failed. Please try again" in local development.

**Root Cause**: Only mobile app running (port 8081), but API server (port 8787) not started. Mobile app cannot connect to backend API.

**Key Lesson**: Always start both API server and mobile app for local development.

#### What Went Wrong
- Developer started only mobile app with `expo start --web`
- API server wasn't running on expected port 8787
- All API requests fail silently or with connection errors
- Error messages don't clearly indicate missing backend

#### Prevention Strategy
```bash
# ✅ ALWAYS use this command for local development
npm run dev:all

# ❌ DON'T start only mobile app
npm run dev:mobile:web
```

#### Fixed Implementation
- Updated DEPLOYMENT.md with clear local development section
- Emphasized `npm run dev:all` as the standard development command
- Added troubleshooting for "Registration failed" errors

### Production API Endpoints vs Frontend Integration

**Issue**: Mobile app was broken despite API endpoints working perfectly.

**Root Cause**: Frontend components using hardcoded API URLs instead of dynamic environment detection.

**Key Lesson**: Always use centralized API configuration for all frontend components.

#### What Went Wrong
```javascript
// ❌ BAD: Hardcoded API URL in ProfileInterviewScreen.js
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';
```

The ProfileInterviewScreen was the only component not using the shared `buildApiUrl()` function from `config/api.js`, causing it to default to localhost in production.

#### Prevention Strategy
- **Mandatory Pattern**: All API calls MUST use `buildApiUrl()` or `apiRequest()` from `config/api.js`
- **Code Review Checklist**: Search for hardcoded localhost URLs before deployment
- **Integration Testing**: Always test production builds on actual domains, not just localhost

#### Fixed Implementation
```javascript
// ✅ GOOD: Use shared API configuration
import { buildApiUrl } from '../config/api';

const response = await fetch(buildApiUrl('/api/interview/session'), {
  headers: { /* ... */ }
});
```

### Cloudflare Workers Environment Variables

**Issue**: Environment variables accessed via `process.env` don't work in Cloudflare Workers.

**Root Cause**: Workers use a different context (`c.env`) for environment variables.

**Key Lesson**: Always pass environment from Worker context to utility functions.

#### What Went Wrong
```javascript
// ❌ BAD: Direct process.env access
const jwtSecret = process.env.JWT_SECRET;
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

#### Fixed Implementation
```javascript
// ✅ GOOD: Pass environment through context
const jwtSecret = getJwtSecret(c.env);
const openaiClient = createOpenAIClient(c.env);
```

### Database Schema Synchronization

**Issue**: Production D1 database missing tables/columns that exist in local development.

**Root Cause**: Manual database changes not reflected in migration files.

**Key Lesson**: Always create proper migrations for schema changes, never modify databases manually.

#### Prevention Strategy
- **Migration-First**: Create migration file before making any schema changes
- **Sync Check**: Compare local and production schemas before deployment
- **Rollback Plan**: Test migration rollback before applying to production

### Performance Limits in Cloudflare Workers

**Issue**: CPU timeout errors during user registration due to expensive password hashing.

**Root Cause**: Scrypt parameters optimized for server environments, not edge computing constraints.

**Key Lesson**: Optimize crypto operations for Cloudflare Workers' 10ms CPU limit per request.

#### What Went Wrong
```javascript
// ❌ BAD: Too expensive for Workers
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 64 };
```

#### Fixed Implementation
```javascript
// ✅ GOOD: Optimized for Workers
const SCRYPT_PARAMS = { N: 4096, r: 8, p: 1, dkLen: 64 };
```

### UUID Generation Compatibility

**Issue**: `uuidv4()` from uuid package not available in Cloudflare Workers runtime.

**Root Cause**: Node.js packages don't always work in Workers environment.

**Key Lesson**: Use Web APIs when available (`crypto.randomUUID()`) instead of Node.js libraries.

#### Fixed Implementation
```javascript
// ✅ GOOD: Use Web API
const sessionId = crypto.randomUUID();
```

### Testing Strategy for Production Issues

**Issue**: API endpoints tested individually worked, but integration through frontend failed.

**Key Lesson**: End-to-end testing must include actual production domains and user flows.

#### Improved Testing Approach
1. **API Unit Tests**: Verify individual endpoints work
2. **Integration Tests**: Test frontend → API → database flow
3. **Production Testing**: Deploy to staging environment with production-like setup
4. **Manual Verification**: Test actual user flows on deployed domains

### Empty Environment Variable Detection

**Issue**: Cloudflare Workers secrets can exist but contain empty strings, causing silent failures.

**Root Cause**: The `OPENAI_API_KEY` was set in Cloudflare Workers secrets but contained an empty string, not null/undefined.

**Key Lesson**: Environment variable validation must check for empty strings, not just existence.

#### What Went Wrong
```javascript
// ❌ BAD: Only checks existence, not content
if (env.OPENAI_API_KEY) {
  // This passes even if OPENAI_API_KEY = ""
}
```

#### Detection Strategy
```javascript
// ✅ GOOD: Check existence AND content
if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0) {
  // Only proceeds with valid API key
}
```

#### Prevention Implementation
- Add debug logging to verify environment variable lengths in production
- Use `wrangler secret put OPENAI_API_KEY` to properly set secrets with values
- Test API integration after any secret updates

### Database Schema Synchronization Issues  

**Issue**: Production D1 database missing critical columns that existed in local development.

**Root Cause**: Manual database changes and piecemeal migrations created schema drift between environments.

**Key Lesson**: Treat local database as source of truth and ensure exact schema replication in production.

#### What Went Wrong
- Production database had old schema missing `primary_category`, `subcategory` columns
- AI recommendation engine failed with "no such column" errors
- Manual migrations created inconsistent state

#### Prevention Strategy
```bash
# ✅ GOOD: Complete database restoration approach
# 1. Export clean dump from local database
sqlite3 local.db .dump | grep -v 'BEGIN TRANSACTION' > clean-dump.sql

# 2. Add missing columns to production
wrangler d1 execute localfirst-prod --file add-missing-columns.sql --remote

# 3. Populate with complete data
wrangler d1 execute localfirst-prod --file insert-all-data.sql --remote
```

#### Fixed Implementation
- Local database (e.g. `local.db` at repo root or `DATABASE_URL`) is authoritative source
- Production database schema must match local exactly
- Use complete dumps instead of incremental migrations when schema drift occurs

### Deployment Checklist Updates

**Local Development Verification:**
- [ ] Both API server (8787) and mobile app (8081) running via `npm run dev:all`
- [ ] Registration and login working in local environment
- [ ] All API calls succeeding without connection errors

**Production Deployment Verification:**
- [ ] All components use centralized API configuration (`buildApiUrl()`)
- [ ] Environment variables properly configured for Workers context
- [ ] **Environment variables contain actual values, not empty strings**
- [ ] Database schema parity between local and production verified
- [ ] Database migrations applied to production
- [ ] Crypto operations optimized for Workers CPU limits
- [ ] Production domains tested manually with real user flows
- [ ] Console logs checked for errors on production domain
- [ ] API endpoints tested via curl for baseline functionality
- [ ] **AI endpoints tested with proper X-User-ID headers**
- [ ] **Complete user flows tested (not just API endpoints)**

## 📞 Support

- **Cloudflare Docs**: [developers.cloudflare.com](https://developers.cloudflare.com)
- **Wrangler CLI**: [github.com/cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk)
- **Project Issues**: See Linear project board