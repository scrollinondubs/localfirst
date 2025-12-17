# Database Schema Documentation

This document provides a comprehensive overview of all database tables in the Local First Arizona application.

## Table Naming Conventions

- **Table names**: Use `snake_case` (e.g., `businesses`, `user_favorites`)
- **Column names**: Use `snake_case` (e.g., `created_at`, `user_id`)
- **Foreign keys**: Named as `{referenced_table}_id` (e.g., `user_id`, `business_id`)
- **Timestamps**: Always include `created_at` and `updated_at` where applicable

## Core Business Tables

### `businesses`
**Purpose**: Stores all Local First Arizona member businesses and their information.

**Key Fields**:
- `id`: Unique identifier (UUID)
- `name`: Business name
- `address`: Full business address
- `latitude` / `longitude`: Geographic coordinates for mapping
- `category`: Legacy category field (deprecated, use `primary_category`)
- `primary_category` / `subcategory`: Modern taxonomy system
- `business_description`: Detailed business description
- `lfa_member`: Boolean indicating Local First Arizona membership
- `verified`: Boolean indicating data verification status
- `status`: Business status (`active`, `inactive`, `pending`)

**Enrichment Fields**:
- `enrichment_status`: Status of data enrichment process
- `enrichment_date`: When enrichment was completed
- `enrichment_source`: Source of enrichment data
- `business_attributes`: JSON field for special attributes (woman-owned, veteran-owned, etc.)
- `hours_of_operation`: JSON field for business hours
- `social_media_links`: JSON field for social media URLs
- `special_features`: JSON field for delivery, accessibility, etc.

**Relationships**:
- Referenced by: `user_favorites`, `enrichment_logs`, `failed_enrichments`, `concierge_recommendations`

---

### `chain_businesses`
**Purpose**: Stores chain business patterns for filtering out non-local businesses.

**Key Fields**:
- `id`: Unique identifier
- `name`: Chain business name
- `patterns`: JSON array of name patterns to match against
- `parent_company`: Parent company name
- `confidence_score`: Matching confidence (0-100)

**Usage**: Used by the Chrome extension to identify and filter out chain stores.

---

## User & Authentication Tables

### `users`
**Purpose**: Stores user accounts for the mobile app authentication system.

**Key Fields**:
- `id`: Unique identifier (UUID)
- `email`: User email (unique, used for login)
- `password_hash`: Hashed password (never store plain text)
- `name`: User's display name
- `email_verified`: Boolean indicating email verification status
- `is_active`: Boolean for account status (soft delete)
- `last_login`: Timestamp of last login

**Security Fields**:
- `reset_token`: Password reset token
- `reset_token_expiry`: Expiration time for reset token

**Relationships**:
- Referenced by: `consumer_profiles`, `user_favorites`, `conversation_sessions`, `user_preferences`, `concierge_recommendations`

---

### `consumer_profiles`
**Purpose**: Stores user preferences, saved data, and AI-generated profiles.

**Key Fields**:
- `user_id`: Foreign key to `users.id`
- `preferences`: JSON for category preferences
- `saved_searches`: JSON array of saved search queries
- `location_preferences`: JSON for preferred areas/regions

**AI Interview Fields**:
- `interview_transcript`: Full conversation history as JSON
- `interview_summary`: AI-generated summary of interests/preferences
- `interview_insights`: JSON of extracted key interests and needs
- `profile_completeness`: Score from 0-100
- `last_interview_date`: Timestamp of last interview

**Personal Dossier Fields**:
- `personal_dossier`: JSON structured dossier from AI synthesis
- `dossier_generated_at`: Timestamp of dossier creation/update
- `dossier_version`: Track regeneration count

**Note**: `favorite_businesses` field is deprecated - use `user_favorites` table instead.

---

### `user_favorites`
**Purpose**: Stores user's favorite businesses (replaces JSON approach for better performance).

**Key Fields**:
- `user_id`: Foreign key to `users.id`
- `business_id`: Foreign key to `businesses.id`
- Unique constraint on `(user_id, business_id)` to prevent duplicates

**Relationships**:
- References: `users`, `businesses`

---

## Category & Taxonomy Tables

### `business_categories`
**Purpose**: Manages the business category taxonomy system.

**Key Fields**:
- `id`: Unique identifier
- `name`: Category identifier (unique)
- `display_name`: Human-readable category name
- `parent_category_id`: Self-referencing for hierarchical categories
- `description`: Category description
- `keywords`: JSON array of keywords for this category
- `icon_name`: Icon identifier for UI
- `color_code`: Hex color for UI theming
- `sort_order`: Display order
- `is_active`: Boolean for active/inactive status

**Usage**: Used for filtering and organizing businesses by category.

---

## Analytics & Tracking Tables

### `analytics_events`
**Purpose**: Tracks user interaction events for analytics.

**Key Fields**:
- `id`: Unique identifier
- `extension_id`: Anonymous extension identifier (privacy-friendly)
- `event_type`: Type of event (`view`, `click`, `filter_toggle`, etc.)
- `business_id`: Optional reference to business involved
- `metadata`: JSON field for additional event data
- `timestamp`: When the event occurred

