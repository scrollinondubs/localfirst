# Local First Arizona - Updated Development Guidelines

## Project Overview

Web-first application for Local First Arizona business discovery using React Native + Expo for web deployment, with Express.js API server and SQLite database. No Firebase dependencies - simplified architecture focused on rapid deployment.

## Technical Stack

### Frontend (Web Application)
- **Framework:** React Native with Expo (web target)
- **Language:** JavaScript (no TypeScript requirement)
- **Voice Interface:** Web Speech API (browser-based)
- **Maps:** react-native-maps with Google Maps integration
- **Navigation:** React Navigation v6
- **Authentication:** JWT-based (optional user accounts)

### Backend (API Server)
- **Platform:** Express.js (local development)
- **Language:** JavaScript
- **Database:** SQLite (local) / Turso.tech (production)
- **Authentication:** JWT tokens
- **Business Data:** Pre-loaded SQLite database with semantic search

### Development Tools
- **Version Control:** GitHub
- **Project Management:** Linear (with MCP integration)
- **Web Development:** Expo CLI for web builds
- **Database Management:** Direct SQLite access via CLI
- **Documentation:** Context7 MCP for library docs
- **Web Testing:** Playwright (with MCP integration)
- **CI/CD:** GitHub Actions + Vercel deployment

## Current Project Structure

```
/localfirst-app
├── mobile-app/
│   ├── components/          # Reusable UI components
│   │   ├── AuthContext.js      # Authentication context
│   │   ├── LocationPermissionModal.js
│   │   └── ManualLocationInput.js
│   ├── screens/             # Screen components
│   │   ├── LoginScreen.js      # Optional login
│   │   ├── RegisterScreen.js   # Optional registration
│   │   ├── ProfileScreen.js    # Profile/account management
│   │   └── SearchScreen.js     # Main search interface
│   ├── navigation/          # Navigation configuration
│   │   └── AppNavigator.js     # Main navigation setup
│   ├── services/            # External services
│   │   ├── LocationService.js  # Location detection
│   │   └── VoiceService.js     # Web Speech API integration
│   ├── assets/              # Images, fonts, icons
│   │   ├── icon.png           # App icon
│   │   └── LFA-icon.png       # Local First Arizona home icon
│   ├── api-server.js        # Express.js API server
│   ├── app.json            # Expo configuration
│   └── package.json
├── local.db                # SQLite database (5,000+ businesses)
└── guidance/docs/          # Project documentation
```

## Database Design (SQLite)

### Businesses Table
```sql
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude REAL,
  longitude REAL,
  phone TEXT,
  website TEXT,
  category TEXT,
  lfa_member BOOLEAN DEFAULT 0,
  member_since DATE,
  verified BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'active'
);
```

### Users Table (Optional)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active BOOLEAN DEFAULT 1
);
```

### Key Business Data
- **Total businesses:** ~5,146 records
- **LFA members:** Prioritized in search results
- **Categories:** Mostly "other" (needs semantic search)
- **Coordinates:** Available for mapping

## API Design

### Base URL
- **Development:** `http://localhost:3001/api`
- **Production:** `https://your-api-domain.vercel.app/api`

### Authentication (Optional)
JWT tokens in Authorization header:
```
Authorization: Bearer <jwt-token>
```

### API Routes

#### Public Endpoints
```javascript
GET  /api/businesses/search    // Search with semantic matching
GET  /api/businesses/:id       // Get specific business
GET  /api/health              // Health check
```

#### Authentication Endpoints (Optional)
```javascript
POST /api/register            // Create user account
POST /api/login              // User login
GET  /api/user/profile        // Get user profile (requires auth)
```

#### Search Parameters
```javascript
{
  q: 'search query',          // Semantic search query
  lat: 33.4484,              // User latitude
  lon: -112.0740,            // User longitude  
  category: 'restaurant',     // Filter by category
  lfa_member_only: 'true',   // LFA members only
  limit: 50                  // Result limit
}
```

