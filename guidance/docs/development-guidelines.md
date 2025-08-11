# Development Guidelines - Local First AZ Chrome Extension

## Overview

This document provides comprehensive technical guidelines for implementing the Local First Arizona Chrome Extension and its supporting infrastructure. The project consists of two main components:

1. **Chrome Extension** - Client-side extension for Google Maps manipulation
2. **Backend API** - Stateless web service for business data and analytics

## Tech Stack

### Chrome Extension
- **Framework**: Vanilla JavaScript (ES2022+)
- **Manifest Version**: V3
- **Build Tool**: Vite with Chrome Extension plugin
- **Testing**: Jest + Chrome Extension Testing Library
- **Linting**: ESLint + Prettier

### Backend API
- **Runtime**: Node.js 18+ 
- **Framework**: Hono.js (lightweight, edge-optimized)
- **Database**: SQLite via Turso.io
- **ORM**: Drizzle ORM
- **Authentication**: Clerk
- **Deployment**: Cloudflare Workers (free tier)
- **Environment**: Cloudflare Pages for admin dashboard

### Frontend (Admin Dashboard)
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Clerk
- **Deployment**: Cloudflare Pages
- **State Management**: React Query (TanStack Query)

## Project Structure

```
local-first-extension/
├── packages/
│   ├── extension/                 # Chrome Extension
│   │   ├── src/
│   │   │   ├── content-scripts/
│   │   │   │   ├── maps-modifier.js
│   │   │   │   ├── business-detector.js
│   │   │   │   └── ui-injector.js
│   │   │   ├── popup/
│   │   │   │   ├── popup.html
│   │   │   │   ├── popup.js
│   │   │   │   └── popup.css
│   │   │   ├── background/
│   │   │   │   └── service-worker.js
│   │   │   ├── shared/
│   │   │   │   ├── api-client.js
│   │   │   │   ├── business-matcher.js
│   │   │   │   ├── storage.js
│   │   │   │   └── constants.js
│   │   │   └── assets/
│   │   │       ├── icons/
│   │   │       ├── badges/
│   │   │       └── styles/
│   │   ├── public/
│   │   │   └── manifest.json
│   │   ├── tests/
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   ├── api/                       # Backend API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── businesses.js
│   │   │   │   ├── analytics.js
│   │   │   │   ├── auth.js
│   │   │   │   └── health.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js
│   │   │   │   ├── cors.js
│   │   │   │   ├── rate-limit.js
│   │   │   │   └── validation.js
│   │   │   ├── db/
│   │   │   │   ├── schema.js
│   │   │   │   ├── migrations/
│   │   │   │   └── seed.js
│   │   │   ├── services/
│   │   │   │   ├── business-service.js
│   │   │   │   ├── analytics-service.js
│   │   │   │   └── sync-service.js
│   │   │   ├── utils/
│   │   │   │   ├── validation.js
│   │   │   │   ├── geo.js
│   │   │   │   └── cache.js
│   │   │   └── index.js
│   │   ├── wrangler.toml
│   │   ├── package.json
│   │   └── drizzle.config.js
│   │
│   └── dashboard/                 # Admin Dashboard
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   ├── dashboard/
│       │   │   ├── businesses/
│       │   │   ├── analytics/
│       │   │   └── layout.js
│       │   ├── components/
│       │   │   ├── ui/              # shadcn/ui components
│       │   │   ├── forms/
│       │   │   ├── charts/
│       │   │   └── layout/
│       │   ├── lib/
│       │   │   ├── api.js
│       │   │   ├── auth.js
│       │   │   └── utils.js
│       │   └── styles/
│       │       └── globals.css
│       ├── public/
│       ├── package.json
│       └── next.config.js
│
├── docs/
│   ├── api/
│   ├── extension/
│   └── deployment/
├── scripts/
│   ├── build.sh
│   ├── deploy.sh
│   └── seed-data.js
├── package.json                   # Root workspace config
└── README.md
```

