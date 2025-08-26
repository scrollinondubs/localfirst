-- Drop all existing tables in correct order to handle foreign keys
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS conversation_sessions;
DROP TABLE IF EXISTS consumer_profiles;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS concierge_recommendations;
DROP TABLE IF EXISTS sync_logs;
DROP TABLE IF EXISTS enrichment_logs;
DROP TABLE IF EXISTS failed_enrichments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS chain_businesses;
DROP TABLE IF EXISTS business_categories;
DROP TABLE IF EXISTS businesses;
DROP TABLE IF EXISTS businesses_fts;
DROP TABLE IF EXISTS businesses_fts_config;
DROP TABLE IF EXISTS businesses_fts_content;
DROP TABLE IF EXISTS businesses_fts_data;
DROP TABLE IF EXISTS businesses_fts_docsize;
DROP TABLE IF EXISTS businesses_fts_idx;

SELECT 'All tables dropped successfully' as status;