**Usage**: Used for understanding user behavior and improving the app.

---

### `user_sessions`
**Purpose**: Tracks user sessions for analytics aggregation.

**Key Fields**:
- `id`: Unique identifier
- `extension_id`: Anonymous extension identifier
- `session_start` / `session_end`: Session time range
- `total_interactions`: Count of interactions in session
- `businesses_viewed`: Count of businesses viewed
- `filters_toggled`: Count of filter toggles

**Usage**: Aggregates analytics data for session-level insights.

---

## Data Management Tables

### `sync_logs`
**Purpose**: Tracks synchronization operations with Local First Arizona data sources.

**Key Fields**:
- `id`: Unique identifier
- `sync_type`: Type of sync (`businesses`, `chains`, `full`)
- `status`: Sync status (`success`, `error`, `partial`)
- `records_processed`: Total records processed
- `records_updated`: Records updated
- `records_added`: New records added
- `error_details`: Error information if sync failed
- `started_at` / `completed_at`: Sync time range

**Usage**: Monitoring and debugging data synchronization processes.

---

### `enrichment_logs`
**Purpose**: Tracks business data enrichment processes (AI classification, scraping, etc.).

**Key Fields**:
- `id`: Unique identifier
- `business_id`: Foreign key to `businesses.id`
- `enrichment_type`: Type of enrichment (`category`, `description`, `full`)
- `status`: Enrichment status (`success`, `error`, `partial`)
- `confidence_score`: AI classification confidence (0.0 to 1.0)
- `processing_time_ms`: Time taken to process
- `error_message`: Error details if failed
- `raw_data`: JSON of raw scraped/extracted data
- `ai_response`: JSON of AI classification/description response

**Relationships**:
- References: `businesses`

---

### `failed_enrichments`
**Purpose**: Tracks failed enrichment attempts for retry management.

**Key Fields**:
- `id`: Unique identifier
- `business_id`: Foreign key to `businesses.id`
- `failure_reason`: Reason for failure
- `retry_count`: Number of retry attempts
- `last_retry_at`: Timestamp of last retry
- `next_retry_at`: When to retry next
- `max_retries`: Maximum retry attempts (default: 3)

**Relationships**:
- References: `businesses`

**Usage**: Manages retry logic for failed data enrichment processes.

---

## AI & Concierge Tables

### `conversation_sessions`
**Purpose**: Stores AI interview conversation sessions.

**Key Fields**:
- `id`: Unique identifier
- `user_id`: Foreign key to `users.id`
- `messages`: JSON array of conversation messages
- `session_status`: Status (`active`, `completed`, `paused`)
- `session_start` / `session_end`: Session time range
- `message_count`: Total messages in session
- `extracted_topics`: JSON array of identified interests/needs
- `last_activity`: Timestamp of last activity

**Relationships**:
- References: `users`

**Usage**: Powers the AI interview feature that helps users discover businesses.

---

### `user_preferences`
**Purpose**: Stores user preferences for AI Concierge recommendations.

**Key Fields**:
- `id`: Unique identifier
- `user_id`: Foreign key to `users.id` (unique, one preference record per user)

**Notification Settings**:
- `notification_frequency`: How often to send (`daily`, `twice_weekly`, `weekly`, `bi_weekly`, `monthly`)
- `notification_channels`: JSON for channels (`in_app`, `push`, `email`, `sms`)
- `quiet_hours`: JSON for quiet hours settings
- `preferred_days`: JSON array of preferred notification days

**Location Settings**:
- `location_settings`: JSON for home/work/current locations
- `search_radius`: Miles for regular searches (default: 15)
- `weekend_radius`: Miles for weekend/leisure searches (default: 25)

**Recommendation Tracking**:
- `last_recommendation_date`: When last recommendation was sent
- `next_recommendation_due`: When next recommendation is due
- `total_recommendations_received`: Count of recommendations received
- `results_per_notification`: Number of recommendations per notification (1-5, default: 3)

**Privacy Settings**:
- `data_usage_consent`: Boolean for data usage consent
- `profile_sharing_level`: Level of profile sharing (`minimal`, `standard`, `detailed`)

**Relationships**:
- References: `users`

---

### `concierge_recommendations`
**Purpose**: Stores AI-generated business recommendations for users.

**Key Fields**:
- `id`: Unique identifier
- `user_id`: Foreign key to `users.id`
- `business_id`: Foreign key to `businesses.id`
- `recommendation_type`: Type (`regular`, `seasonal`, `gift`, `event`, `urgent`)
- `match_score`: AI match score (0.0 to 1.0)
- `batch_id`: Groups recommendations from same cron run

**AI-Generated Content**:
- `rationale`: Human-readable explanation for recommendation
- `rationale_highlights`: JSON array of key points
- `matching_factors`: JSON breakdown of matching factors

