import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';

// Businesses table
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

// Chain businesses blocklist
export const chainBusinesses = sqliteTable('chain_businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  patterns: text('patterns'), // JSON array of name patterns to match
  category: text('category'),
  parentCompany: text('parent_company'),
  confidenceScore: integer('confidence_score').default(100), // 0-100 matching confidence
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// Analytics events
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

// Users table (for mobile app authentication)
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
  
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// User favorites table (replaces JSON approach in consumer_profiles for better performance)
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

// Business Categories table for taxonomy management
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