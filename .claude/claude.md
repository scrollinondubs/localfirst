# Local First Arizona - Monorepo Development Guidelines

## Philosophy

### Core Beliefs

- **User experience over technical perfection** - Focus on delivering value to the users and local businesses above all else
- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Mobile-first and native integration** - Optimize for touch interfaces and seamless Google Maps experience
- **Pragmatic over dogmatic** - Adapt to platform constraints and Cloudflare limitations
- **Clear intent over clever code** - Prioritize maintainability for LFA team handoff

### Universal Simplicity Principles

- **Binary toggles over complex filtering**: LFA mode vs Google mode is simpler than chain detection
- **Single responsibility per function/module** across all packages
- **Unified data sources**: Shared caching prevents timing issues between extension and mobile
- **Mimic existing patterns**: Copy platform conventions rather than creating custom elements
- **No clever tricks** - choose robust, testable solutions across all applications

## Process

### 1. Planning & Staging

Break complex work into 3-5 stages focused on user-facing value. Document in `IMPLEMENTATION_PLAN.md`:

```markdown
## Stage N: [Name]
**Goal**: [Specific user-visible deliverable]
**Success Criteria**: [Testable outcomes - extension on Google Maps, mobile app functionality]
**Performance Targets**: [Specific metrics - load time, memory usage, battery impact]
**Platform Testing**: [Chrome versions, iOS/Android versions, screen sizes to test]
**Status**: [Not Started|In Progress|Complete]
```
- Update status as you progress
- Include performance measurements for both web and mobile
- Remove file when all stages are done

### 2. Implementation Flow

1. **Understand** - Study existing patterns and platform-specific requirements
2. **Test** - Write test first targeting specific user flows (red)
3. **Implement** - Minimal code to pass, optimized for performance (green)
4. **Performance Check** - Measure impact on both platforms
5. **Refactor** - Clean up with tests passing and performance maintained
6. **Commit** - With clear message linking to plan and performance impact

### 3. When Stuck (After 3 Attempts)

**CRITICAL**: Maximum 3 attempts per issue, then STOP and reassess.

1. **Document what failed**:
   - Specific scenarios tested (Google Maps DOM changes, React Native behavior)
   - Console errors and warnings (browser console, Metro bundler, device logs)
   - Performance impact measurements
   - Why current approach isn't working

2. **Research alternatives**:
   - Study 2-3 similar applications (Chrome extensions, React Native apps)
   - Review platform best practices docs (Chrome Extension, React Native, Expo)
   - Check shared API patterns (Hono.js, Cloudflare Workers)

3. **Question fundamentals**:
   - **Can this be simplified?** (Complex filtering → binary toggle, complex state → simpler data flow)
   - **Should we mimic instead of invent?** (Custom UI → platform HTML structure)
   - **Should we use native or cross-platform?** (Platform-specific vs shared code)
   - Is this the right level of DOM manipulation / navigation pattern?
   - Can this be split into smaller, reusable components?
   - Is there a more performance-friendly approach?
   - Should this be handled client-side or server-side?

4. **Try different angle**:
   - **Unified data approach?** (Shared caching vs separate API calls)
   - **Strategic observer management?** (Disable when conflicting)
   - **State management approach?** (React Query vs local state)
   - **Navigation strategy?** (Stack vs tab navigation)
   - Different data fetching pattern?
   - Different map rendering approach?
   - Simplified component architecture?
   - Alternative caching strategy?

## Technical Standards

### Architecture Principles

- **Performance first** - Applications must be responsive and battery-efficient
- **Graceful degradation** - Work offline and handle API failures
- **Stateless design** - Leverage Cloudflare Workers architecture
- **Test-driven when possible** - Especially for business logic and user flows

### Universal Standards

- **Every feature must**:
  - Work across target platforms (Chrome browsers, iOS, Android)
  - Handle different screen sizes and user contexts
  - Include performance impact measurements
  - Respect user privacy (minimal data collection)

- **Before committing any code**:
  - Test on target platforms and devices
  - Verify no console errors or warnings
  - Measure memory usage and performance impact
  - Test with slow network conditions

### Shared API Development Standards

- **Cloudflare Workers constraints**:
  - 128MB memory limit awareness
  - CPU time limit considerations
  - No filesystem access patterns
  - Edge caching strategy implementation

- **Database operations**:
  - Use Drizzle ORM for all database operations
  - Optimize for read-heavy workloads
  - Implement proper indexing for geospatial queries
  - Handle connection limits gracefully

