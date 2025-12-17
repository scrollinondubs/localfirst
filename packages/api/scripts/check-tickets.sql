-- Quick query to check support tickets and feedback
-- Usage: sqlite3 local.db < scripts/check-tickets.sql

-- Show all tickets with details
SELECT 
  ticket_number as 'Ticket #',
  type as 'Type',
  email as 'Email',
  status as 'Status',
  substr(description, 1, 60) as 'Description Preview',
  datetime(created_at) as 'Created At'
FROM support_tickets
ORDER BY created_at DESC
LIMIT 20;

-- Show summary counts
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count
FROM support_tickets
GROUP BY type;

