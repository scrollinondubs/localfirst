-- Migration 0004: Business Enrichment Schema
-- Add columns to support business categorization, descriptions, and AI-powered recommendations

-- Add new columns to businesses table for enrichment data
ALTER TABLE businesses ADD COLUMN primary_category TEXT;
ALTER TABLE businesses ADD COLUMN subcategory TEXT;
ALTER TABLE businesses ADD COLUMN business_description TEXT;
ALTER TABLE businesses ADD COLUMN products_services TEXT; -- JSON field for structured offerings
ALTER TABLE businesses ADD COLUMN keywords TEXT; -- Search optimization keywords
ALTER TABLE businesses ADD COLUMN enrichment_status TEXT DEFAULT 'pending'; -- pending, in_progress, completed, failed
ALTER TABLE businesses ADD COLUMN enrichment_date TEXT;
ALTER TABLE businesses ADD COLUMN enrichment_source TEXT; -- website, manual, api, etc.
ALTER TABLE businesses ADD COLUMN business_attributes TEXT; -- JSON field for attributes like woman-owned, veteran-owned
ALTER TABLE businesses ADD COLUMN hours_of_operation TEXT; -- JSON field for business hours
ALTER TABLE businesses ADD COLUMN social_media_links TEXT; -- JSON field for social media URLs
ALTER TABLE businesses ADD COLUMN special_features TEXT; -- JSON field for features like delivery, accessibility

-- Add indexes for new searchable columns
CREATE INDEX idx_businesses_primary_category ON businesses(primary_category);
CREATE INDEX idx_businesses_subcategory ON businesses(subcategory);
CREATE INDEX idx_businesses_enrichment_status ON businesses(enrichment_status);
CREATE INDEX idx_businesses_enrichment_date ON businesses(enrichment_date);

-- Create full-text search index for business descriptions and keywords
-- SQLite FTS5 virtual table for advanced text search
CREATE VIRTUAL TABLE businesses_fts USING fts5(
  business_id UNINDEXED,
  business_name,
  business_description,
  keywords,
  products_services
);

-- Create triggers to keep FTS table in sync with businesses table
CREATE TRIGGER businesses_fts_insert AFTER INSERT ON businesses BEGIN
  INSERT INTO businesses_fts(business_id, business_name, business_description, keywords, products_services)
  VALUES (new.id, new.name, new.business_description, new.keywords, new.products_services);
END;

CREATE TRIGGER businesses_fts_delete AFTER DELETE ON businesses BEGIN
  DELETE FROM businesses_fts WHERE business_id = old.id;
END;

CREATE TRIGGER businesses_fts_update AFTER UPDATE ON businesses BEGIN
  DELETE FROM businesses_fts WHERE business_id = old.id;
  INSERT INTO businesses_fts(business_id, business_name, business_description, keywords, products_services)
  VALUES (new.id, new.name, new.business_description, new.keywords, new.products_services);
END;

-- Enrichment tracking and logging tables
CREATE TABLE enrichment_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  enrichment_type TEXT NOT NULL, -- category, description, full
  status TEXT NOT NULL, -- success, error, partial
  confidence_score REAL, -- 0.0 to 1.0 for AI classification confidence
  processing_time_ms INTEGER, -- Time taken to process
  error_message TEXT,
  raw_data TEXT, -- JSON of raw scraped/extracted data
  ai_response TEXT, -- JSON of AI classification/description response
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_enrichment_logs_business_id ON enrichment_logs(business_id);
CREATE INDEX idx_enrichment_logs_status ON enrichment_logs(status);
CREATE INDEX idx_enrichment_logs_type ON enrichment_logs(enrichment_type);
CREATE INDEX idx_enrichment_logs_started ON enrichment_logs(started_at);

-- Failed enrichment retry tracking
CREATE TABLE failed_enrichments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  failure_reason TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TEXT,
  next_retry_at TEXT,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_failed_enrichments_business_id ON failed_enrichments(business_id);
CREATE INDEX idx_failed_enrichments_next_retry ON failed_enrichments(next_retry_at);
CREATE INDEX idx_failed_enrichments_retry_count ON failed_enrichments(retry_count);

-- Business taxonomy and categories reference table
CREATE TABLE business_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_category_id TEXT REFERENCES business_categories(id),
  display_name TEXT NOT NULL,
  description TEXT,
  keywords TEXT, -- JSON array of keywords for this category
  icon_name TEXT, -- Icon identifier for UI
  color_code TEXT, -- Hex color for UI theming
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_business_categories_parent ON business_categories(parent_category_id);
CREATE INDEX idx_business_categories_active ON business_categories(is_active);
CREATE INDEX idx_business_categories_sort ON business_categories(sort_order);

-- Seed primary business categories
INSERT INTO business_categories (id, name, display_name, description, sort_order) VALUES
('food_dining', 'food_dining', 'Food & Dining', 'Restaurants, cafes, bars, breweries, and food services', 1),
('retail_shopping', 'retail_shopping', 'Retail & Shopping', 'Clothing, gifts, home goods, and specialty stores', 2),
('health_wellness', 'health_wellness', 'Health & Wellness', 'Medical, dental, fitness, spa, and alternative medicine', 3),
('professional_services', 'professional_services', 'Professional Services', 'Legal, accounting, consulting, and business services', 4),
('home_services', 'home_services', 'Home Services', 'Construction, plumbing, HVAC, and home improvement', 5),
('automotive', 'automotive', 'Automotive', 'Car repair, sales, parts, and automotive services', 6),
('arts_entertainment', 'arts_entertainment', 'Arts & Entertainment', 'Galleries, theaters, music venues, and entertainment', 7),
('education_training', 'education_training', 'Education & Training', 'Schools, tutoring, workshops, and learning centers', 8),
('beauty_personal_care', 'beauty_personal_care', 'Beauty & Personal Care', 'Salons, barbers, spas, and personal care services', 9),
('financial_services', 'financial_services', 'Financial Services', 'Banking, insurance, investments, and financial advice', 10),
('real_estate', 'real_estate', 'Real Estate', 'Agents, property management, and real estate services', 11),
('technology', 'technology', 'Technology', 'IT services, software development, and tech solutions', 12),
('manufacturing_industrial', 'manufacturing_industrial', 'Manufacturing & Industrial', 'Manufacturing, industrial services, and B2B suppliers', 13),
('nonprofit_community', 'nonprofit_community', 'Non-Profit & Community', 'Non-profit organizations and community services', 14),
('other', 'other', 'Other', 'Businesses that do not fit into other categories', 99);

-- Update existing businesses to use new schema (set defaults for enrichment)
UPDATE businesses SET 
  primary_category = category,
  enrichment_status = 'pending'
WHERE primary_category IS NULL;

-- Create view for enriched businesses with category information
CREATE VIEW enriched_businesses AS
SELECT 
  b.*,
  bc.display_name as category_display_name,
  bc.description as category_description,
  bc.color_code as category_color,
  bc.icon_name as category_icon,
  CASE 
    WHEN b.enrichment_status = 'completed' THEN 1
    ELSE 0
  END as is_enriched
FROM businesses b
LEFT JOIN business_categories bc ON b.primary_category = bc.name;