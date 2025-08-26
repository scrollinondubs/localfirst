# Local First Arizona - Development Guidelines

## Project Overview

Cross-platform mobile application for Local First Arizona using React Native + Expo with Cloudflare Workers backend. Multi-agent development approach with maximum Claude Code autonomy.

## Technical Stack

### Frontend (Mobile App)
- **Framework:** React Native with Expo
- **Language:** TypeScript
- **State Management:** 
  - React Query (server state)
  - Zustand (client state)
- **Maps:** react-native-maps with Google Maps
- **Navigation:** React Navigation v6
- **Push Notifications:** Expo Notifications
- **Authentication:** Firebase Auth with Expo

### Backend (API)
- **Platform:** Cloudflare Workers
- **Framework:** Hono (lightweight web framework)
- **Language:** JavaScript
- **Runtime:** Cloudflare Workers Runtime
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Authentication:** JWT with bcrypt for password hashing
- **External APIs:** Semantic search with location-based queries

### Development Tools
- **Version Control:** GitHub (with MCP integration)
- **Project Management:** Linear (with MCP integration)
- **Mobile Development:** Expo CLI (direct access via authentication token)
- **Design & Prototyping:** Frame0 (with MCP integration)
- **Documentation:** Context7 MCP for library docs
- **Web Testing:** Playwright (with MCP integration)
- **Web Scraping:** Firecrawl MCP for research
- **CI/CD:** GitHub Actions + Expo EAS
- **Testing:** Jest + Detox (E2E)
- **Code Quality:** ESLint + Prettier
- **Type Checking:** TypeScript strict mode

## Project Structure

### Mobile App Structure
```
/mobile-app
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/         # Generic components
│   │   ├── business/       # Business-specific components
│   │   └── maps/          # Map-related components
│   ├── screens/            # Screen components
│   │   ├── auth/          # Authentication screens
│   │   ├── discovery/     # Business discovery screens
│   │   ├── profile/       # User profile screens
│   │   └── business/      # Business claiming screens
│   ├── navigation/         # Navigation configuration
│   ├── services/          # API calls and external services
│   ├── store/            # State management (Zustand stores)
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   └── constants/        # App constants and config
├── assets/               # Images, fonts, etc.
├── app.config.js        # Expo configuration
└── package.json
```

### Backend Structure
```
/backend
├── src/
│   ├── handlers/         # Request handlers
│   │   ├── auth/        # Authentication endpoints
│   │   ├── businesses/  # Business-related endpoints
│   │   ├── users/       # User management endpoints
│   │   └── maps/        # Maps and location endpoints
│   ├── services/        # Business logic layer
│   ├── models/          # Data models and types
│   ├── utils/           # Utility functions
│   ├── middleware/      # Request middleware
│   └── config/          # Configuration and constants
├── wrangler.toml        # Cloudflare Workers config
└── package.json
```

## Database Design

### Cloudflare D1 (SQLite) Schema

#### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  profile_image_url TEXT,
  preferences_json TEXT, -- JSON object with user preferences
  location_latitude REAL,
  location_longitude REAL,
  location_city TEXT,
  location_state TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Businesses Table
```sql
CREATE TABLE businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_place_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  website TEXT,
  hours_json TEXT,           -- JSON object with operating hours
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  price_level INTEGER,       -- 1-4 scale
  lfa_member BOOLEAN DEFAULT FALSE,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_by INTEGER,        -- Foreign key to users.id
  verification_status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claimed_by) REFERENCES users (id)
);
```

#### Business Claims Collection
```typescript
interface BusinessClaim {
  id: string;
  businessId: string;
  userId: string;
  verificationType: 'email' | 'location';
  verificationData: {
    email?: string;            // For email verification
    coordinates?: {            // For location verification
      latitude: number;
      longitude: number;
    };
  };
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;         // Admin user ID
}
```

#### Cities Collection
```typescript
interface City {
  id: string;
  name: string;
  state: string;
  bounds: {
    northeast: { lat: number; lng: number; };
    southwest: { lat: number; lng: number; };
  };
  adminUsers: string[];        // User IDs with admin access
  active: boolean;
  createdAt: Timestamp;
}
```

## API Design

### Base URL
- **Development:** `http://localhost:8787` (local dev server)
- **Production:** `https://localfirst-api-production.localfirst.workers.dev`

### Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt-token>
```

JWT tokens are obtained through login/register endpoints and contain user ID and permissions.

#### AI Endpoint Requirements
All AI-powered endpoints (interview, concierge) require **both** authentication headers:
```
Authorization: Bearer <jwt-token>
X-User-ID: <user-id>
```

**Critical Implementation Notes:**
- AI endpoints will return `401 User ID required` if `X-User-ID` header is missing
- User ID must match the authenticated user in the JWT token
- All mobile app screens using AI features must include both headers in API calls
- Use the centralized `buildApiUrl()` function and include both headers consistently

### API Routes

#### Authentication Routes
```javascript
POST /api/auth/login       // Login with email/password
POST /api/auth/register    // Register new user account
GET  /api/auth/profile     // Get current user profile
PUT  /api/auth/profile     // Update user profile
```

#### Business Routes
```javascript
GET  /api/businesses/semantic-search  // Semantic search with location (primary endpoint)
GET  /api/businesses/nearby           // Location-based business discovery
GET  /api/businesses/:id              // Get specific business details
POST /api/businesses                  // Create new business (admin only)
PUT  /api/businesses/:id              // Update business (owner/admin only)
```

#### AI Interview & Profile Routes
```javascript
GET  /api/interview/session           // Get or create interview session
POST /api/interview/message           // Send message to AI interviewer
POST /api/interview/complete          // Complete interview session
POST /api/interview/generate-dossier  // Generate personal dossier from interview
GET  /api/interview/dossier           // Get user's personal dossier
PUT  /api/interview/dossier           // Update personal dossier
```

#### AI Concierge Routes  
```javascript
GET  /api/concierge/eligibility       // Check user eligibility for recommendations
GET  /api/concierge/recommendations   // Get existing recommendations
POST /api/concierge/recommendations/generate  // Generate new recommendations
PATCH /api/concierge/recommendations/:id/dismiss  // Dismiss recommendation
```

#### Chain Routes
```javascript
GET  /api/chains           // Get business chain information
POST /api/chains           // Create new chain (admin only)
```

#### Analytics Routes
```javascript
GET  /api/analytics        // Get usage analytics (admin only)
POST /api/analytics/event  // Track user events
```

### Query Parameters for Business Search
```typescript
interface BusinessSearchParams {
  query: string;            // Semantic search query (required)
  lat: number;              // Latitude (required)  
  lng: number;              // Longitude (required)
  radius?: number;          // Search radius in miles (default: 25)
  limit?: number;           // Number of results (default: 50)
  category?: string;        // Filter by business category
  lfa_member?: boolean;     // Filter to LFA members only
}
```

## Coding Standards

### TypeScript Guidelines
- **Strict mode enabled** - no `any` types allowed
- **Interface over type** for object definitions
- **Explicit return types** for all functions
- **Null safety** - handle undefined/null explicitly

### React Native Best Practices
- **Functional components only** with hooks
- **Custom hooks** for reusable logic
- **Memo optimization** for expensive components
- **Platform-specific code** when necessary using Platform.select()

### State Management
- **React Query** for all server state
- **Zustand** for client-only state
- **No prop drilling** - use context or state management
- **Optimistic updates** where appropriate

### Code Organization
- **Feature-based folders** not technology-based
- **Barrel exports** for clean imports
- **Absolute imports** using path mapping
- **Single responsibility** principle

### Naming Conventions
- **Files:** kebab-case (`business-card.tsx`)
- **Components:** PascalCase (`BusinessCard`)
- **Functions/Variables:** camelCase (`getUserProfile`)
- **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Types/Interfaces:** PascalCase with descriptive names

### Error Handling
- **Global error boundary** for React components
- **Consistent error responses** from API
- **User-friendly error messages**
- **Logging** for debugging (use console in development, external service in production)

## Testing Strategy

### Unit Testing (Jest)
- **100% coverage** for utility functions
- **Component testing** with React Native Testing Library
- **Hook testing** for custom hooks
- **Service layer testing** for API calls

### Integration Testing
- **API endpoint testing** with mock Firebase
- **Database operation testing**
- **Authentication flow testing**

### E2E Testing (Detox)
- **Critical user paths** only
- **Business discovery flow**
- **Business claiming flow**
- **User registration/login**

## Performance Guidelines

### Mobile App Optimization
- **Image optimization** - use WebP format, lazy loading
- **Bundle size monitoring** - keep under 50MB
- **Memory management** - avoid memory leaks
- **List virtualization** for large data sets

### Backend Optimization
- **Firestore query optimization** - use composite indexes
- **Caching strategy** - cache static data
- **Rate limiting** to prevent abuse
- **Response compression** for large payloads

## Security Requirements

### Authentication & Authorization
- **Firebase Auth** for user authentication
- **Role-based access control** (user, business owner, admin)
- **Token validation** on all protected endpoints
- **Secure token storage** on mobile device

### Data Protection
- **Input validation** on all user inputs
- **SQL injection prevention** (Firestore is NoSQL but validate queries)
- **HTTPS only** for all communications
- **Sensitive data encryption** if storing locally

## Deployment Process

### Mobile App Deployment
1. **Development builds** using Expo Development Client
2. **Preview builds** for testing using EAS Build
3. **Production builds** submitted to app stores via EAS Submit

### Backend Deployment
1. **Development environment** - automatic deployment on push to dev branch
2. **Staging environment** - manual deployment for testing
3. **Production environment** - manual deployment with approval

## Environment Configuration

### Mobile App Environment Variables
```typescript
export const config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  FIREBASE_CONFIG: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    // ... other Firebase config
  }
};
```

### Backend Environment Variables
```typescript
// wrangler.toml
[env.development.vars]
NODE_ENV = "development"
CORS_ORIGIN = "http://localhost:3000"