## Database Schema

### Core Tables

```sql
-- Businesses table
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  website TEXT,
  category TEXT NOT NULL,
  lfa_member BOOLEAN DEFAULT FALSE,
  member_since DATE,
  verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active', -- active, inactive, pending
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chain businesses blocklist
CREATE TABLE chain_businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  patterns TEXT, -- JSON array of name patterns to match
  category TEXT,
  parent_company TEXT,
  confidence_score INTEGER DEFAULT 100, -- 0-100 matching confidence
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics events
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  extension_id TEXT, -- anonymous extension identifier
  event_type TEXT NOT NULL, -- view, click, filter_toggle, etc.
  business_id TEXT,
  metadata TEXT, -- JSON additional data
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- User sessions (for analytics aggregation)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  extension_id TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  total_interactions INTEGER DEFAULT 0,
  businesses_viewed INTEGER DEFAULT 0,
  filters_toggled INTEGER DEFAULT 0
);

-- LFA sync tracking
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL, -- businesses, chains, full
  status TEXT NOT NULL, -- success, error, partial
  records_processed INTEGER,
  records_updated INTEGER,
  records_added INTEGER,
  error_details TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_businesses_location ON businesses(latitude, longitude);
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_lfa_member ON businesses(lfa_member);
CREATE INDEX idx_businesses_name ON businesses(name);
CREATE INDEX idx_chain_businesses_name ON chain_businesses(name);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_business ON analytics_events(business_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
```

## API Routes & Specifications

### Base URL
- **Development**: `http://localhost:8787`
- **Production**: `https://api-localfirst-az.your-domain.workers.dev`

### Authentication
All admin routes require Clerk JWT token in Authorization header:
```
Authorization: Bearer <clerk_jwt_token>
```

### Public Routes

#### GET `/api/businesses`
Retrieve businesses within a geographic area.

**Query Parameters:**
```typescript
{
  lat: number;          // Latitude
  lng: number;          // Longitude  
  radius?: number;      // Radius in miles (default: 5)
  category?: string;    // Filter by category
  lfa_only?: boolean;   // Only LFA members (default: false)
  limit?: number;       // Max results (default: 50, max: 200)
  offset?: number;      // Pagination offset
}
```

**Response:**
```typescript
{
  businesses: [
    {
      id: string;
      name: string;
      address: string;
      coordinates: [number, number]; // [lat, lng]
      phone?: string;
      website?: string;
      category: string;
      lfa_member: boolean;
      member_since?: string;
      verified: boolean;
      distance_miles: number;
    }
  ];
  total: number;
  has_more: boolean;
}
```

#### GET `/api/businesses/search`
Search businesses by name or category.

**Query Parameters:**
```typescript
{
  q: string;            // Search query
  lat?: number;         // Optional location context
  lng?: number;
  radius?: number;      // Search radius if location provided
  category?: string;
  limit?: number;
}
```

#### GET `/api/chains`
Get list of chain businesses for filtering.

**Response:**
```typescript
{
  chains: [
    {
      id: string;
      name: string;
      patterns: string[];   // Name matching patterns
      category: string;
      parent_company?: string;
      confidence_score: number;
    }
  ];
  last_updated: string;
}
```

#### POST `/api/analytics/events`
Record analytics events from extension.

**Request Body:**
```typescript
{
  extension_id: string;     // Anonymous extension identifier
  events: [
    {
      type: string;         // 'view' | 'click' | 'filter_toggle' | 'install'
      business_id?: string;
      metadata?: object;    // Additional event data
      timestamp?: string;   // ISO string, defaults to now
    }
  ];
}
```

### Admin Routes (Authenticated)

#### POST `/api/admin/businesses`
Add new business.

**Request Body:**
```typescript
{
  name: string;
  address: string;
  phone?: string;
  website?: string;
  category: string;
  lfa_member?: boolean;
  member_since?: string;
}
```

#### PUT `/api/admin/businesses/:id`
Update existing business.