### Error Handling

- **Application errors**: Log to console and crash reporting service
- **API errors**: Graceful fallback to cached data
- **Database errors**: Return appropriate HTTP status codes
- **Network errors**: Retry logic with exponential backoff

## Decision Framework

When multiple valid approaches exist, choose based on:

1. **Performance** - What has the least impact on user experience and system performance?
2. **Reliability** - What handles platform changes and edge cases most robustly?
3. **Testability** - Can I easily mock and test this?
4. **Maintainability** - Will LFA team understand this in 6 months?
5. **Scalability** - How will this perform with 10,000+ users?

## Project Integration

### Learning the Codebase

**Universal Patterns:**
- Study existing component structures and API patterns
- Understand shared database schema and business logic
- Test across different platforms and contexts
- Document behavior patterns for future reference

**Shared API Patterns:**
- Follow Hono.js routing conventions
- Use existing Drizzle schema patterns
- Implement consistent error response formats
- Follow Cloudflare Workers best practices

### Tooling

- **Build System**: Vite for extension, Expo CLI for mobile, Wrangler for API
- **Testing**: Jest for unit tests, Playwright for extension E2E, Detox for mobile E2E
- **Database**: Drizzle Studio for schema management, SQLite at root level
- **Deployment**: Chrome Web Store, EAS for mobile, Wrangler for API

## Quality Gates

### Definition of Done

- [ ] Tests written and passing (unit + integration)
- [ ] Performance impact measured and acceptable
- [ ] Works across target platforms and versions
- [ ] Handles edge cases and failures gracefully
- [ ] API endpoints properly documented
- [ ] No console errors or warnings
- [ ] Commit messages link to implementation plan
- [ ] Code follows project conventions

### Universal Quality Gates

- [ ] Applications load and run on target platforms
- [ ] Business discovery and filtering works consistently
- [ ] LFA member highlighting is visually clear across platforms
- [ ] User preferences persist across sessions
- [ ] Applications work offline with cached data
- [ ] Memory usage stays within platform limits
- [ ] Shared API endpoints work for both applications

### API Quality Gates

- [ ] All endpoints return proper HTTP status codes
- [ ] Input validation properly implemented with Zod schemas
- [ ] Rate limiting implemented and tested
- [ ] Geospatial queries perform under 100ms
- [ ] Proper CORS headers for cross-platform communication
- [ ] Error responses include helpful messages
- [ ] Database operations use prepared statements

## Performance Requirements

### Universal Performance

- **API Response Time**: <200ms for business queries within 5-mile radius
- **Database Queries**: <50ms for indexed geospatial queries
- **Shared Caching**: 90%+ cache hit rate for business data
- **API Throughput**: Handle 100+ concurrent requests

## Testing Strategy

### Shared API Testing Patterns
```typescript
// Test with shared SQLite database
const testDb = drizzle(new Database(':memory:'));

describe('Business API', () => {
  beforeEach(async () => {
    await testDb.run('DELETE FROM businesses');
    await seedTestData(testDb);
  });
  
  test('returns businesses within radius', async () => {
    const response = await app.request('/api/businesses/semantic-search?lat=33.4484&lng=-112.0740&radius=5');
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.businesses).toHaveLength(3);
    expect(data.businesses[0].distance_miles).toBeLessThan(5);
  });
});
```

## Important Reminders

### Universal Development

**NEVER**:
- Store API keys or secrets in application code (use environment variables)
- Block or significantly delay platform functionality
- Assume network connectivity is always available
- Skip input validation on user-provided data

**ALWAYS**:
- Use shared database and API endpoints for consistency
- Implement proper loading states for async operations
- Clean up event listeners and subscriptions
- Handle application state changes gracefully
- Test with poor network conditions and offline mode

---

# CHROME EXTENSION SPECIFIC (packages/extension/)

## Extension-Specific Architecture

### Technical Requirements
- **Manifest V3 Compliance**: Use service workers, not background pages
- **Content Script Strategy**: Mutation observers for Google Maps DOM changes
- **Performance First**: Extension modifications must render in <100ms
- **Message Passing**: Use chrome.runtime.sendMessage for background communication
- **Storage Strategy**: Use chrome.storage.sync for user preferences, chrome.storage.local for cached data
- **Permission Management**: Request minimal permissions (activeTab, storage, host_permissions for maps.google.com)