[env.production.vars]
NODE_ENV = "production"
```

#### Cloudflare Workers Secrets Management
**Critical:** Use `wrangler secret put` for sensitive values like API keys:

```bash
# Set secrets in production (not in wrangler.toml)
wrangler secret put OPENAI_API_KEY --name localfirst-api-production
wrangler secret put JWT_SECRET --name localfirst-api-production
```

**Environment Variable Access in Workers:**
```javascript
// ❌ BAD: process.env doesn't work in Cloudflare Workers
const apiKey = process.env.OPENAI_API_KEY;

// ✅ GOOD: Use context environment in Workers
function createOpenAIClient(env) {
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0) {
    return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return null;
}

// Usage in route handlers
app.post('/api/example', async (c) => {
  const openai = createOpenAIClient(c.env);
  // ...
});
```

**Environment Variable Validation:**
```javascript
// ✅ GOOD: Check existence AND non-empty content
if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0) {
  // Proceed with valid API key
} else {
  console.warn('OPENAI_API_KEY not found or empty');
  return null;
}
```

## Multi-Agent Development Workflow

### Agent Responsibilities & Tool Access

#### UI/UX Designer
- **Primary Role:** Design system, component specs, user flows, wireframes
- **Tool Access:** Frame0 MCP (mockups), Firecrawl MCP (research), Context7 MCP (design system docs)

#### Frontend Engineer  
- **Primary Role:** React Native implementation, state management, mobile UI
- **Tool Access:** **Expo CLI** (build/test), GitHub MCP (code management), Context7 MCP (React Native docs)

#### Backend Database Engineer
- **Primary Role:** API development, database design, server architecture
- **Tool Access:** GitHub MCP (code management), **Direct database access via Bash** (no SQLite MCP), Context7 MCP (Firebase docs)

#### QA Testing Engineer
- **Primary Role:** Test plans, automated testing, bug reporting, quality assurance
- **Tool Access:** **Expo CLI** (testing builds), Playwright MCP (web testing), GitHub MCP (bug reports)

#### DevOps Engineer
- **Primary Role:** CI/CD, deployment, infrastructure, build systems
- **Tool Access:** **Expo CLI** (deployments), GitHub MCP (CI/CD), Context7 MCP (deployment docs)

#### Product Manager
- **Primary Role:** Requirements, prioritization, stakeholder communication
- **Tool Access:** Linear MCP (project management), Frame0 MCP (wireframes), Firecrawl MCP (market research)

#### Marketing Specialist
- **Primary Role:** App store optimization, user acquisition, growth strategies
- **Tool Access:** Firecrawl MCP (market research), GitHub MCP (landing pages), Context7 MCP (marketing docs)

#### CTO (Chief Technology Officer)
- **Primary Role:** Architecture decisions, technical strategy, oversight
- **Tool Access:** **ALL MCP TOOLS** + **Expo CLI** (full system access for architectural oversight)

### MCP Server Configuration & Usage

#### Currently Active MCP Servers:

1. **Linear Server** (`linear-server`)
   - **Type:** SSE (Server-Sent Events)
   - **Purpose:** Project management, issue tracking, sprint planning
   - **Used By:** All agents for task coordination

2. **Context7** (`context7`)  
   - **Type:** stdio
   - **Purpose:** Up-to-date library documentation and code examples
   - **Used By:** All technical agents for current documentation

3. **GitHub** (`github`)
   - **Type:** stdio  
   - **Purpose:** Code repository management, PR reviews, CI/CD
   - **Used By:** All development agents for version control

4. **Frame0** (`frame0`)
   - **Type:** stdio
   - **Purpose:** UI/UX design, wireframing, mockup creation
   - **Used By:** ui-ux-designer, product-manager, cto

5. **Playwright** (`playwright`)
   - **Type:** stdio
   - **Purpose:** Automated web testing, browser automation
   - **Used By:** qa-testing-engineer, cto

6. **Firecrawl** (`firecrawl`)
   - **Type:** stdio
   - **Purpose:** Web scraping, market research, competitive analysis
   - **Used By:** marketing-specialist, product-manager, cto

#### Deprecated/Not Used:
- **SQLite MCP:** Replaced with direct database access via Bash scripts
- **Expo MCP Server:** Replaced with direct Expo CLI access via authentication token

### Expo CLI Access Configuration

**Authentication Token:** `T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV`

**Agents with Expo CLI Access:**
- **cto:** Full access for architectural oversight and troubleshooting  
- **qa-testing-engineer:** Testing builds, debugging, quality assurance
- **frontend-engineer:** Development, building, deployment coordination
- **devops-engineer:** Production deployments, infrastructure management

**Common Expo CLI Commands:**
```bash
# Authentication (done globally)
EXPO_TOKEN=T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV npx @expo/cli whoami