#### DELETE `/api/admin/businesses/:id`
Soft delete business (sets status to 'inactive').

#### GET `/api/admin/analytics`
Get analytics dashboard data.

**Query Parameters:**
```typescript
{
  start_date?: string;  // ISO date
  end_date?: string;
  metric?: string;      // 'installs' | 'usage' | 'clicks' | 'all'
  group_by?: string;    // 'day' | 'week' | 'month'
}
```

#### POST `/api/admin/sync/lfa`
Trigger sync with LFA directory.

**Request Body:**
```typescript
{
  sync_type: 'full' | 'incremental';
  dry_run?: boolean;
}
```

## Environment Configuration

### API (.env)
```bash
# Database
DATABASE_URL="turso_connection_string"
DATABASE_AUTH_TOKEN="turso_auth_token"

# Authentication
CLERK_SECRET_KEY="clerk_secret_key"
CLERK_PUBLISHABLE_KEY="clerk_publishable_key"

# External APIs
LFA_API_URL="https://localfirstaz.com/api"
LFA_API_KEY="lfa_api_key"

# Analytics
ANALYTICS_ENABLED="true"
ANALYTICS_BATCH_SIZE="100"

# Rate Limiting
RATE_LIMIT_REQUESTS="1000"
RATE_LIMIT_WINDOW="3600"

# Environment
NODE_ENV="production"
LOG_LEVEL="info"
```

### Dashboard (.env.local)
```bash
# API
NEXT_PUBLIC_API_URL="https://api-localfirst-az.your-domain.workers.dev"

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="clerk_publishable_key"
CLERK_SECRET_KEY="clerk_secret_key"

# Features
NEXT_PUBLIC_ANALYTICS_ENABLED="true"
NEXT_PUBLIC_ENVIRONMENT="production"
```

### Extension
```javascript
// src/shared/constants.js
export const CONFIG = {
  API_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://api-localfirst-az.your-domain.workers.dev'
    : 'http://localhost:8787',
  
  EXTENSION_ID: chrome.runtime.id,
  
  SYNC_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  
  ANALYTICS: {
    ENABLED: true,
    BATCH_SIZE: 10,
    FLUSH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  },
  
  FILTERING: {
    DEFAULT_RADIUS: 5, // miles
    MAX_RESULTS: 50,
    CONFIDENCE_THRESHOLD: 80,
  }
};
```

## Chrome Extension Implementation Details

### Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Local First Arizona",
  "version": "1.0.0",
  "description": "Discover locally-owned businesses on Google Maps",
  
  "permissions": [
    "storage",
    "activeTab"
  ],
  
  "host_permissions": [
    "https://maps.google.com/*",
    "https://api-localfirst-az.your-domain.workers.dev/*"
  ],
  
  "background": {
    "service_worker": "background/service-worker.js"
  },
  
  "content_scripts": [
    {
      "matches": ["https://maps.google.com/*"],
      "js": [
        "shared/constants.js",
        "shared/api-client.js", 
        "shared/business-matcher.js",
        "content-scripts/business-detector.js",
        "content-scripts/ui-injector.js",
        "content-scripts/maps-modifier.js"
      ],
      "css": ["assets/styles/content.css"],
      "run_at": "document_idle"
    }
  ],
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Local First Arizona"
  },
  
  "icons": {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png", 
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  },
  
  "web_accessible_resources": [
    {
      "resources": [
        "assets/badges/*",
        "assets/styles/*"
      ],
      "matches": ["https://maps.google.com/*"]
    }
  ]
}
```

### Core Extension Architecture

#### Content Script Strategy
```javascript
// content-scripts/maps-modifier.js
class MapsModifier {
  constructor() {
    this.observer = null;
    this.businessMatcher = new BusinessMatcher();
    this.apiClient = new ApiClient();
    this.isEnabled = true;
  }