## Architecture Decisions

### Web-First Approach
- **Target Platform:** Web browsers (not native mobile apps)
- **Voice Recognition:** Web Speech API instead of native
- **Maps:** Google Maps embedded in web interface
- **Authentication:** Optional (public access by default)

### No Firebase Dependencies
- **Database:** SQLite only (no Firestore)
- **Authentication:** Custom JWT implementation
- **Hosting:** Static web hosting + API server hosting
- **Storage:** Local/database storage only

### Semantic Search Implementation
```javascript
const SEMANTIC_CATEGORIES = {
  'grocery': {
    keywords: ['grocery', 'market', 'supermarket', 'food market'],
    namePatterns: ['market', 'grocery', 'super', 'fresh', 'food']
  },
  'restaurant': {
    keywords: ['restaurant', 'cafe', 'bar', 'grill', 'diner'],
    namePatterns: ['restaurant', 'cafe', 'bar', 'grill', 'kitchen']
  }
  // ... additional categories
};
```

## Development Environment Setup

### Required Tools
- Node.js (v18+)
- Chrome browser (for voice features)
- Expo CLI
- SQLite CLI tools

### Development Servers

1. **API Server (Terminal 1)**
   ```bash
   cd mobile-app
   DATABASE_URL="file:../../local.db" node api-server.js
   ```

2. **Expo Web Server (Terminal 2)**
   ```bash
   cd mobile-app
   EXPO_TOKEN=<token> npx expo start --web --port 8082
   ```

3. **Testing with Voice (Chrome)**
   ```bash
   open -a "Google Chrome" --args --disable-web-security --unsafely-treat-insecure-origin-as-secure=http://localhost:8082 http://localhost:8082
   ```

## Coding Standards

### JavaScript Guidelines
- **ES6+ features** - use modern JavaScript
- **Functional components** - React hooks only
- **No TypeScript requirement** - JavaScript is sufficient
- **Clear naming** - descriptive variable and function names

### React Native Best Practices
- **Functional components** with hooks
- **Platform-specific handling** for web vs mobile
- **Responsive design** for mobile browsers
- **Accessibility** features where applicable

### State Management
- **React Context** for global state (authentication)
- **Local state** for component-specific data
- **No complex state management** - keep it simple

### Code Organization
- **Feature-based organization** - components grouped by functionality
- **Single responsibility** - each file has one clear purpose
- **Clear imports** - organized and readable import statements

### Error Handling
- **User-friendly error messages**
- **Console logging** for debugging
- **Graceful fallbacks** for failed API calls
- **Network error handling** for offline scenarios

## Testing Strategy

### Manual Testing Priority
- **Voice search** in Chrome with security flags disabled
- **Location detection** and manual fallback
- **Business search** with semantic matching
- **Google Maps integration** and markers
- **Responsive design** on mobile browsers

### Browser Compatibility Testing
- **Chrome (primary):** Full feature support including voice
- **Safari:** Basic functionality, limited voice support
- **Firefox:** Basic functionality, limited voice support
- **Mobile browsers:** Responsive layout and basic features

### Automated Testing (Playwright)
- **Search functionality** - text and voice input
- **Map interaction** - zoom, pan, marker clicks
- **User flows** - registration, login, search
- **Error scenarios** - network failures, invalid inputs

## Performance Guidelines

### Web Application Optimization
- **Bundle size monitoring** - keep initial load small
- **Image optimization** - compressed images, lazy loading
- **Map performance** - efficient marker rendering
- **Voice API optimization** - minimize processing overhead

### API Server Optimization  
- **Database query optimization** - indexed searches
- **Response caching** - cache business data appropriately
- **Semantic search efficiency** - optimized pattern matching
- **Rate limiting** - prevent abuse

## Security Requirements

### Authentication & Authorization (Optional)
- **JWT tokens** for session management
- **Password hashing** with bcrypt
- **Secure token storage** in browser
- **Optional registration** - no forced sign-up

