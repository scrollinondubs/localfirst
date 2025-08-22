# Deployment Strategy - Local First Arizona Web Application

## Overview

This document outlines the deployment strategy for moving from local development to production hosting for the Local First Arizona web application.

## Current Architecture (Development)

- **Frontend**: Expo development server (`http://localhost:8082`)
- **API Server**: Express.js (`http://localhost:3001`)
- **Database**: Local SQLite file (`local.db`)
- **Voice**: Web Speech API with Chrome security flags
- **Maps**: Google Maps API (configured)

## Production Deployment Architecture

### Database: Turso.tech (Hosted SQLite)

**Why Turso.tech:**
- Native SQLite compatibility (no schema changes needed)
- Edge replication for global performance
- Easy migration from local SQLite
- Cost-effective for startup usage

**Migration Steps:**
1. **Setup Turso account and database**
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # Create database
   turso db create local-first-arizona
   
   # Get connection URL
   turso db show local-first-arizona --url
   ```

2. **Migrate existing data**
   ```bash
   # Export current SQLite data
   sqlite3 local.db .dump > data_export.sql
   
   # Import to Turso
   turso db shell local-first-arizona < data_export.sql
   ```

3. **Update connection string**
   ```env
   DATABASE_URL=libsql://your-database-url.turso.tech?authToken=your-token
   ```

### API Server Deployment

**Recommended: Vercel (Serverless)**

**Why Vercel:**
- Zero-config deployment
- Automatic scaling
- Built-in CI/CD with GitHub
- Good SQLite/Turso integration
- Cost-effective

**Alternative Options:**
- **Railway**: Simple deployment, persistent connections
- **Heroku**: Traditional hosting (more expensive)
- **Render**: Good middle ground

**Deployment Steps (Vercel):**

1. **Prepare API for serverless**
   ```javascript
   // api/index.js (Vercel entry point)
   const app = require('../mobile-app/api-server');
   module.exports = app;
   ```

2. **Create vercel.json**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "api/index.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "api/index.js"
       }
     ],
     "env": {
       "DATABASE_URL": "@database_url",
       "JWT_SECRET": "@jwt_secret"
     }
   }
   ```

3. **Configure environment variables in Vercel dashboard**
   - `DATABASE_URL`: Turso connection string
   - `JWT_SECRET`: Secure production secret
   - `NODE_ENV`: production

### Web Application Deployment

**Option 1: Expo Export + Vercel (Recommended)**

**Process:**
1. **Build web application**
   ```bash
   cd mobile-app
   npx expo export:web
   ```

2. **Deploy to Vercel**
   - Create separate Vercel project for frontend
   - Point to `web-build` directory
   - Configure custom domain
   - Set up automatic deployments from GitHub

**Option 2: Expo Export + Netlify**

**Process:**
1. **Build and deploy**
   ```bash
   npx expo export:web
   # Upload web-build folder to Netlify
   ```

2. **Configure redirects for SPA**
   ```toml
   # netlify.toml
   [[redirects]]
   from = "/*"
   to = "/index.html"
   status = 200
   ```

**Option 3: Traditional Hosting (Cloudflare Pages, etc.)**
- Export web build
- Upload static files
- Configure SPA routing

## Production Configuration

### Environment Variables

**API Server (.env.production):**
```env
DATABASE_URL=libsql://your-database.turso.tech?authToken=your-token
JWT_SECRET=your-secure-production-secret-min-32-chars
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.com
```

**Frontend (Expo configuration):**
```json
{
  "expo": {
    "web": {
      "bundler": "metro"
    },
    "extra": {
      "API_BASE_URL": "https://your-api-domain.vercel.app/api"
    }
  }
}
```

### HTTPS and Security

**Requirements:**
- **HTTPS mandatory** for Web Speech API in production
- **CORS configuration** for cross-origin API requests
- **Environment variable security** (no hardcoded secrets)

**Implementation:**
```javascript
// Update CORS in production
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8082',
  credentials: true
}));
```

## Deployment Checklist

### Pre-Deployment
- [ ] Test voice features work with HTTPS
- [ ] Verify Google Maps API works in production domain
- [ ] Test location permissions in production environment
- [ ] Confirm all business data migrated correctly
- [ ] Set up monitoring and error tracking

### Database Migration
- [ ] Create Turso.tech account and database
- [ ] Export current SQLite data
- [ ] Import data to Turso
- [ ] Test API connectivity with production database
- [ ] Update connection strings in all environments

### API Deployment
- [ ] Choose hosting platform (Vercel recommended)
- [ ] Configure environment variables
- [ ] Set up custom domain (optional)
- [ ] Configure CORS for production frontend domain
- [ ] Test all API endpoints in production

### Frontend Deployment
- [ ] Build web application with `expo export:web`
- [ ] Choose hosting platform (Vercel/Netlify recommended)
- [ ] Configure custom domain
- [ ] Set up automatic deployments from GitHub
- [ ] Test complete application flow

### Post-Deployment Testing
- [ ] Voice search functionality
- [ ] Location detection and manual input
- [ ] Business search with semantic matching
- [ ] Google Maps integration
- [ ] Optional user registration/login
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

## Cost Estimates (Monthly)

**Turso.tech:**
- Starter: Free (500 DB locations, 1B row reads)
- Scaler: $29/month (unlimited locations)

**Vercel:**
- Hobby: Free (100GB bandwidth, 1000 serverless executions)
- Pro: $20/month (1000GB bandwidth, unlimited executions)

**Total Estimated Cost: $0-49/month**

## Monitoring and Maintenance

**Recommended Tools:**
- **Uptime Monitoring**: UptimeRobot (free tier)
- **Error Tracking**: Sentry (free tier)
- **Analytics**: Google Analytics
- **Performance**: Web Vitals monitoring

**Maintenance Tasks:**
- Regular database backups (Turso handles this)
- Monitor API performance and errors
- Update dependencies and security patches
- Monitor voice recognition usage and errors
- Review and optimize search performance

## Rollback Strategy

**Database:**
- Turso provides point-in-time recovery
- Keep local SQLite backup for emergencies

**API Server:**
- Vercel provides instant rollback to previous deployments
- GitHub-based deployment history

**Frontend:**
- Static hosting allows instant rollback
- Keep previous build artifacts

## Future Scalability

**Horizontal Scaling Ready:**
- Stateless API server design
- SQLite with edge replication (Turso)
- CDN-served static frontend
- Serverless architecture

**Growth Accommodations:**
- Database partitioning by geographic region
- API rate limiting and caching
- Progressive Web App (PWA) features
- CDN optimization for global users