**Delivery & Engagement Tracking**:
- `status`: Status (`pending`, `delivered`, `viewed`, `acted_on`, `dismissed`)
- `delivered_at`: When recommendation was delivered
- `viewed_at`: When user viewed recommendation
- `interacted_at`: When user interacted with recommendation

**User Feedback**:
- `feedback`: User feedback (`liked`, `disliked`, `neutral`)
- `feedback_comment`: Optional feedback comment
- `feedback_at`: When feedback was provided

**Performance Tracking**:
- `generation_time_ms`: Time to generate recommendation
- `openai_tokens_used`: OpenAI API tokens used

**Relationships**:
- References: `users`, `businesses`

---

### `recommendation_logs`
**Purpose**: Tracks AI Concierge recommendation processing runs for monitoring and debugging.

**Key Fields**:
- `id`: Unique identifier
- `batch_id`: Unique identifier for this processing batch

**Processing Metrics**:
- `users_processed`: Number of users processed
- `users_eligible`: Number of eligible users
- `recommendations_generated`: Total recommendations generated
- `processing_time_ms`: Total processing time

**Error Tracking**:
- `errors`: JSON array of error objects
- `error_count`: Total error count

**Resource Usage**:
- `total_tokens_used`: Total OpenAI tokens used
- `estimated_cost`: Estimated cost in USD

**Performance Stats**:
- `avg_match_score`: Average match score across recommendations
- `avg_generation_time`: Average generation time

**Status**:
- `status`: Processing status (`running`, `completed`, `failed`)
- `started_at` / `completed_at`: Processing time range

**Usage**: Monitors cron job performance and costs.

---

## Support & Feedback Tables

### `support_tickets`
**Purpose**: Stores user bug reports and feedback submissions.

**Key Fields**:
- `id`: Unique identifier (UUID)
- `ticket_number`: 6-digit ticket number (unique, for bug reports)
- `type`: Ticket type (`bug-report`, `general-feedback`)
- `user_id`: Optional foreign key to `users.id` (if user is logged in)
- `email`: User email address
- `subject`: Optional subject line (for bug reports)
- `description`: Full description of issue or feedback
- `status`: Ticket status (`open`, `in-progress`, `resolved`, `closed`)
- `admin_response`: Admin response to ticket
- `responded_at`: When admin responded

**Relationships**:
- References: `users` (optional, for logged-in users)

**Usage**: 
- Bug reports: Users report issues with the app
- General feedback: Users provide suggestions and feedback
- If `user_id` is provided, the ticket is linked to the user account
- Anonymous users can still submit tickets (user_id will be null)

**Email Integration**: Confirmation emails are sent when tickets are created.

---

## Indexes

All tables have appropriate indexes for:
- Primary keys (automatic)
- Foreign keys
- Frequently queried fields (e.g., `ticket_number`, `email`, `status`)
- Timestamp fields for sorting

---

## Data Types

- **Text**: Used for strings, JSON data, UUIDs, and timestamps (stored as ISO 8601 strings)
- **Integer**: Used for counts, scores, and boolean values (with `{ mode: 'boolean' }`)
- **Real**: Used for decimal numbers (coordinates, scores, costs)

---

## Timestamps

All tables use ISO 8601 string format for timestamps:
- `created_at`: Automatically set to `CURRENT_TIMESTAMP` on creation
- `updated_at`: Should be updated on modification (some tables auto-update)

---

## Foreign Key Constraints

All foreign keys use `onDelete: 'cascade'` to ensure data integrity:
- When a referenced record is deleted, related records are automatically deleted
- This prevents orphaned records

---

## JSON Fields

Many tables use JSON fields for flexible data storage:
- Always validate JSON structure in application code
- Use consistent JSON schemas for the same field across the app
- Document JSON structure in code comments

---

## Migration Strategy

- All schema changes go through migration files in `/migrations/`
- Migration files are numbered sequentially (e.g., `0001_initial_schema.sql`)
- Always test migrations on a copy of production data before applying

---

## Common Queries

### Get all businesses
```sql
SELECT * FROM businesses WHERE status = 'active' ORDER BY name;
```

### Get user favorites
```sql
SELECT b.* FROM businesses b
JOIN user_favorites uf ON b.id = uf.business_id
WHERE uf.user_id = ?;
```

### Get open support tickets
```sql
SELECT * FROM support_tickets 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

### Get recent recommendations
```sql
SELECT cr.*, b.name, b.address 
FROM concierge_recommendations cr
JOIN businesses b ON cr.business_id = b.id
WHERE cr.user_id = ? AND cr.status = 'delivered'
ORDER BY cr.delivered_at DESC;
```

---

## Maintenance Notes

- **Regular backups**: Database should be backed up regularly
- **Index maintenance**: Monitor query performance and add indexes as needed
- **JSON validation**: Validate JSON fields on insert/update
- **Soft deletes**: Use `is_active` or `status` fields instead of hard deletes where possible
- **Audit trail**: `created_at` and `updated_at` fields provide basic audit trail

---

## Questions?

For questions about the schema, contact the development team or refer to the code comments in `/src/db/schema.js`.

