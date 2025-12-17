/**
 * ============================================================================
 * DATABASE SCHEMA DEFINITION
 * ============================================================================
 * 
 * This file defines all database tables for the Local First Arizona application.
 * 
 * NAMING CONVENTIONS:
 * - Table names: snake_case (e.g., 'businesses', 'user_favorites')
 * - Column names: snake_case (e.g., 'created_at', 'user_id')
 * - Foreign keys: {referenced_table}_id (e.g., 'user_id', 'business_id')
 * 
 * DATA TYPES:
 * - text: Strings, JSON data, UUIDs, timestamps (ISO 8601 format)
 * - integer: Counts, scores, booleans (use { mode: 'boolean' } for booleans)
 * - real: Decimal numbers (coordinates, scores, costs)
 * 
 * TIMESTAMPS:
 * - All tables include 'created_at' (auto-set to CURRENT_TIMESTAMP)
 * - Most tables include 'updated_at' (should be updated on modification)
 * - Timestamps stored as ISO 8601 strings
 * 
 * FOREIGN KEYS:
 * - All foreign keys use onDelete: 'cascade' for data integrity
 * - This ensures related records are deleted when parent is deleted
 * 
 * JSON FIELDS:
 * - Many tables use JSON fields for flexible data storage
 * - Always validate JSON structure in application code
 * - Document JSON schemas in code comments
 * 
 * DOCUMENTATION:
 * - See /docs/DATABASE_SCHEMA.md for comprehensive documentation
 * - Each table has inline comments explaining purpose and key fields
 * 
 * ============================================================================
 */

import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';

/**
 * ============================================================================
 * CORE BUSINESS TABLES
 * ============================================================================
 */

/**
 * businesses
 * 
 * Purpose: Stores all Local First Arizona member businesses and their information.
 * 
 * Key Relationships:
 * - Referenced by: user_favorites, enrichment_logs, failed_enrichments, concierge_recommendations
 * 
 * Important Notes:
 * - The 'category' field is legacy - use 'primary_category' and 'subcategory' instead
 * - JSON fields (business_attributes, hours_of_operation, etc.) should be validated on insert/update
 * - Coordinates (latitude/longitude) are required for map display
 */
export const businesses = sqliteTable('businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  phone: text('phone'),
  website: text('website'),
  category: text('category').notNull(), // Legacy category field
  
  // Business Enrichment Fields
  primaryCategory: text('primary_category'),
  subcategory: text('subcategory'),
  businessDescription: text('business_description'),
  productsServices: text('products_services'), // JSON field for structured offerings
  keywords: text('keywords'), // Search optimization keywords
  enrichmentStatus: text('enrichment_status').default('pending'), // pending, in_progress, completed, failed
  enrichmentDate: text('enrichment_date'),
  enrichmentSource: text('enrichment_source'), // website, manual, api, etc.
  businessAttributes: text('business_attributes'), // JSON field for woman-owned, veteran-owned, etc.
  hoursOfOperation: text('hours_of_operation'), // JSON field for business hours
  socialMediaLinks: text('social_media_links'), // JSON field for social media URLs
  specialFeatures: text('special_features'), // JSON field for delivery, accessibility, etc.
  
  lfaMember: integer('lfa_member', { mode: 'boolean' }).default(false),
  memberSince: text('member_since'), // Date as ISO string
  verified: integer('verified', { mode: 'boolean' }).default(false),
  status: text('status').default('active'), // active, inactive, pending
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

/**
 * chain_businesses
 * 
 * Purpose: Stores chain business patterns for filtering out non-local businesses.
 * Used by the Chrome extension to identify and filter chain stores.
 * 
 * Key Fields:
 * - patterns: JSON array of name patterns to match against business names
 * - confidence_score: Matching confidence level (0-100)
 */
export const chainBusinesses = sqliteTable('chain_businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  patterns: text('patterns'), // JSON array of name patterns to match
  category: text('category'),
  parentCompany: text('parent_company'),
  confidenceScore: integer('confidence_score').default(100), // 0-100 matching confidence
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

/**
 * ============================================================================
 * ANALYTICS & TRACKING TABLES
 * ============================================================================
 */

/**
 * analytics_events
 * 
 * Purpose: Tracks user interaction events for analytics.
 * Uses anonymous extension_id for privacy-friendly tracking.
 * 
 * Event Types: 'view', 'click', 'filter_toggle', etc.
 */
export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  extensionId: text('extension_id'), // anonymous extension identifier
  eventType: text('event_type').notNull(), // view, click, filter_toggle, etc.
  businessId: text('business_id'),
  metadata: text('metadata'), // JSON additional data
  timestamp: text('timestamp').default(sql`CURRENT_TIMESTAMP`)
});

