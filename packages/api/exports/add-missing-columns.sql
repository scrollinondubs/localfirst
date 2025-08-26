-- Add missing columns to businesses table
ALTER TABLE businesses ADD COLUMN primary_category TEXT;
ALTER TABLE businesses ADD COLUMN subcategory TEXT;
ALTER TABLE businesses ADD COLUMN business_description TEXT;
ALTER TABLE businesses ADD COLUMN products_services TEXT;
ALTER TABLE businesses ADD COLUMN keywords TEXT;
ALTER TABLE businesses ADD COLUMN enrichment_status TEXT DEFAULT 'pending';
ALTER TABLE businesses ADD COLUMN enrichment_date TEXT;
ALTER TABLE businesses ADD COLUMN enrichment_source TEXT;
ALTER TABLE businesses ADD COLUMN business_attributes TEXT;
ALTER TABLE businesses ADD COLUMN hours_of_operation TEXT;
ALTER TABLE businesses ADD COLUMN social_media_links TEXT;
ALTER TABLE businesses ADD COLUMN special_features TEXT;
