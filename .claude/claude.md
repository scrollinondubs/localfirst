# Local First Arizona Extension - Development Guidelines

## Philosophy

### Core Beliefs

- **User experience over technical perfection** - Extension must feel native to Google Maps
- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study Google Maps patterns and API responses
- **Pragmatic over dogmatic** - Adapt to browser constraints and Cloudflare limitations
- **Clear intent over clever code** - Prioritize maintainability for LFA team handoff

### Simplicity Means

- **Binary toggles over complex filtering**: LFA mode vs Google mode is simpler than chain detection
- Single responsibility per function/module
- **Mimic existing UI patterns**: Copy Google's HTML structure exactly rather than custom elements
- **Unified data sources**: Shared caching prevents timing issues (use `window.LFA_cachedBusinesses`)
- No clever DOM manipulation tricks - choose robust, testable solutions
- If Google Maps breaks the extension, it should fail gracefully

## Process

### 1. Planning & Staging

Break complex work into 3-5 stages focused on user-facing value. Document in `IMPLEMENTATION_PLAN.md`:

```markdown
## Stage N: [Name]
**Goal**: [Specific user-visible deliverable]
**Success Criteria**: [Testable outcomes on Google Maps]
**Performance Targets**: [Specific metrics - load time, memory usage]
**Browser Testing**: [Chrome versions, Maps scenarios to test]
**Status**: [Not Started|In Progress|Complete]
```
- Update status as you progress
- Include performance measurements
- Remove file when all stages are done

### 2. Implementation Flow

1. **Understand** - Study existing Maps DOM structure and business listing patterns
2. **Test** - Write test first targeting specific Maps scenarios (red)
3. **Implement** - Minimal code to pass, optimized for performance (green)
4. **Performance Check** - Measure impact on Maps loading and interaction
5. **Refactor** - Clean up with tests passing and performance maintained
6. **Commit** - With clear message linking to plan and performance impact

### 3. When Stuck (After 3 Attempts)

**CRITICAL**: Maximum 3 attempts per issue, then STOP and reassess.

1. **Document what failed**:
   - Specific Google Maps scenarios tested
   - Browser console errors and warnings
   - Performance impact measurements
   - Why current approach isn't working

2. **Research alternatives**:
   - Study 2-3 similar Chrome extensions
   - Review Chrome extension best practices docs
   - Check Cloudflare Workers/Hono.js patterns

