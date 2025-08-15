# Local First Arizona Chrome Extension PRD

## Executive Summary

**Project Name:** Local First AZ Maps Extension  
**Version:** 1.0 (Proof of Concept)  
**Target Launch:** Q2 2025  

Local First Arizona seeks to expand their reach by meeting potential customers where they already search for businesses - Google Maps. This Chrome extension will filter out big box stores and chain retailers, highlighting locally-owned businesses from the LFA directory and other verified local sources.

## Problem Statement

**Current Challenge:**  
Local First Arizona's business directory receives 18,000+ unique searches monthly, but users still default to Google Maps for location-based business discovery. This means:
- Local businesses lose visibility to chain competitors in map searches
- LFA supporters must remember to use the separate directory instead of their natural search behavior
- Local business discovery happens in silos rather than at the point of need

**Opportunity:**  
Intercept Google Maps searches to surface local alternatives, making it effortless for users to discover and choose local businesses during their natural search workflow.

## Goals & Success Metrics

### Primary Goals
1. **Increase Local Business Discovery:** Drive measurable traffic to LFA member businesses
2. **Expand LFA Reach:** Grow the user base beyond current directory users
3. **Validate Extension Model:** Prove concept for potential expansion to other regions

### Success Metrics (6-month targets)
- **Adoption:** 1,000+ active extension users
- **Engagement:** 500+ monthly clicks to local business listings
- **Business Impact:** 25+ new LFA member sign-ups attributed to extension
- **User Satisfaction:** 4.0+ star rating in Chrome Web Store

## User Personas

### Primary: The Local-First Supporter
- **Demographics:** 25-55, college-educated, Arizona resident
- **Behavior:** Already aware of LFA mission, occasional directory user
- **Pain Point:** Forgets to check LFA directory when searching for businesses
- **Goal:** Effortlessly support local businesses in everyday searches

### Secondary: The Convenience Searcher  
- **Demographics:** 18-65, any background, values convenience
- **Behavior:** Heavy Google Maps user, may not know about LFA
- **Pain Point:** Unaware of local alternatives to chain businesses
- **Goal:** Find nearby businesses quickly, open to local options if presented clearly

## Core Features (MVP)

### 1. Binary Toggle System
**Functionality:**
- Simple LFA Mode vs Google Mode toggle
- **LFA Mode (Enabled):** Show only Local First Arizona member businesses with complete Google Maps UI replacement
- **Google Mode (Disabled):** Show original unmodified Google Maps results
- Clear visual status indication with dynamic status bar

**Technical Implementation:**
- Complete sidebar content replacement using Google's exact HTML structure
- Unified data caching system for consistency between map pins and listings
- Strategic mutation observer management to prevent conflicts

### 2. LFA Business Discovery
**Functionality:**
- Semantic search integration with LFA member database (~800 businesses)
- Real-time business listings with distance, contact info, and verification status
- Custom map pins with LFA branding and hover effects
- Business details with website links and local business context

**Data Source:**
- Local First Arizona verified member directory
- SQLite database with semantic search capabilities
- Relevance scoring based on search query matching

### 3. Advanced UI Integration
**Functionality:**
- Bidirectional hover effects between sidebar listings and map pins
- Google Maps-native appearance with seamless integration
- Dynamic status bar with mode-aware styling and button visibility
- Info windows with business details and external linking

### 4. User Controls
**Functionality:**
- Single-click toggle between LFA and Google modes
- Persistent user preferences across browser sessions
- Clean restoration of original Google content when disabled
- Visual feedback for all user interactions

## Technical Architecture

### Extension Structure
```
local-first-extension/
├── manifest.json (v3)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content-scripts/
│   ├── maps-modifier.js
│   └── business-detector.js
├── background/
│   └── service-worker.js
├── data/
│   ├── lfa-businesses.json
│   └── chain-blocklist.json
└── assets/
    ├── icons/
    └── badges/
```

### Key Technical Components

**Content Script (maps-modifier.js):**
- Monitors Google Maps DOM changes
- Identifies business listings
- Applies filtering and highlighting
- Injects local business suggestions

**Background Service Worker:**
- Manages extension lifecycle
- Handles data updates
- Tracks usage analytics
- Manages user preferences