  async init() {
    // Load user preferences
    const settings = await chrome.storage.sync.get(['enabled', 'filterLevel']);
    this.isEnabled = settings.enabled !== false;
    
    // Start observing DOM changes
    this.startObserver();
    
    // Initial scan of existing content
    this.scanAndModifyBusinessListings();
  }

  startObserver() {
    this.observer = new MutationObserver((mutations) => {
      const hasNewBusinessListings = mutations.some(mutation => 
        mutation.addedNodes.length > 0 && 
        this.containsBusinessListings(mutation.addedNodes)
      );
      
      if (hasNewBusinessListings) {
        this.scanAndModifyBusinessListings();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async scanAndModifyBusinessListings() {
    if (!this.isEnabled) return;

    const businessElements = this.findBusinessElements();
    const currentLocation = this.getCurrentMapLocation();
    
    if (!currentLocation) return;

    // Get local businesses for current area
    const localBusinesses = await this.apiClient.getBusinesses({
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      radius: 5
    });

    // Process each business listing
    for (const element of businessElements) {
      await this.processBusinessElement(element, localBusinesses);
    }
  }

  async processBusinessElement(element, localBusinesses) {
    const businessName = this.extractBusinessName(element);
    if (!businessName) return;

    // Check if it's a chain business
    if (this.businessMatcher.isChainBusiness(businessName)) {
      this.handleChainBusiness(element, businessName, localBusinesses);
    } else {
      // Check if it's a known local business
      const localMatch = this.businessMatcher.findLocalMatch(businessName, localBusinesses);
      if (localMatch) {
        this.highlightLocalBusiness(element, localMatch);
      }
    }
  }

  handleChainBusiness(element, businessName, localBusinesses) {
    // Add filter overlay
    element.classList.add('lfa-chain-business');
    
    // Find local alternatives
    const alternatives = this.findAlternatives(businessName, localBusinesses);
    if (alternatives.length > 0) {
      this.showAlternatives(element, alternatives);
    }
  }

  highlightLocalBusiness(element, business) {
    // Add LFA badge
    const badge = this.createLFABadge(business);
    element.appendChild(badge);
    
    // Track view event
    this.apiClient.trackEvent('view', business.id);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MapsModifier().init();
  });
} else {
  new MapsModifier().init();
}
```

#### API Client
```javascript
// shared/api-client.js
class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL;
    this.eventQueue = [];
  }

  async getBusinesses(params) {
    const url = new URL(`${this.baseUrl}/api/businesses`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value);
    });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
      return { businesses: [], total: 0, has_more: false };
    }
  }

  async getChains() {
    try {
      const response = await fetch(`${this.baseUrl}/api/chains`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch chains:', error);
      return { chains: [], last_updated: null };
    }
  }

  trackEvent(type, businessId = null, metadata = {}) {
    this.eventQueue.push({
      type,
      business_id: businessId,
      metadata,
      timestamp: new Date().toISOString()
    });

    // Batch send events
    if (this.eventQueue.length >= CONFIG.ANALYTICS.BATCH_SIZE) {
      this.flushEvents();
    }
  }

  async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch(`${this.baseUrl}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extension_id: CONFIG.EXTENSION_ID,
          events
        })
      });
    } catch (error) {
      console.error('Failed to send analytics:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }
}
```

## Development Workflow

### Setup Instructions

1. **Clone and Install**
```bash
git clone <repository>
cd local-first-extension
npm install
```

2. **Database Setup**
```bash
# Set up Turso database
npm run db:setup
npm run db:migrate
npm run db:seed
```

3. **Environment Configuration**
```bash
# Copy environment templates
cp packages/api/.env.example packages/api/.env
cp packages/dashboard/.env.example packages/dashboard/.env.local

# Configure with your keys
# - Turso database credentials
# - Clerk authentication keys
# - LFA API access (if available)
```

4. **Development Servers**
```bash
# Start all services
npm run dev

# Or individually:
npm run dev:api        # Cloudflare Workers local
npm run dev:dashboard  # Next.js dashboard
npm run dev:extension  # Extension build watch
```

### Build Process

```bash
# Build extension for testing
npm run build:extension

# Build API for deployment  
npm run build:api

# Build dashboard for deployment
npm run build:dashboard

# Build all packages
npm run build
```

### Testing Strategy

#### Extension Testing
```bash
# Unit tests
npm run test:extension

# E2E tests (requires Chrome)
npm run test:extension:e2e

# Load extension in Chrome for manual testing
npm run load:extension
```

#### API Testing
```bash
# Unit and integration tests
npm run test:api

# Test with local Turso
npm run test:api:local
```

### Deployment Process

#### API Deployment (Cloudflare Workers)
```bash
# Deploy to staging
npm run deploy:api:staging

# Deploy to production
npm run deploy:api:prod
```

#### Dashboard Deployment (Cloudflare Pages)
```bash
# Deploy to staging
npm run deploy:dashboard:staging

# Deploy to production  
npm run deploy:dashboard:prod
```

#### Extension Publishing
```bash
# Build production extension
npm run build:extension:prod

# Package for Chrome Web Store
npm run package:extension

# Manual upload to Chrome Web Store required
```

## Performance Guidelines

### Extension Performance
- **DOM Operations**: Batch DOM modifications, use `requestAnimationFrame`
- **API Calls**: Implement caching, debounce frequent requests
- **Memory Management**: Clean up observers and event listeners
- **Startup Time**: Lazy load non-critical functionality

### API Performance
- **Database**: Use appropriate indexes, limit query complexity
- **Caching**: Implement edge caching for static data
- **Rate Limiting**: Protect against abuse
- **Response Size**: Paginate large results, compress responses

### Monitoring & Debugging

#### Extension Debugging
```javascript
// Development logging utility
const logger = {
  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LFA Debug] ${message}`, data);
    }
  },
  error: (message, error) => {
    console.error(`[LFA Error] ${message}`, error);
    // Send to error tracking service
  }
};
```

#### API Monitoring
- **Cloudflare Analytics**: Built-in request metrics
- **Custom Metrics**: Track business API usage
- **Error Tracking**: Log and alert on API errors
- **Performance**: Monitor response times and database query performance

## Security Considerations

### Extension Security
- **Content Security Policy**: Strict CSP in manifest
- **Input Validation**: Sanitize all data from Google Maps DOM
- **API Communication**: HTTPS only, validate responses
- **Permissions**: Minimal required permissions

### API Security  
- **Authentication**: Clerk JWT validation for admin routes
- **Rate Limiting**: Prevent abuse of public endpoints
- **Input Validation**: Validate all request parameters
- **SQL Injection**: Use parameterized queries with Drizzle ORM
- **CORS**: Appropriate CORS headers for extension communication

## Coding Standards

### JavaScript/TypeScript
- **ES2022+** features where supported
- **Async/await** over promises
- **Functional programming** patterns preferred
- **Error handling**: Always handle errors gracefully
- **Comments**: Document complex business logic

### CSS
- **Tailwind CSS** utility classes
- **shadcn/ui** components for consistency
- **Responsive design** mobile-first approach
- **Dark mode** support where applicable

### Git Workflow
- **Feature branches**: `feature/description`
- **Conventional commits**: `feat:`, `fix:`, `docs:`, etc.
- **Pull requests**: Required for main branch
- **Code review**: At least one approval required

## Documentation Requirements

### Code Documentation
- **API endpoints**: OpenAPI/Swagger specs
- **Database schema**: ERD and migration docs
- **Extension architecture**: Component interaction diagrams
- **Deployment**: Step-by-step deployment guides

### User Documentation
- **Installation guide**: For extension users
- **Admin manual**: For LFA staff using dashboard
- **Troubleshooting**: Common issues and solutions
- **Privacy policy**: Data collection and usage

---

This development guide should provide everything needed to begin implementation. Refer to the main PRD for business requirements and user stories.