### Business Logic Implementation
- **Binary Toggle System**: Simple LFA/Google mode switching instead of complex chain filtering
- **Semantic Search Integration**: Real-time LFA member discovery with relevance scoring
- **Unified Data Caching**: Use `window.LFA_cachedBusinesses` to share data between map pins and sidebar
- **Bidirectional UI Interactions**: Hover effects linking sidebar listings to map pins and vice versa
- **Geolocation**: Efficient radius-based business matching with shared API endpoints
- **Analytics Tracking**: Anonymous usage events for optimization

### Key Extension Patterns
- **Mimic Don't Invent**: Copy Google's exact HTML structure and CSS classes rather than creating custom UI
- **Strategic Observer Management**: Disable mutation observers when LFA mode is active to prevent conflicts
- **Complete Replacement**: Full sidebar content replacement works better than selective filtering

### Extension Performance Requirements
- **Initial Load**: <50ms impact on Google Maps load time
- **Business Processing**: <100ms to identify and modify business listings
- **Memory Usage**: <50MB total extension memory footprint
- **Network**: <1MB total daily data usage per active user

### Extension Testing Patterns
```javascript
// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock Google Maps DOM
const createMockBusinessElement = (name, type = 'restaurant') => {
  const element = document.createElement('div');
  element.setAttribute('data-value', name);
  element.className = 'hfpxzc'; // Real Google Maps class
  return element;
};
```

### Extension Development Reminders

**NEVER**:
- Inject external scripts or libraries into Google Maps
- Use `eval()` or `innerHTML` with untrusted content (CSP violations)
- **Assume custom UI elements will integrate well** - mimic Google's structure instead
- **Create separate data flows** - use unified caching to prevent timing issues

**ALWAYS**:
- **Target `role="feed"` containers** for business listing injection
- **Use Google's exact CSS classes** (e.g., `Nv2PK THOPZb CpccDe`) for native appearance
- **Implement `data-*` attributes** for reliable cross-component communication
- **Disable mutation observers when replacing content** to prevent conflicts
- **Use WeakMap for element tracking** to enable clean restoration

**Critical Debugging Patterns:**
- **Log business IDs** from both pins and sidebar when hover effects fail
- **Check element dimensions** when content appears to inject but isn't visible
- **Verify event listener attachment timing** - ensure elements exist when listeners added
- **Monitor for DOM redraws** that destroy/recreate elements and break references

---

# MOBILE APP SPECIFIC (packages/mobile/)

## Mobile-Specific Architecture

### Technical Requirements
- **Framework**: React Native with Expo and TypeScript
- **Navigation**: React Navigation v6 for type-safe navigation
- **State Management**: React Query for server state, Zustand for client state
- **Maps Integration**: react-native-maps with Google Maps
- **Push Notifications**: Expo Notifications
- **Authentication**: Firebase Auth with Expo integration (if needed)

### Business Logic Implementation
- **Business Discovery**: Use shared API semantic search endpoints
- **Map View**: Interactive maps with business markers and clustering
- **Business Claiming**: Verification via location or email for business owners (future)
- **Personalization**: AI-driven recommendations based on user preferences (future)
- **Notifications**: Location-based alerts and promotions (future)
- **Offline Support**: Cached business data for offline browsing

### Platform-Specific Considerations
- **iOS**: Human Interface Guidelines compliance, App Store requirements
- **Android**: Material Design principles, Play Store requirements
- **Cross-Platform**: Shared business logic with platform-specific UI
- **Native Modules**: Custom native code for platform-specific features

### Mobile Performance Requirements
- **App Launch**: <2s cold start on average devices
- **Screen Navigation**: <200ms transition between screens
- **Memory Usage**: <100MB total app memory footprint
- **Battery Impact**: <5% battery drain per hour of active use
- **Network**: <10MB total daily data usage per active user

### Mobile Testing Patterns
```javascript
// Mock React Native modules
jest.mock('react-native-maps', () => ({
  MapView: 'MapView',
  Marker: 'Marker',
  Callout: 'Callout',
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Firebase
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
}));

// Mock business data
const createMockBusiness = (name, category = 'restaurant') => ({
  id: 'test-id',
  name,
  category,
  location: { latitude: 33.4484, longitude: -112.0740 },
  localFirstMember: true,
});
```

### Mobile Development Reminders

