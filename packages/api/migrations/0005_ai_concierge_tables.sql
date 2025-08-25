-- AI Concierge System Tables

-- User preferences for AI Concierge
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Notification settings
  notification_frequency TEXT DEFAULT 'weekly', -- daily, twice_weekly, weekly, bi_weekly, monthly
  notification_channels TEXT, -- JSON: {in_app: true, push: false, email: false, sms: false}
  quiet_hours TEXT, -- JSON: {enabled: true, start: "22:00", end: "08:00"}
  preferred_days TEXT, -- JSON: ["monday", "wednesday", "friday"]
  
  -- Location settings
  location_settings TEXT, -- JSON: {home: {lat, lng, address}, work: {lat, lng, address}, current: "home"}
  search_radius INTEGER DEFAULT 15, -- Miles for regular searches
  weekend_radius INTEGER DEFAULT 25, -- Miles for weekend/leisure searches
  
  -- Recommendation tracking
  last_recommendation_date TEXT,
  next_recommendation_due TEXT,
  total_recommendations_received INTEGER DEFAULT 0,
  
  -- Privacy settings
  data_usage_consent INTEGER DEFAULT 1, -- boolean
  profile_sharing_level TEXT DEFAULT 'minimal', -- minimal, standard, detailed
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- AI Concierge recommendations
CREATE TABLE IF NOT EXISTS concierge_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Recommendation metadata
  recommendation_type TEXT DEFAULT 'regular', -- regular, seasonal, gift, event, urgent
  match_score REAL NOT NULL, -- 0.0 to 1.0 scoring
  batch_id TEXT, -- Groups recommendations from same cron run
  
  -- AI-generated content
  rationale TEXT NOT NULL, -- Human-readable explanation
  rationale_highlights TEXT, -- JSON: ["key point 1", "key point 2"]
  matching_factors TEXT, -- JSON: {interests: 0.4, location: 0.15, ...}
  
  -- Delivery and engagement tracking
  status TEXT DEFAULT 'pending', -- pending, delivered, viewed, acted_on, dismissed
  delivered_at TEXT,
  viewed_at TEXT,
  interacted_at TEXT,
  
  -- User feedback
  feedback TEXT, -- liked, disliked, neutral
  feedback_comment TEXT,
  feedback_at TEXT,
  
  -- Performance tracking
  generation_time_ms INTEGER,
  openai_tokens_used INTEGER,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Recommendation processing logs for monitoring and debugging
CREATE TABLE IF NOT EXISTS recommendation_logs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  
  -- Processing metrics
  users_processed INTEGER DEFAULT 0,
  users_eligible INTEGER DEFAULT 0,
  recommendations_generated INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Error tracking
  errors TEXT, -- JSON array of error objects
  error_count INTEGER DEFAULT 0,
  
  -- Resource usage
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0.0, -- USD
  
  -- Performance stats
  avg_match_score REAL,
  avg_generation_time REAL,
  
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT DEFAULT 'running' -- running, completed, failed
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_concierge_recommendations_user_id ON concierge_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_concierge_recommendations_business_id ON concierge_recommendations(business_id);
CREATE INDEX IF NOT EXISTS idx_concierge_recommendations_batch_id ON concierge_recommendations(batch_id);
CREATE INDEX IF NOT EXISTS idx_concierge_recommendations_status ON concierge_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_batch_id ON recommendation_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_logs_status ON recommendation_logs(status);