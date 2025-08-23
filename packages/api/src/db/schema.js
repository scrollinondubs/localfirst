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
  category: text('category').notNull(),
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