### Data Protection
- **Input validation** on all user inputs
- **SQL injection prevention** - parameterized queries
- **CORS configuration** - proper cross-origin setup
- **HTTPS requirement** for production (voice API)

## Deployment Strategy

### Development Deployment
- **Local SQLite database** - direct file access
- **Expo development server** - hot reloading
- **Local API server** - Express.js with nodemon

### Production Deployment

#### Database: Turso.tech
- **SQLite compatibility** - no schema changes needed
- **Edge replication** - global performance
- **Easy migration** from local SQLite file

#### Frontend: Vercel/Netlify
- **Static hosting** using `expo export:web`
- **Custom domain** support
- **Automatic deployments** from GitHub

#### API Server: Vercel/Railway/Heroku
- **Serverless deployment** (Vercel) or traditional hosting
- **Environment variables** for production config
- **CORS configuration** for production domains

### Environment Configuration

#### Development (.env.development)
```env
DATABASE_URL=file:../../local.db
JWT_SECRET=development-secret-key
PORT=3001
NODE_ENV=development
```

#### Production (.env.production)  
```env
DATABASE_URL=libsql://your-database.turso.tech?authToken=your-token
JWT_SECRET=secure-production-secret-min-32-chars
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
```

## Multi-Agent Development Approach

### Agent Tool Access

#### UI/UX Designer
- **Primary Role:** Design system, user experience, wireframes
- **Tool Access:** Frame0 MCP, Context7 MCP (design docs)

#### Frontend Engineer  
- **Primary Role:** React Native web implementation, UI components
- **Tool Access:** Expo CLI, GitHub MCP, Context7 MCP (React Native docs)

#### Backend Database Engineer
- **Primary Role:** API development, database design, SQLite management
- **Tool Access:** Direct SQLite CLI access, GitHub MCP, Context7 MCP (Express docs)

#### QA Testing Engineer
- **Primary Role:** Browser testing, automated tests, quality assurance
- **Tool Access:** Playwright MCP, Expo CLI, GitHub MCP

#### Product Manager
- **Primary Role:** Requirements, prioritization, feature planning
- **Tool Access:** Linear MCP, Frame0 MCP (wireframes)

#### CTO (Chief Technology Officer)
- **Primary Role:** Architecture decisions, technical oversight
- **Tool Access:** All MCP tools + full system access

### Communication Protocol
- **Linear MCP** for task management and issue tracking
- **GitHub MCP** for code management and deployments
- **Direct CLI access** for database and build operations
- **Autonomous coordination** between agents

## Key Differences from Original Plan

### Simplified Architecture
- **No Firebase** - eliminated complex authentication and database
- **No TypeScript** - JavaScript for faster development
- **Web-first** - not targeting native mobile apps
- **SQLite only** - single database solution

### Technology Changes
- **Voice API:** Web Speech API instead of OpenAI Whisper
- **Database:** SQLite instead of Firebase Firestore  
- **Authentication:** JWT instead of Firebase Auth
- **Deployment:** Static hosting instead of complex mobile deployment

### Feature Focus
- **Public access** - no login required for basic features
- **Semantic search** - intelligent business discovery
- **LFA member priority** - support local member businesses
- **Optional personalization** - accounts for enhanced features only

## Success Metrics

### Primary Goals
- **User engagement** - time spent searching and discovering businesses
- **Voice usage** - percentage of searches using voice input
- **LFA member discovery** - clicks on member businesses vs non-members
- **Location accuracy** - successful location detection rate

### Technical Metrics
- **Page load speed** - under 3 seconds initial load
- **Search response time** - under 500ms for semantic search
- **Voice recognition accuracy** - successful transcription rate
- **Mobile responsiveness** - usable on all screen sizes

This updated guide reflects our current simplified, web-first architecture focused on rapid deployment and effective business discovery for Local First Arizona.