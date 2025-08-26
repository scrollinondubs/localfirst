# Local First Arizona Web Application - Product Requirements Document

## Executive Summary

Local First Arizona has developed a web-first application to connect consumers in Arizona with 5,000+ local businesses in our database. The app features an intuitive voice-first interface using browser-based speech recognition, combined with Google Maps integration, location services, and semantic search capabilities that prioritizes Local First Arizona member businesses.

## Product Vision

Create a seamless, web-accessible experience that strengthens local economies by making it effortless for consumers to discover and support local businesses through voice search and intelligent business matching, with optional personalization features for enhanced user experience.

## Technical Architecture

### Frontend
- **Framework:** React Native with Expo (Web deployment)
- **Maps:** react-native-maps (Google Maps integration)
- **Voice Interface:** Web Speech API (browser-based speech recognition)
- **Responsive Design:** Mobile-first web application
- **Development:** Claude Code with MCP integration

### Backend
- **API Server:** Node.js
- **Database:** SQLite (local development) / Cloudflare D1 (production)
- **Business Data:** Pre-loaded SQLite database with 5,000+ local businesses
- **Semantic Search:** Keyword mapping and pattern matching
- **Authentication:** JWT-based (optional user accounts)
- **API Architecture:** RESTful APIs

### Deployment Strategy
- **Development:** Local Expo server + Local API server
- **Production Web:** Expo export:web + Cloudflare pages
- **Production API:** Node.js via Cloudflare workers
- **Production Database:** Cloudflare D1

### DevOps & Tooling
- **Source Control:** GitHub with CI/CD pipeline
- **Project Management:** Linear (with MCP integration)
- **Testing:** [TBD - Jest, Detox, etc.]
- **Deployment:** Expo with MCP server integration

### Multi-Agent Development Approach
- **ui-ux-designer** · sonnet
- **frontend-engineer** · sonnet
- **qa-testing-engineer** · sonnet
- **product-manager** · sonnet
- **backend-database-engineer** · sonnet
- **devops-engineer** · sonnet
- **marketing-specialist** · sonnet
- **cto** · sonnet
- Maximum autonomy for Claude Code operations

## Target Users

### Primary Users
- **Arizona Residents:** Anyone looking to discover local businesses
- **Public Access:** No account required for basic functionality
- **LFA Supporters:** Users who prioritize supporting Local First Arizona member businesses

### Secondary Users (Optional Accounts)
- **Personalization Users:** Users who create accounts for customized recommendations
- **Future Business Owners:** Potential integration for business claiming and management

## Core Features (MVP v1)

### Core Features (Current Implementation)
1. **Voice-First Business Discovery**
   - Web Speech API integration with "Push to Record" button
   - Browser-based speech recognition (Chrome optimized)
   - Speech-to-text transcription display
   - Traditional text search as alternative
   - Semantic search with keyword mapping
   - Location-based business search with distance calculation
   - Google Maps integration showing business markers
   - LFA member prioritization in search results

2. **AI Concierge & Personalized Recommendations** ⭐ *New*
   - Intelligent user profile interviewing system
   - Personal dossier generation from conversation data
   - OpenAI-powered business matching and rationale generation
   - Personalized business recommendations with compelling explanations
   - User interest and preference extraction from natural conversation
   - Advanced matching engine with fallback profile data handling
   - Real-time recommendation generation (5 suggestions per user)

3. **Business Intelligence & Enrichment** ⭐ *New*
   - Automated business website content extraction
   - AI-generated business descriptions and service catalogues
   - Enhanced business profile data with products/services details
   - Intelligent categorization and feature detection
   - Business offering synopsis for improved matching accuracy

4. **Interactive Mapping**
   - Google Maps with business location markers
   - User location detection and display
   - Different pin colors for LFA members vs non-members
   - Manual location input fallback
   - Map controls (zoom, compass, scale)