**Data Management:**
- Local storage for user preferences
- Periodic sync with LFA API for member updates
- Cached chain business database
- Performance-optimized business matching

### Browser Compatibility
- **Primary:** Chrome 88+
- **Future consideration:** Firefox, Edge

## Data Requirements

### Local First Arizona Integration
**Required API Endpoints:**
- `/api/businesses` - LFA member directory with locations
- `/api/businesses/updates` - Incremental updates since last sync
- `/api/analytics/extension` - Usage reporting endpoint

**Data Fields Needed:**
```json
{
  "businesses": [
    {
      "id": "unique-id",
      "name": "Business Name",
      "address": "Full address",
      "coordinates": [lat, lng],
      "phone": "phone-number",
      "website": "url",
      "category": "restaurant|retail|service",
      "lfa_member": true,
      "member_since": "YYYY-MM-DD",
      "verified": true
    }
  ]
}
```

### Chain Business Database
- Comprehensive list of major chains with variations
- Category-based filtering (fast food, big box retail, etc.)
- Regular updates to catch new chains and acquisitions

## User Experience Flow

### Installation & Setup
1. User installs extension from Chrome Web Store
2. Extension activated by default in LFA mode
3. Green status bar appears at top of Google Maps indicating LFA business discovery mode

### Daily Usage
1. User searches Google Maps for "restaurants near me"
2. Extension automatically shows only LFA member businesses with native Google Maps appearance
3. Hover over sidebar listings highlights corresponding map pins and vice versa
4. User clicks on local business → tracked engagement, opens business website
5. User can toggle to Google mode to see original results, then back to LFA mode

### Mode Switching
1. Click "Disable"/"Enable" button in status bar for instant toggle
2. LFA Mode: Complete replacement with local businesses only
3. Google Mode: Original Google Maps experience restored
4. Status bar changes color (green/white) for clear mode indication

## Development Phases

### Phase 1: Proof of Concept (8 weeks)
**Week 1-2: Foundation**
- Extension shell with basic manifest
- Google Maps content script injection
- Basic business detection logic

**Week 3-4: Core Filtering**
- Chain business identification
- DOM manipulation for hiding/dimming
- User toggle functionality

**Week 5-6: Local Business Integration**
- LFA data integration
- Business highlighting system
- Basic suggestion system

**Week 7-8: Polish & Testing**
- UI/UX refinement
- Cross-browser testing
- Performance optimization

### Phase 2: Enhanced Features (6 weeks)
- Alternative business suggestions
- Advanced filtering options
- Analytics integration
- Chrome Web Store submission

### Phase 3: Handoff Preparation (4 weeks)
- Comprehensive documentation
- Deployment pipeline setup
- Team training materials
- Maintenance procedures

## Technical Challenges & Solutions

### Challenge 1: Google Maps DOM Complexity
**Risk:** Maps interface changes frequently, breaking extension  
**Solution Implemented:** 
- Mimic Google's exact HTML structure instead of custom UI elements
- Use `role="feed"` containers as key injection points
- Strategic mutation observer management (disable when LFA mode active)
- Robust `data-*` attribute system for cross-component communication

### Challenge 2: UI Integration & Performance
**Risk:** Extension creates visual conflicts or performance issues  
**Solution Implemented:**
- Binary toggle approach eliminates complex filtering logic
- Complete content replacement vs. overlay/filtering reduces conflicts
- Unified data caching (`window.LFA_cachedBusinesses`) prevents timing issues
- WeakMap element tracking enables clean restoration

### Challenge 3: Data Synchronization & Reliability
**Risk:** Inconsistent data between map pins and sidebar listings  
**Solution Implemented:**
- Single source of truth with shared caching system
- Semantic search API with relevance scoring
- SQLite database with ~800 verified LFA businesses
- Graceful fallback when API unavailable

## Privacy & Security

### Data Collection
- **Minimal Approach:** Only collect necessary usage statistics
- **No Personal Data:** No location tracking beyond current map view
- **Transparent:** Clear privacy policy and data usage

### Permissions Required
- `activeTab` - Modify Google Maps pages
- `storage` - Save user preferences
- `host_permissions` - Access maps.google.com

