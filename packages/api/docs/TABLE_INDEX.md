# Database Table Index

Complete list of all database tables with their primary purpose.

## Core Business Tables

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `businesses` | Stores all Local First Arizona member businesses | Referenced by: user_favorites, enrichment_logs, concierge_recommendations |
| `chain_businesses` | Chain store patterns for filtering non-local businesses | Used by Chrome extension |

## User & Authentication

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `users` | User accounts for mobile app authentication | Referenced by: consumer_profiles, user_favorites, conversation_sessions, user_preferences, concierge_recommendations |
| `consumer_profiles` | User preferences, saved data, AI-generated profiles | References: users |
| `user_favorites` | User's favorite businesses (replaces JSON approach) | References: users, businesses |

## Category & Taxonomy

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `business_categories` | Business category taxonomy system | Self-referencing (hierarchical) |

## Analytics & Tracking

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `analytics_events` | User interaction events for analytics | Optional: businesses |
| `user_sessions` | User sessions for analytics aggregation | Uses extension_id |

## Data Management

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `sync_logs` | Tracks synchronization operations | None |
| `enrichment_logs` | Tracks business data enrichment processes | References: businesses |
| `failed_enrichments` | Failed enrichment attempts for retry management | References: businesses |

## AI & Concierge

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `conversation_sessions` | AI interview conversation sessions | References: users |
| `user_preferences` | User preferences for AI Concierge | References: users (unique) |
| `concierge_recommendations` | AI-generated business recommendations | References: users, businesses |
| `recommendation_logs` | AI Concierge processing logs | None |

## Support & Feedback

| Table Name | Purpose | Key Relationships |
|------------|---------|-------------------|
| `support_tickets` | User bug reports and feedback | References: users (optional) |

## Total: 15 Tables

All tables follow consistent naming conventions:
- **snake_case** for table and column names
- **Timestamps**: `created_at`, `updated_at`
- **Foreign keys**: `{table}_id`
- **Status fields**: `status` or `is_{condition}`

## See Also

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Comprehensive documentation
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick reference guide
- `/src/db/schema.js` - Schema definitions with inline comments