5. **Adaptive User Profiling** ⭐ *New*
   - Conversational user interviews for preference discovery
   - Personal dossier compilation with interests, lifestyle, shopping patterns
   - Interview insights structured as JSON data for matching
   - Profile completeness tracking and recommendation quality optimization
   - Multiple data source fallbacks (interview insights → personal dossier)

6. **Public Access Model**
   - No login required for basic functionality
   - Complete business search and discovery without account
   - Optional account creation for advanced personalization features
   - Profile screen explaining benefits of AI-powered recommendations

7. **Enhanced Business Information**
   - Business name, address, phone, website
   - Category classification and LFA membership status
   - Distance calculation from user location
   - AI-generated business descriptions and service offerings
   - Enriched product/service catalogs from website analysis
   - Mock ratings (ready for future enhancement)

### Future Features (Not Yet Implemented)
1. **Enhanced Personalization** *(Partially Complete)*
   - ✅ User preference learning and storage (via interview system)
   - ✅ Personalized business recommendations (via AI Concierge)
   - Search history and favorites
   - Custom notification preferences
   - Recommendation refinement based on user feedback

2. **Business Management**
   - Business claiming and verification system
   - Profile management for business owners
   - Promotion and deal posting capabilities

3. **Advanced Features**
   - Real-time business ratings and reviews
   - Push notifications for deals and updates
   - Social sharing capabilities
   - Multi-city expansion tools
   - Performance optimization for recommendation generation
   - Batch OpenAI processing and caching strategies

## Roadmap

### Version 1 (MVP) *(Current Status: 85% Complete)*
- ✅ Voice-first business discovery with speech-to-text interface
- ✅ AI-powered personalization and recommendation engine (OpenAI-based)
- ✅ Core business discovery and mapping
- ✅ User profiles with preference learning (conversational interviews)
- ✅ Business enrichment with AI-generated descriptions
- 🔄 Business claiming system (in progress)
- 🔄 Smart push notifications (planned)

### Version 2 (Future)
- **Gamification Layer**
  - User badges and achievements
  - Leaderboards for local support
  - Point-based reward system
- **Growth Features**
  - Affiliate tracking
  - Viral components and referral system
  - Social sharing features

## Success Metrics (v1)
- User adoption rate in Phoenix
- Voice search usage and success rate
- AI recommendation click-through rate
- User preference learning accuracy
- Business discovery engagement
- Business claim completion rate
- User retention and session frequency
- Business profile views and interactions

## Key User Flows

### Consumer User Flow *(Updated for AI Concierge)*
1. Access web app (no download required) and optionally create profile
2. Allow location and microphone permissions
3. **Voice Search:** Tap "Push to Record" button and speak query naturally
4. Review speech-to-text transcription and confirm search
5. Browse voice-generated results on map with AI recommendations
6. **AI Concierge Interview:** Engage in conversational profiling to build preferences
7. **Personal Recommendations:** Receive personalized business suggestions with AI-generated rationale
8. View business details with tailored explanations of why each match fits user's interests
9. Filter by category/preferences or use traditional text search
10. Get directions or contact business (voice-activated options available)

### Business Owner User Flow
1. Download app and create business account
2. Search for their business in Google Maps data
3. Claim business listing
4. Complete verification (location or email)
5. Wait for admin approval
6. Manage business profile and promotions

## Technical Decisions Finalized
- **Framework:** React Native + Expo (Claude Code proficiency)
- **Backend:** Cloudflare Workers (your preference for stateless)
- **Database:** Firebase (best Expo integration)
- **Maps:** Google Maps API (comprehensive business data)
- **Auth:** Firebase Auth (seamless integration)

---

## Requirements Deep Dive

[To be completed during interview]

### User Stories & Acceptance Criteria
[To be developed into Linear issues]

### Non-Functional Requirements
[Performance, security, scalability requirements]

### Integration Requirements
[External APIs, services, data sources]