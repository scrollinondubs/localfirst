-- Support tickets and feedback table
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'bug-report', 'general-feedback'
  user_id TEXT, -- Optional: foreign key to users table (if user is logged in)
  email TEXT NOT NULL,
  subject TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'in-progress', 'resolved', 'closed'
  admin_response TEXT,
  responded_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index on ticket_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);

-- Create index on email for admin queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON support_tickets(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Create index on user_id for faster lookups (for linking to user accounts)
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);