# Development
EXPO_TOKEN=T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV npx expo start
EXPO_TOKEN=T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV npx expo start --web

# Building & Deployment  
EXPO_TOKEN=T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV npx expo build:ios
EXPO_TOKEN=T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV npx expo build:android

# Install dependencies
EXPO_TOKEN=T0HvqMetlSLpt9lZIMcRCzmJPGz9JTd2oenbbLJV npx expo install [packages]
```

### Database Access Protocol

**Important:** We use Cloudflare D1 for production and local SQLite for development. Database operations are performed via:
- **Local Development:** Direct sqlite3 command line tools
- **Production:** Cloudflare D1 via wrangler CLI
- **API Layer:** Hono with D1 bindings

**Database Locations:**
- **Local:** `/Users/aiden/NodeJSprojs/localfirst/local.db`  
- **Production:** Cloudflare D1 instance (managed via wrangler)

**Common Database Commands:**
```bash
# Local development
cd packages/api
DATABASE_URL="file:../../local.db" node dev-server.js

# Query local data
sqlite3 /Users/aiden/NodeJSprojs/localfirst/local.db "SELECT * FROM businesses;"

# Production D1 operations
wrangler d1 execute localfirst-prod --command "SELECT * FROM businesses LIMIT 10"
wrangler d1 migrations apply localfirst-prod
```

### Communication Protocol
- **Linear MCP** for all task management and coordination
- **GitHub MCP** for code reviews, PR management, and deployment tracking
- **Direct Expo CLI** for mobile development lifecycle
- **Frame0 MCP** for design collaboration and wireframing
- **Autonomous operation** with minimal human intervention required

## Getting Started

### Initial Setup
1. Clone repository and install dependencies
2. Set up Firebase project and configure authentication
3. Configure Google Maps API keys
4. Set up Cloudflare Workers development environment
5. Install Expo CLI and configure EAS
6. Set up Linear and GitHub integrations

### Development Workflow
1. Create Linear issue from "unrealized user stories"
2. Create feature branch from main
3. Implement feature with tests
4. Submit pull request with Linear issue reference
5. Automated testing and code review
6. Deploy to development environment
7. QA testing and approval
8. Merge to main and deploy to production