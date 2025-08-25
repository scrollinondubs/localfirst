-- Add results_per_notification field to user_preferences table

ALTER TABLE user_preferences ADD COLUMN results_per_notification INTEGER DEFAULT 3;