// User sessions (for analytics aggregation)
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  extensionId: text('extension_id').notNull(),
  sessionStart: text('session_start').default(sql`CURRENT_TIMESTAMP`),
  sessionEnd: text('session_end'),
  totalInteractions: integer('total_interactions').default(0),
  businessesViewed: integer('businesses_viewed').default(0),
  filtersToggled: integer('filters_toggled').default(0)
});

// LFA sync tracking
export const syncLogs = sqliteTable('sync_logs', {
  id: text('id').primaryKey(),
  syncType: text('sync_type').notNull(), // businesses, chains, full
  status: text('status').notNull(), // success, error, partial
  recordsProcessed: integer('records_processed'),
  recordsUpdated: integer('records_updated'),
  recordsAdded: integer('records_added'),
  errorDetails: text('error_details'),
  startedAt: text('started_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at')
});

/**
 * ============================================================================
 * USER & AUTHENTICATION TABLES
 * ============================================================================
 */

/**
 * users
 * 
 * Purpose: Stores user accounts for the mobile app authentication system.
 * 
 * Security Notes:
 * - password_hash: Never store plain text passwords, always hash
 * - reset_token: Used for password reset functionality
 * - is_active: Use for soft deletes (don't hard delete user accounts)
 * 
 * Relationships:
 * - Referenced by: consumer_profiles, user_favorites, conversation_sessions, 
 *   user_preferences, concierge_recommendations
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  resetToken: text('reset_token'),
  resetTokenExpiry: text('reset_token_expiry'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  lastLogin: text('last_login'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true)
});

// Consumer profiles table (for user preferences and saved data)
export const consumerProfiles = sqliteTable('consumer_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  preferences: text('preferences'), // JSON for category preferences
  savedSearches: text('saved_searches'), // JSON array of search queries
  favoriteBusinesses: text('favorite_businesses'), // JSON array of business IDs - DEPRECATED: Use userFavorites table
  locationPreferences: text('location_preferences'), // JSON for preferred areas/regions
  
  // AI Interview fields
  interviewTranscript: text('interview_transcript'), // Full conversation history as JSON
  interviewSummary: text('interview_summary'), // AI-generated summary of interests/preferences
  interviewInsights: text('interview_insights'), // JSON of extracted key interests and needs
  profileCompleteness: integer('profile_completeness').default(0), // 0-100 score
  lastInterviewDate: text('last_interview_date'),
  
  // Personal Dossier fields
  personalDossier: text('personal_dossier'), // JSON structured dossier from AI synthesis
  dossierGeneratedAt: text('dossier_generated_at'), // Timestamp of dossier creation/update
  dossierVersion: integer('dossier_version').default(1), // Track regeneration count
  
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

/**
 * user_favorites
 * 
 * Purpose: Stores user's favorite businesses.
 * Replaces the JSON approach in consumer_profiles for better query performance.
 * 
 * Relationships:
 * - References: users, businesses
 * 
 * Constraints:
 * - Unique constraint on (user_id, business_id) prevents duplicate favorites
 * - Cascade delete: favorites are deleted when user or business is deleted
 */
export const userFavorites = sqliteTable('user_favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  // Unique constraint to prevent duplicate favorites
  uniqueUserBusiness: unique().on(table.userId, table.businessId)
}));