### Security Measures
- Content Security Policy enforcement
- Input validation for all data sources
- Regular security audits

## Analytics & Reporting

### Usage Metrics
- Daily/monthly active users
- Extension toggle rates
- Business click-through rates
- Search filter effectiveness

### Business Impact Metrics
- Traffic driven to LFA member websites
- Phone call attribution (where trackable)
- Member business feedback
- New membership attributions

### Technical Metrics
- Extension performance impact
- Error rates and crash reports
- Browser compatibility issues
- Update success rates

## Deployment Strategy

### Distribution
- **Primary:** Chrome Web Store (free)
- **Promotion:** LFA website, newsletters, social media
- **Onboarding:** Email campaigns to existing LFA supporters

### Update Management
- Automatic extension updates via Chrome Web Store
- Graceful degradation for API changes
- Rollback procedures for critical issues

### Quality Assurance
- Automated testing pipeline
- Beta user group (LFA board members, volunteers)
- Performance monitoring
- User feedback collection system

## Budget Considerations

### Development Resources
- **Technical Lead:** 1 developer @ 20 hrs/week x 18 weeks
- **Design/UX:** 1 designer @ 10 hrs/week x 6 weeks  
- **Project Management:** 1 PM @ 5 hrs/week x 18 weeks

### Infrastructure Costs
- Chrome Web Store registration: $5 (one-time)
- Analytics/monitoring tools: ~$20/month
- API hosting (if needed): ~$10-50/month depending on usage

### Marketing & Distribution
- Chrome Web Store assets and screenshots
- User guide and video creation
- LFA integration and promotion

## Risk Assessment

### High Risk
- **Google Maps Changes:** Could break extension functionality
- **Mitigation:** Robust testing, fallback strategies, quick update capability

### Medium Risk  
- **User Adoption:** Extension might not reach target users
- **Mitigation:** Strong LFA promotion, clear value proposition, user feedback integration

### Low Risk
- **Data Accuracy:** Some businesses misclassified
- **Mitigation:** Community reporting, regular audits, conservative approach

## Success Criteria for Handoff

### Technical Deliverables
- [ ] Working Chrome extension with all MVP features
- [ ] Comprehensive technical documentation
- [ ] Automated testing suite
- [ ] Deployment pipeline with CI/CD
- [ ] Performance monitoring dashboard

### Business Deliverables  
- [ ] 500+ active users within 3 months
- [ ] 4.0+ star rating in Chrome Web Store
- [ ] Measurable traffic increase to LFA member businesses
- [ ] Positive feedback from LFA board and members

### Knowledge Transfer
- [ ] Complete code documentation and architecture guide
- [ ] Video walkthrough of codebase and deployment
- [ ] Maintenance runbook with common issues/solutions
- [ ] Contact list for ongoing technical support

## Future Roadmap (Post-Handoff)

### Immediate Enhancements (Months 1-3)
- Firefox extension port
- Mobile browser compatibility
- Enhanced business categories
- User review integration

### Medium-term Features (Months 4-12)
- Yelp/TripAdvisor integration
- Local event promotion
- Loyalty program integration
- Multi-city expansion

### Long-term Vision (Year 2+)
- White-label solution for other local business coalitions
- AI-powered local business recommendations
- Integration with local government economic development
- Community-driven business verification system

## Appendices

### A. LFA Business Categories
Based on current directory structure:
- Restaurants & Food Service
- Retail & Shopping  
- Professional Services
- Health & Wellness
- Home & Garden
- Arts & Entertainment
- Automotive
- Financial Services

### B. Target Chain Businesses (Initial List)
**Retail:** Walmart, Target, Best Buy, Home Depot, Lowe's, Costco, Sam's Club
**Restaurants:** McDonald's, Burger King, KFC, Taco Bell, Subway, Starbucks, Chipotle
**Services:** H&R Block, Jiffy Lube, Valvoline Instant Oil Change

### C. Technical Dependencies
- Chrome Extension Manifest V3
- Google Maps DOM structure
- Local First Arizona API (to be developed)
- Chrome Web Store Developer Account

---

*This PRD is a living document and will be updated based on stakeholder feedback and development discoveries.*