**NEVER**:
- Use Node.js-specific modules in React Native code
- Ignore platform differences between iOS and Android
- Block the main thread with heavy computations
- Assume network connectivity is always available
- Use synchronous storage operations

**ALWAYS**:
- **Use Platform.select()** for platform-specific code
- **Test on real devices** in addition to simulators
- **Handle keyboard events properly** on both platforms
- **Implement proper loading states** for async operations
- **Use FlatList/SectionList** for long scrollable lists
- **Optimize images** with proper sizing and caching

**Critical Mobile Patterns:**
- **Monitor re-renders** with React DevTools Profiler
- **Check memory leaks** in navigation and state updates
- **Verify deep linking** works on both platforms
- **Test push notifications** on physical devices

---

# SHARED API USAGE PATTERN

Both applications use the same API endpoints:

## Primary Search Endpoint
```typescript
// Both extension and mobile app use this endpoint
GET /api/businesses/semantic-search
Parameters:
- query: string (search term)
- lat: number (latitude)
- lng: number (longitude) 
- radius: number (search radius in miles)
- limit: number (max results)

Response:
{
  businesses: Business[],
  total: number,
  center: { lat: number, lng: number },
  radius: number,
  query: string
}
```

## API Client Pattern (Both Apps)
```typescript
// Shared API communication pattern
class LFAApiClient {
  private baseUrl: string;
  private cache = new Map<string, CacheEntry>();
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async getBusinesses(params: BusinessQuery): Promise<Business[]> {
    // Implement caching, error handling, fallback logic
    // Used by both extension and mobile app
  }
  
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    // Fire-and-forget analytics for both platforms
  }
}
```

## Deployment Checklist

### Pre-deployment Testing
- [ ] Extension tested in incognito mode
- [ ] Mobile app tested on iOS and Android devices
- [ ] API tested with production-like data volume
- [ ] Performance impact measured on low-end devices
- [ ] Error scenarios tested (network failures, API downtime)
- [ ] Cross-platform compatibility verified

### Production Readiness
- [ ] Environment variables properly configured
- [ ] Database migrations applied successfully
- [ ] Monitoring and alerting configured
- [ ] Rollback plan documented and tested
- [ ] App store listings and Chrome Web Store prepared

### Post-deployment Monitoring
- [ ] Extension install/activation rates
- [ ] Mobile app install and retention rates
- [ ] API response times and error rates
- [ ] User engagement with business discovery features
- [ ] Performance impact measurements

## Knowledge Transfer Requirements

Since this will be handed off to LFA team:

### Documentation Deliverables
- [ ] Complete API documentation with examples
- [ ] Extension and mobile app architecture diagrams and code walkthroughs
- [ ] Database schema documentation with sample queries
- [ ] Deployment and maintenance runbooks
- [ ] Troubleshooting guide for common issues

### Code Quality for Handoff
- [ ] Comprehensive inline comments explaining business logic
- [ ] Clear variable and function names
- [ ] Modular architecture with single-responsibility components
- [ ] Extensive test coverage with clear test descriptions
- [ ] Performance optimization notes and measurement tools

## Tech Stack Summary

### Chrome Extension
- **Manifest Version**: V3 with service workers
- **Content Scripts**: Google Maps DOM manipulation
- **Storage**: Chrome Storage API
- **Build System**: Vite
- **Testing**: Jest + Playwright

### Mobile App
- **Framework**: React Native with Expo
- **State Management**: React Query + Zustand
- **Maps**: react-native-maps (Google Maps)
- **Navigation**: React Navigation v6
- **Push Notifications**: Expo Notifications
- **Authentication**: Firebase Auth

### Shared Backend API
- **Platform**: Cloudflare Workers
- **Framework**: Hono.js
- **Database**: SQLite with Drizzle ORM at root level
- **External APIs**: Google Maps API, Google Places API
- **Deployment**: Wrangler

### Development & Deployment
- **Project Management**: Linear (MCP integrated)
- **Version Control**: GitHub
- **CI/CD**: GitHub Actions + Expo EAS
- **Testing**: Jest + Playwright + Detox
- **Extension Deployment**: Chrome Web Store
- **Mobile Deployment**: EAS Build & Submit
- **API Deployment**: Cloudflare Wrangler

Remember: Both the Chrome extension and mobile app are part of the same ecosystem, sharing the same database, API, and business goals. The technical architecture should make it effortless for users to find and support Local First Arizona member businesses regardless of which platform they're using.