/**
 * ============================================================================
 * CATEGORY & TAXONOMY TABLES
 * ============================================================================
 */

/**
 * business_categories
 * 
 * Purpose: Manages the business category taxonomy system.
 * Supports hierarchical categories via parent_category_id.
 * 
 * Key Features:
 * - Hierarchical structure (parent/child categories)
 * - UI customization (icon_name, color_code)
 * - Sort ordering for display
 * - Active/inactive status for soft deletes
 * 
 * Usage: Used for filtering and organizing businesses by category.
 */
export const businessCategories = sqliteTable('business_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  parentCategoryId: text('parent_category_id').references(() => businessCategories.id),
  displayName: text('display_name').notNull(),
  description: text('description'),
  keywords: text('keywords'), // JSON array of keywords for this category
  iconName: text('icon_name'), // Icon identifier for UI
  colorCode: text('color_code'), // Hex color for UI theming
  sortOrder: integer('sort_order').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Enrichment logs for tracking business data enrichment processes
export const enrichmentLogs = sqliteTable('enrichment_logs', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  enrichmentType: text('enrichment_type').notNull(), // category, description, full
  status: text('status').notNull(), // success, error, partial
  confidenceScore: real('confidence_score'), // 0.0 to 1.0 for AI classification confidence
  processingTimeMs: integer('processing_time_ms'), // Time taken to process
  errorMessage: text('error_message'),
  rawData: text('raw_data'), // JSON of raw scraped/extracted data
  aiResponse: text('ai_response'), // JSON of AI classification/description response
  startedAt: text('started_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// Failed enrichments for retry management
export const failedEnrichments = sqliteTable('failed_enrichments', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  failureReason: text('failure_reason').notNull(),
  retryCount: integer('retry_count').default(0),
  lastRetryAt: text('last_retry_at'),
  nextRetryAt: text('next_retry_at'),
  maxRetries: integer('max_retries').default(3),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Conversation sessions for AI interviews
export const conversationSessions = sqliteTable('conversation_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messages: text('messages').notNull(), // JSON array of {role: 'user'|'assistant', content: string, timestamp: string}
  sessionStatus: text('session_status').default('active'), // active, completed, paused
  sessionStart: text('session_start').default(sql`CURRENT_TIMESTAMP`),
  sessionEnd: text('session_end'),
  messageCount: integer('message_count').default(0),
  extractedTopics: text('extracted_topics'), // JSON array of identified interests/needs
  lastActivity: text('last_activity').default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// User preferences for AI Concierge
export const userPreferences = sqliteTable('user_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Notification settings
  notificationFrequency: text('notification_frequency').default('weekly'), // daily, twice_weekly, weekly, bi_weekly, monthly
  notificationChannels: text('notification_channels'), // JSON: {in_app: true, push: false, email: false, sms: false}
  quietHours: text('quiet_hours'), // JSON: {enabled: true, start: "22:00", end: "08:00"}
  preferredDays: text('preferred_days'), // JSON: ["monday", "wednesday", "friday"]
  
  // Location settings
  locationSettings: text('location_settings'), // JSON: {home: {lat, lng, address}, work: {lat, lng, address}, current: "home"}
  searchRadius: integer('search_radius').default(15), // Miles for regular searches
  weekendRadius: integer('weekend_radius').default(25), // Miles for weekend/leisure searches
  
  // Recommendation tracking
  lastRecommendationDate: text('last_recommendation_date'),
  nextRecommendationDue: text('next_recommendation_due'),
  totalRecommendationsReceived: integer('total_recommendations_received').default(0),
  resultsPerNotification: integer('results_per_notification').default(3), // Number of recommendations per notification (1-5)
  
  // Privacy settings
  dataUsageConsent: integer('data_usage_consent', { mode: 'boolean' }).default(true),
  profileSharingLevel: text('profile_sharing_level').default('minimal'), // minimal, standard, detailed
  
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// AI Concierge recommendations
export const conciergeRecommendations = sqliteTable('concierge_recommendations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  
  // Recommendation metadata
  recommendationType: text('recommendation_type').default('regular'), // regular, seasonal, gift, event, urgent
  matchScore: real('match_score').notNull(), // 0.0 to 1.0 scoring
  batchId: text('batch_id'), // Groups recommendations from same cron run
  
  // AI-generated content
  rationale: text('rationale').notNull(), // Human-readable explanation
  rationaleHighlights: text('rationale_highlights'), // JSON: ["key point 1", "key point 2"]
  matchingFactors: text('matching_factors'), // JSON: {interests: 0.4, location: 0.15, ...}
  
  // Delivery and engagement tracking
  status: text('status').default('pending'), // pending, delivered, viewed, acted_on, dismissed
  deliveredAt: text('delivered_at'),
  viewedAt: text('viewed_at'),
  interactedAt: text('interacted_at'),
  
  // User feedback
  feedback: text('feedback'), // liked, disliked, neutral
  feedbackComment: text('feedback_comment'),
  feedbackAt: text('feedback_at'),
  
  // Performance tracking
  generationTimeMs: integer('generation_time_ms'),
  openaiTokensUsed: integer('openai_tokens_used'),
  
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Recommendation processing logs for monitoring and debugging
export const recommendationLogs = sqliteTable('recommendation_logs', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  
  // Processing metrics
  usersProcessed: integer('users_processed').default(0),
  usersEligible: integer('users_eligible').default(0),
  recommendationsGenerated: integer('recommendations_generated').default(0),
  processingTimeMs: integer('processing_time_ms'),
  
  // Error tracking
  errors: text('errors'), // JSON array of error objects
  errorCount: integer('error_count').default(0),
  
  // Resource usage
  totalTokensUsed: integer('total_tokens_used').default(0),
  estimatedCost: real('estimated_cost').default(0.0), // USD
  
  // Performance stats
  avgMatchScore: real('avg_match_score'),
  avgGenerationTime: real('avg_generation_time'),
  
  startedAt: text('started_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  status: text('status').default('running') // running, completed, failed
});

/**
 * ============================================================================
 * SUPPORT & FEEDBACK TABLES
 * ============================================================================
 */

/**
 * support_tickets
 * 
 * Purpose: Stores user bug reports and feedback submissions.
 * 
 * Ticket Types:
 * - 'bug-report': User-reported bugs/issues (includes 6-digit ticket_number)
 * - 'general-feedback': User suggestions and feedback (ticket_number format: FB-{timestamp})
 * 
 * Status Flow:
 * - 'open' → 'in-progress' → 'resolved' → 'closed'
 * 
 * Email Integration:
 * - Confirmation emails are sent when tickets are created
 * - Email addresses are required for bug reports, optional for feedback
 * 
 * Admin Workflow:
 * - Admin can respond via admin_response field
 * - responded_at tracks when admin responded
 * 
 * Key Fields:
 * - ticket_number: Unique identifier (6-digit for bugs, FB-{timestamp} for feedback)
 * - email: User email (required, used for confirmation emails)
 * - user_id: Optional foreign key to users table (if user is logged in)
 * - description: Full description of issue or feedback
 * 
 * Relationships:
 * - References: users (optional, for logged-in users)
 */
export const supportTickets = sqliteTable('support_tickets', {
  id: text('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(), // 6-digit ticket number for bug reports, FB-{timestamp} for feedback
  type: text('type').notNull(), // 'bug-report' or 'general-feedback'
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // Optional: links to user account if logged in
  email: text('email').notNull(), // Required for email confirmations
  subject: text('subject'), // Optional subject line (primarily for bug reports)
  description: text('description').notNull(), // Full description of issue or feedback
  status: text('status').default('open'), // 'open', 'in-progress', 'resolved', 'closed'
  adminResponse: text('admin_response'), // Admin's response to the ticket
  respondedAt: text('responded_at'), // Timestamp when admin responded
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});