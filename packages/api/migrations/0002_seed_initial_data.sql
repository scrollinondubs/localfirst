-- Migration 0002: Seed initial data
-- Note: This will be populated with actual business data during deployment

-- Insert some initial chain business patterns for filtering
INSERT OR IGNORE INTO chain_businesses (id, name, patterns, category, parent_company, confidence_score) VALUES
('chain-mcdonalds', 'McDonald''s', '["McDonald''s", "McDonalds", "Mc Donald''s"]', 'Fast Food', 'McDonald''s Corporation', 100),
('chain-starbucks', 'Starbucks', '["Starbucks", "Starbucks Coffee"]', 'Coffee', 'Starbucks Corporation', 100),
('chain-subway', 'Subway', '["Subway", "Subway Restaurant"]', 'Fast Food', 'Subway IP LLC', 100),
('chain-walmart', 'Walmart', '["Walmart", "Wal-Mart", "Walmart Supercenter"]', 'Retail', 'Walmart Inc.', 100),
('chain-target', 'Target', '["Target", "Target Store"]', 'Retail', 'Target Corporation', 100),
('chain-costco', 'Costco', '["Costco", "Costco Wholesale"]', 'Retail', 'Costco Wholesale Corporation', 100),
('chain-home-depot', 'Home Depot', '["Home Depot", "The Home Depot"]', 'Home Improvement', 'The Home Depot Inc.', 100),
('chain-lowes', 'Lowe''s', '["Lowe''s", "Lowes", "Lowe''s Home Improvement"]', 'Home Improvement', 'Lowe''s Companies Inc.', 100),
('chain-cvs', 'CVS Pharmacy', '["CVS", "CVS Pharmacy", "CVS/pharmacy"]', 'Pharmacy', 'CVS Health Corporation', 100),
('chain-walgreens', 'Walgreens', '["Walgreens", "Walgreens Pharmacy"]', 'Pharmacy', 'Walgreens Boots Alliance', 100);

-- Insert initial sync log entry
INSERT OR IGNORE INTO sync_logs (id, sync_type, status, records_processed, started_at, completed_at) VALUES
('init-migration', 'initial', 'success', 0, datetime('now'), datetime('now'));

-- Note: Business data will be imported via separate scripts during deployment
-- The businesses table will be populated with actual LocalFirst Arizona data