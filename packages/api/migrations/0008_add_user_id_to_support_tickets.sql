-- Add user_id foreign key to support_tickets table
-- This allows linking tickets to user accounts when users are logged in

-- Add user_id column (nullable, since anonymous users can also submit tickets)
ALTER TABLE support_tickets ADD COLUMN user_id TEXT;

-- Add foreign key constraint
-- Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we'll need to recreate the table
-- For existing databases, this migration handles the column addition
-- The foreign key relationship is enforced at the application level via Drizzle ORM

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);

