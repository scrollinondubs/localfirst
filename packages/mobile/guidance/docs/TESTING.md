# Testing Guide for Local First Arizona Mobile App

## Current Architecture Overview

- **Frontend**: React Native/Expo mobile app deployed to Cloudflare Pages
- **Backend**: Hono API on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Production URLs**:
  - API: `https://localfirst-api-production.localfirst.workers.dev`
  - Mobile App: Latest deployment on `*.localfirst-mobile.pages.dev`

## Testing Environments

### Local Development
- **Web**: `npm run web:dev` → `http://localhost:3000`
- **API**: `npm run dev` → `http://localhost:8787` (with local SQLite)
- **Mobile**: Expo CLI for iOS/Android simulators

### Production
- **Web**: Latest Cloudflare Pages deployment
- **API**: Cloudflare Workers (production environment)
- **Database**: Cloudflare D1 production instance

## 🚀 Quick Testing Commands

### Web Testing (Playwright)
```bash
# Full autonomous test suite
npm run test:autonomous

# Quick health check
npm run test:dashboard

# Debug with browser visible
npm run debug:autonomous

# Specific test categories
npx playwright test --grep "Performance"
npx playwright test --grep "Voice search"
npx playwright test --grep "Location"
```

### iOS Testing
```bash
# Build and install iOS app
npm run build:ios

# Install latest build
npm run install:ios

# Run iOS tests
npm run test:ios
```

### API Testing
```bash
# Test API endpoints directly
curl https://localfirst-api-production.localfirst.workers.dev/api/businesses/semantic-search?query=coffee&limit=5

# Monitor API logs
cd packages/api
wrangler tail localfirst-api-production --format pretty
```

## 🔍 Debugging Production Issues

### CORS Troubleshooting
When production deployments fail with "Failed to fetch":

1. **Check deployment URL**: Each Cloudflare Pages deploy gets a new subdomain
2. **Update CORS configuration**: Add new domain to API CORS allowlist
3. **Test isolation**: Run local dev against production API to isolate the issue

**Diagnostic Strategy** (from session retrospective):
```javascript
// Test local dev with production API
// Edit packages/mobile/config/api.js temporarily:
const baseUrl = 'https://localfirst-api-production.localfirst.workers.dev'; // Force production API
```

If local dev works with production API, the issue is deployment-specific (likely CORS).

### Debug Components
The app includes a `DebugInfo` component for production diagnostics:

- Shows runtime API configuration
- Tests direct fetch capabilities  
- Displays environment variables
- Provides connectivity diagnostics

Access via DEBUG button (top-right corner in production).

### API CORS Configuration
Located in `packages/api/src/index.js`:

```javascript
cors({
  origin: [
    'http://localhost:3000',  // Local dev
    'chrome-extension://*',   // Chrome extension
    /^https:\/\/.*\.pages\.dev$/, // All Cloudflare Pages
    'https://[current-deployment].localfirst-mobile.pages.dev', // Specific deployment
  ],
  credentials: true,
})
```

**Important**: Update CORS origins when deployment URLs change.

## 📱 Platform-Specific Testing

### Web Browser Testing
- **Playwright**: Automated testing across Chromium, Firefox, Safari
- **Manual testing**: All browsers, different screen sizes
- **Voice search**: Web Speech API (limited browser support)
- **Location**: Requires HTTPS in production

### iOS Testing
- **Native app**: Full iOS API access via Expo/EAS builds
- **Voice recognition**: `@react-native-voice/voice` for native speech-to-text
- **Location services**: `expo-location` for GPS access
- **Testing approach**: EAS builds → iOS Simulator → Manual testing

**iOS Build Process**:
1. `npx eas build --platform ios --profile simulator`
2. Download .tar.gz artifact
3. Install in iOS Simulator
4. Test voice and location features manually

### Android Testing
- Similar to iOS but with `--platform android`
- Google Play Console for distribution
- Android-specific voice and location APIs

## 🎯 Core Feature Testing

### Search Functionality
- **Text search**: Standard form input → API call → results display
- **Voice search**: Platform-specific voice recognition → text conversion → search
- **Location-based**: GPS coordinates → radius-based business queries
- **Results display**: Business cards with ratings, distance, contact info

