# Database Quick Reference Guide

This is a quick reference for new team members. For detailed documentation, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

## Most Common Tables

### Core Tables
- **`businesses`** - All Local First Arizona member businesses
- **`users`** - User accounts for mobile app
- **`user_favorites`** - User's favorite businesses
- **`support_tickets`** - Bug reports and feedback

### Category & Taxonomy
- **`business_categories`** - Business category taxonomy
- **`chain_businesses`** - Chain store patterns for filtering

### AI & Recommendations
- **`consumer_profiles`** - User preferences and AI-generated profiles
- **`concierge_recommendations`** - AI-generated business recommendations
- **`conversation_sessions`** - AI interview conversations

## Quick Commands

### Check Support Tickets
```bash
cd packages/api
npm run support:check      # View all tickets
npm run support:count      # Quick count
```

### Database Queries
```bash
cd packages/api
sqlite3 local.db "SELECT * FROM businesses LIMIT 5;" -header -column
sqlite3 local.db "SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 10;" -header -column
```

### View Schema
```bash
cd packages/api
sqlite3 local.db ".schema" | less
sqlite3 local.db ".schema support_tickets"
```

## Common Patterns

### Get User's Favorites
```sql
SELECT b.* FROM businesses b
JOIN user_favorites uf ON b.id = uf.business_id
WHERE uf.user_id = 'user-id-here';
```

### Get Open Support Tickets
```sql
SELECT * FROM support_tickets 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

### Get Active Businesses
```sql
SELECT * FROM businesses 
WHERE status = 'active' AND lfa_member = 1
ORDER BY name;
```

## Field Naming

- **IDs**: Always `id` (UUID text)
- **Foreign Keys**: `{table}_id` (e.g., `user_id`, `business_id`)
- **Timestamps**: `created_at`, `updated_at`, `{action}_at`
- **Status Fields**: `status` (text) or `is_{condition}` (boolean)
- **JSON Fields**: Usually plural (e.g., `preferences`, `attributes`)

## Important Notes

1. **Never store plain text passwords** - Always use `password_hash`
2. **Use soft deletes** - Use `status` or `is_active` instead of deleting records
3. **Validate JSON fields** - Always validate JSON structure on insert/update
4. **Cascade deletes** - Foreign keys automatically delete related records
5. **Timestamps are ISO strings** - Not Unix timestamps

## Need Help?

- See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for full documentation
- Check `/src/db/schema.js` for table definitions and comments
- Ask the development team for clarification

