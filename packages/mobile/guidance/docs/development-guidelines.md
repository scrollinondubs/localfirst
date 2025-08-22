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
- **Language:** TypeScript
- **Runtime:** Cloudflare Workers Runtime
- **Database:** Firebase Firestore
- **Authentication:** Firebase Admin SDK
- **External APIs:** Google Maps API, Google Places API

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

### Firebase Firestore Collections

#### Users Collection
```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;
  displayName?: string;
  photoURL?: string;
  preferences: {
    categories: string[];        // Preferred business categories
    radius: number;             // Search radius in miles
    notifications: boolean;
  };
  location?: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Businesses Collection
```typescript
interface Business {
  id: string;                    // Auto-generated
  googlePlaceId?: string;        // Google Places API ID
  name: string;
  description?: string;
  category: string;
  subcategories: string[];
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
  };
  hours?: {
    [day: string]: {           // monday, tuesday, etc.
      open: string;            // "09:00"
      close: string;           // "17:00"
      closed: boolean;
    };
  };
  images?: string[];           // URLs to business images
  claimed: boolean;
  claimedBy?: string;          // User ID who claimed it
  verificationStatus: 'pending' | 'verified' | 'rejected';
  localFirstMember: boolean;   // LFA member status
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
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
- **Development:** `https://lfa-api-dev.workers.dev`
- **Production:** `https://lfa-api.workers.dev`

### Authentication
All protected endpoints require Firebase ID token in Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### API Routes

#### Authentication Routes
```typescript
POST /auth/verify          // Verify Firebase token
GET  /auth/profile         // Get current user profile
PUT  /auth/profile         // Update user profile
```

#### Business Routes
```typescript
GET    /businesses               // Search businesses (with query params)
GET    /businesses/:id           // Get specific business
POST   /businesses               // Create new business (admin only)
PUT    /businesses/:id           // Update business (owner/admin only)
POST   /businesses/:id/claim     // Claim a business
GET    /businesses/claims        // Get user's claims
PUT    /businesses/claims/:id    // Update claim status (admin only)
```

#### Location Routes
```typescript
GET  /locations/search      // Search Google Places
GET  /locations/nearby      // Get nearby businesses
```

#### Admin Routes
```typescript
GET  /admin/claims          // Get all pending claims
GET  /admin/businesses      // Get all businesses (admin view)
GET  /admin/users           // Get users (admin only)
```

### Query Parameters for Business Search
```typescript
interface BusinessSearchParams {
  latitude: number;
  longitude: number;
  radius?: number;           // Default: 10 miles
  category?: string;
  subcategory?: string;
  query?: string;           // Text search
  localFirstOnly?: boolean; // Filter to LFA members only
  limit?: number;           // Default: 50
  offset?: number;          // For pagination
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
FIREBASE_PROJECT_ID = "lfa-dev"
GOOGLE_MAPS_API_KEY = "development-key"

[env.production.vars]
FIREBASE_PROJECT_ID = "lfa-prod"
GOOGLE_MAPS_API_KEY = "production-key"
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

**Important:** We no longer use SQLite MCP for database operations. All database access is performed via direct Bash scripts using sqlite3 command line tools.

**Database Location:** `/Users/aiden/NodeJSprojs/localfirst-app/local.db`

**Common Database Commands:**
```bash
# Direct SQLite access
sqlite3 /Users/aiden/NodeJSprojs/localfirst-app/local.db

# Query data
sqlite3 /Users/aiden/NodeJSprojs/localfirst-app/local.db "SELECT * FROM businesses;"

# Import data
sqlite3 /Users/aiden/NodeJSprojs/localfirst-app/local.db < data.sql
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