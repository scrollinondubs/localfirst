-- Migration 0003: Create user_favorites table
-- Replace JSON-based favorites in consumer_profiles with proper relational table

-- Create user_favorites table
CREATE TABLE user_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, business_id)
);

-- Indexes for user_favorites table for performance optimization
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_business_id ON user_favorites(business_id);
CREATE INDEX idx_user_favorites_created_at ON user_favorites(created_at);

-- Composite index for efficient lookups
CREATE INDEX idx_user_favorites_user_business ON user_favorites(user_id, business_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_user_favorites_timestamp 
  AFTER UPDATE ON user_favorites
  BEGIN
    UPDATE user_favorites SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- Migration note: Existing favorite_businesses data in consumer_profiles 
-- will be migrated separately via a data migration script if needed