### Authentication Flow
- Login/register forms
- JWT token management
- Persistent session handling
- Security validation

### Map Integration
- `WebMapView` component for web compatibility
- Business location markers
- User location detection
- Interactive map controls

## 🤖 Automated Testing Infrastructure

### Playwright Web Tests
Located in `tests/` directory:

- **Full test suite**: `app-autonomous.spec.js`
- **Quick validation**: `quick-validation.spec.js`
- **Debug dashboard**: Real-time monitoring with screenshots

**Test Coverage**:
- ✅ App loading and React mounting
- ✅ Authentication flow detection
- ✅ Search functionality (text input)
- ✅ Voice search simulation (web compatibility)
- ✅ Location services integration
- ✅ Navigation and routing
- ✅ Responsive design (multiple viewports)
- ✅ Error handling and edge cases
- ✅ Performance metrics

### Automated Screenshots
All tests generate screenshots in `test-results/`:
- `app-loaded.png`
- `search-results.png` 
- `interactive-testing.png`
- `responsive-*.png`

### Performance Monitoring
- DOM load time tracking
- Bundle size warnings
- React rendering performance
- Network request timing
- Memory usage patterns

## 🔧 Test Configuration

### Playwright Config
- Multi-browser testing (Chromium, Firefox, Safari)
- Mobile viewport simulation
- Screenshot on failure
- Video recording for complex flows
- Timeout configurations (2 min default)

### Environment Variables
- `REACT_APP_API_URL`: API endpoint for production
- `CLOUDFLARE_API_TOKEN`: For wrangler deployments
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier

## 📊 Success Criteria & KPIs

### Functional Requirements
- ✅ React app mounts successfully
- ✅ Main UI elements are visible
- ✅ No critical JavaScript errors
- ✅ Network requests complete successfully
- ✅ Search results display correctly
- ✅ Voice search works on native platforms
- ✅ Location services function properly

### Performance Requirements
- App launch time < 5 seconds
- Search response time < 10 seconds
- Location detection < 30 seconds
- Smooth map interactions (60fps)
- No memory leaks during extended use

### Cross-Platform Requirements
- Web: Chrome, Firefox, Safari compatibility
- iOS: iPhone/iPad support, iOS 14+
- Android: Android 10+ support
- Responsive design for all screen sizes

## 🚨 Known Issues & Workarounds

### Web Platform Limitations
- Voice search requires user gesture (security)
- Location requires HTTPS in production
- Some mobile-specific features unavailable

### iOS-Specific Issues
- EAS builds required for native features
- Apple Developer account needed for device distribution
- Simulator testing sufficient for development

### Production Environment
- CORS configuration must match deployment domains
- Environment variables load differently than development
- Cloudflare edge caching may affect updates

## 📝 Bug Report Template

```markdown
**Bug ID**: [Unique identifier]
**Severity**: Critical/High/Medium/Low
**Platform**: Web/iOS/Android
**Environment**: Local/Production
**Device**: [Device model and OS version]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**: [What should happen]
**Actual Result**: [What actually happened]
**Screenshots/Videos**: [Attach if available]
**Console Logs**: [Error messages]
**Network Logs**: [API request/response data]
**Workaround**: [If any exists]
```

## 🔄 Continuous Testing Strategy

### Pre-Deployment Checklist
- [ ] Local tests pass (`npm run test:autonomous`)
- [ ] API endpoints responding correctly
- [ ] CORS configuration updated for new deployment
- [ ] Environment variables properly set
- [ ] No console errors in production build

### Post-Deployment Verification
- [ ] Production app loads correctly
- [ ] Search functionality works end-to-end
- [ ] API connectivity confirmed
- [ ] Debug components accessible if needed
- [ ] Performance metrics within acceptable range

### Regular Testing Schedule
- **Daily**: Automated web tests during development
- **Weekly**: Full iOS/Android testing
- **Pre-release**: Complete cross-platform validation
- **Post-deployment**: Production smoke tests

This testing strategy ensures reliable functionality across all platforms while providing comprehensive debugging tools for production issues.