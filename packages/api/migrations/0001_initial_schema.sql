-- Migration 0001: Initial schema for LocalFirst Arizona
-- Create all tables with proper indexes

-- Businesses table
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  website TEXT,
  category TEXT NOT NULL,
  lfa_member INTEGER DEFAULT 0,
  member_since TEXT,
  verified INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for businesses table
CREATE INDEX idx_businesses_category ON businesses(category);
CREATE INDEX idx_businesses_lfa_member ON businesses(lfa_member);
CREATE INDEX idx_businesses_location ON businesses(latitude, longitude);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_name ON businesses(name);

-- Chain businesses blocklist
CREATE TABLE chain_businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  patterns TEXT,
  category TEXT,
  parent_company TEXT,
  confidence_score INTEGER DEFAULT 100,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for chain businesses
CREATE INDEX idx_chain_businesses_name ON chain_businesses(name);
CREATE INDEX idx_chain_businesses_category ON chain_businesses(category);

-- Analytics events
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  extension_id TEXT,
  event_type TEXT NOT NULL,
  business_id TEXT,
  metadata TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Indexes for analytics
CREATE INDEX idx_analytics_extension_id ON analytics_events(extension_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_business_id ON analytics_events(business_id);

-- User sessions (for analytics aggregation)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  extension_id TEXT NOT NULL,
  session_start TEXT DEFAULT (datetime('now')),
  session_end TEXT,
  total_interactions INTEGER DEFAULT 0,
  businesses_viewed INTEGER DEFAULT 0,
  filters_toggled INTEGER DEFAULT 0
);

-- Indexes for user sessions
CREATE INDEX idx_sessions_extension_id ON user_sessions(extension_id);
CREATE INDEX idx_sessions_start ON user_sessions(session_start);

-- LFA sync tracking
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  records_processed INTEGER,
  records_updated INTEGER,
  records_added INTEGER,
  error_details TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Indexes for sync logs
CREATE INDEX idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at);

-- Users table (for mobile app authentication)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  reset_token TEXT,
  reset_token_expiry TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login TEXT,
  is_active INTEGER DEFAULT 1
);

-- Indexes for users
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_active ON users(is_active);

-- Consumer profiles table (for user preferences and saved data)
CREATE TABLE consumer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences TEXT,
  saved_searches TEXT,
  favorite_businesses TEXT,
  location_preferences TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for consumer profiles
CREATE UNIQUE INDEX idx_consumer_profiles_user_id ON consumer_profiles(user_id);

-- Triggers to update updated_at timestamps
CREATE TRIGGER update_businesses_timestamp 
  AFTER UPDATE ON businesses
  BEGIN
    UPDATE businesses SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_users_timestamp 
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_consumer_profiles_timestamp 
  AFTER UPDATE ON consumer_profiles
  BEGIN
    UPDATE consumer_profiles SET updated_at = datetime('now') WHERE id = NEW.id;
  END;