3. **Question fundamentals**:
   - **Can this be simplified?** (Complex filtering → binary toggle)
   - **Should we mimic instead of invent?** (Custom UI → Google's HTML structure)
   - Is this the right level of DOM manipulation?
   - Can this be split into smaller, testable pieces?
   - Is there a more performance-friendly approach?
   - Should this be handled client-side or server-side?

4. **Try different angle**:
   - **Unified data approach?** (Shared caching vs separate API calls)
   - **Strategic observer management?** (Disable when conflicting)
   - Different DOM observation strategy?
   - Different business matching algorithm?
   - Simplified user interface approach?
   - Alternative data caching strategy?

**Key Debugging Questions from MVP:**
- Are business IDs consistent between pins and sidebar?
- Is mutation observer conflicting with our modifications?
- Are elements being recreated/redrawn by Google Maps?
- Is timing causing cache misses between components?

## Technical Standards

### Architecture Principles

- **Performance first** - Extension impact must be unnoticeable to users
- **Graceful degradation** - Work offline and handle API failures
- **Stateless design** - Leverage Cloudflare Workers architecture
- **Test-driven when possible** - Especially for business logic and DOM manipulation

### Chrome Extension Standards

- **Every feature must**:
  - Work with Manifest V3 restrictions
  - Handle Google Maps DOM changes gracefully
  - Include performance impact measurements
  - Respect user privacy (minimal data collection)

- **Before committing extension code**:
  - Test on different Google Maps views (list, map, satellite)
  - Verify no console errors or warnings
  - Measure memory usage and load time impact
  - Test with slow network conditions

### API Development Standards

- **Cloudflare Workers constraints**:
  - 128MB memory limit awareness
  - CPU time limit considerations
  - No filesystem access patterns
  - Edge caching strategy implementation

- **Database operations**:
  - Use Drizzle ORM prepared statements
  - Optimize for read-heavy workloads
  - Implement proper indexing for geospatial queries
  - Handle Turso connection limits gracefully

### Error Handling

- **Extension errors**: Log to console, don't break Google Maps
- **API errors**: Graceful fallback to cached data
- **Database errors**: Return appropriate HTTP status codes
- **Network errors**: Retry logic with exponential backoff

## Decision Framework

When multiple valid approaches exist, choose based on:

1. **Performance** - What has the least impact on Maps performance?
2. **Reliability** - What handles Google Maps changes most robustly?
3. **Testability** - Can I easily mock and test this?
4. **Maintainability** - Will LFA team understand this in 6 months?
5. **Scalability** - How will this perform with 1000+ concurrent users?

## Project Integration

### Learning the Codebase

**Google Maps Integration:**
- Study existing business listing DOM structures
- Identify stable CSS selectors and data attributes
- Test across different Maps interfaces (mobile web, desktop)
- Document Maps behavior patterns for future reference

**API Patterns:**
- Follow Hono.js routing conventions
- Use existing Drizzle schema patterns
- Implement consistent error response formats
- Follow Cloudflare Workers best practices

### Tooling

- **Build System**: Use Vite for extension bundling
- **Testing**: Jest for unit tests, Playwright for E2E extension testing
- **Database**: Drizzle Studio for schema management
- **Deployment**: Wrangler for Cloudflare Workers, standard npm scripts

## Quality Gates

### Definition of Done

- [ ] Tests written and passing (unit + integration)
- [ ] Performance impact measured and acceptable (<100ms load impact)
- [ ] Works across Chrome versions (last 3 major releases)
- [ ] Handles Google Maps DOM changes gracefully
- [ ] API endpoints properly documented
- [ ] No console errors or warnings
- [ ] Commit messages link to implementation plan
- [ ] Code follows project conventions

### Extension-Specific Quality Gates

- [ ] Extension loads and activates on maps.google.com
- [ ] Business filtering works in list and map views
- [ ] LFA member highlighting is visually clear
- [ ] User preferences persist across browser sessions
- [ ] Analytics events track properly (when enabled)
- [ ] Extension works offline with cached data
- [ ] Memory usage stays under 50MB during normal usage

### API Quality Gates

- [ ] All endpoints return proper HTTP status codes
- [ ] Input validation with Zod schemas
- [ ] Rate limiting implemented and tested
- [ ] Geospatial queries perform under 100ms
- [ ] Proper CORS headers for extension communication
- [ ] Error responses include helpful messages
- [ ] Database migrations are reversible

## Performance Requirements

### Extension Performance
- **Initial Load**: <50ms impact on Google Maps load time
- **Business Processing**: <100ms to identify and modify business listings
- **Memory Usage**: <50MB total extension memory footprint
- **Network**: <1MB total daily data usage per active user

### API Performance
- **Response Time**: <200ms for business queries within 5-mile radius
- **Throughput**: Handle 100+ concurrent requests (Cloudflare free tier)
- **Database**: <50ms for indexed geospatial queries
- **Caching**: 90%+ cache hit rate for business data

## Testing Strategy

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

### API Testing Patterns
```typescript
// Test with real Turso database
const testDb = drizzle(new Database(':memory:'));

describe('Business API', () => {
  beforeEach(async () => {
    await testDb.run('DELETE FROM businesses');
    await seedTestData(testDb);
  });
  
  test('returns businesses within radius', async () => {
    const response = await app.request('/api/businesses?lat=33.4484&lng=-112.0740&radius=5');
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.businesses).toHaveLength(3);
    expect(data.businesses[0].distance_miles).toBeLessThan(5);
  });
});
```

## Important Reminders

### Chrome Extension Development

**NEVER**:
- Inject external scripts or libraries into Google Maps
- Use `eval()` or `innerHTML` with untrusted content (CSP violations)
- Store API keys or secrets in extension code
- Block or significantly delay Google Maps functionality
- **Assume custom UI elements will integrate well** - mimic Google's structure instead
- **Create separate data flows** - use unified caching to prevent timing issues

**ALWAYS**:
- **Target `role="feed"` containers** for business listing injection
- **Use Google's exact CSS classes** (e.g., `Nv2PK THOPZb CpccDe`) for native appearance
- **Implement `data-*` attributes** for reliable cross-component communication
- **Disable mutation observers when replacing content** to prevent conflicts
- **Use WeakMap for element tracking** to enable clean restoration
- Use Shadow DOM for isolated styling when possible
- Clean up DOM observers and event listeners
- Handle extension disable/uninstall gracefully
- Test with network throttling and offline scenarios

**Critical Debugging Patterns:**
- **Log business IDs** from both pins and sidebar when hover effects fail
- **Check element dimensions** when content appears to inject but isn't visible
- **Verify event listener attachment timing** - ensure elements exist when listeners added
- **Monitor for DOM redraws** that destroy/recreate elements and break references

### API Development

**NEVER**:
- Use Node.js-specific APIs (not available in Workers)
- Store state in global variables (stateless architecture)
- Return sensitive data in public endpoints
- Skip input validation on user-provided data

**ALWAYS**:
- Use prepared statements for database queries
- Implement proper error handling and logging
- Respect Cloudflare Workers execution time limits
- Cache frequently accessed data appropriately

## Deployment Checklist

### Pre-deployment Testing
- [ ] Extension tested in incognito mode
- [ ] API tested with production-like data volume
- [ ] Performance impact measured on slow devices
- [ ] Error scenarios tested (network failures, API downtime)
- [ ] Cross-browser compatibility verified (Chrome versions)

### Production Readiness
- [ ] Environment variables properly configured
- [ ] Database migrations applied successfully
- [ ] Monitoring and alerting configured
- [ ] Rollback plan documented and tested
- [ ] User documentation updated

### Post-deployment Monitoring
- [ ] Extension install/activation rates
- [ ] API response times and error rates
- [ ] User engagement with local business features
- [ ] Performance impact on Google Maps usage

## Knowledge Transfer Requirements

Since this will be handed off to LFA team:

### Documentation Deliverables
- [ ] Complete API documentation with examples
- [ ] Extension architecture diagram and code walkthrough
- [ ] Database schema documentation with sample queries
- [ ] Deployment and maintenance runbooks
- [ ] Troubleshooting guide for common issues

### Code Quality for Handoff
- [ ] Comprehensive inline comments explaining business logic
- [ ] Clear variable and function names
- [ ] Modular architecture with single-responsibility components
- [ ] Extensive test coverage with clear test descriptions
- [ ] Performance optimization notes and measurement tools