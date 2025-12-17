# Support System - Complete Explanation

This document explains how the bug report and feedback system works, from the database schema to email sending.

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [API Endpoints](#api-endpoints)
3. [Email System](#email-system)
4. [Frontend Integration](#frontend-integration)
5. [Why No Emails in Local Development](#why-no-emails-in-local-development)
6. [Production Setup](#production-setup)

---

## 🗄️ Database Schema

### Table: `support_tickets`

The `support_tickets` table stores both bug reports and general feedback in a single table, differentiated by the `type` field.

#### Schema Structure

```sql
CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY,                    -- UUID for the ticket
  ticket_number TEXT NOT NULL UNIQUE,     -- 6-digit number for bugs, FB-{timestamp} for feedback
  type TEXT NOT NULL,                     -- 'bug-report' or 'general-feedback'
  user_id TEXT,                           -- Optional: links to users table (if user is logged in)
  email TEXT NOT NULL,                    -- User's email (required for confirmations)
  subject TEXT,                           -- Optional subject (mainly for bug reports)
  description TEXT NOT NULL,              -- Full description of issue/feedback
  status TEXT DEFAULT 'open',              -- 'open', 'in-progress', 'resolved', 'closed'
  admin_response TEXT,                    -- Admin's response to the ticket
  responded_at TEXT,                      -- When admin responded
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Key Design Decisions

1. **Single Table for Both Types**: Bug reports and feedback share the same structure, differentiated by `type` field
   - **Bug Reports**: Get a 6-digit ticket number (e.g., `123456`)
   - **Feedback**: Get a timestamp-based ID (e.g., `FB-1765984778930`)

2. **Optional User Linking**: 
   - `user_id` is nullable because anonymous users can submit tickets
   - If a user is logged in, their `user_id` is stored for tracking
   - Foreign key relationship: `user_id → users.id`

3. **Email Required**: 
   - Email is required for bug reports (for ticket tracking)
   - Email is optional for feedback (can be 'anonymous')

4. **Status Workflow**:
   ```
   open → in-progress → resolved → closed
   ```

#### Indexes

For performance, we have indexes on:
- `ticket_number` (for quick lookups)
- `email` (for admin queries)
- `status` (for filtering)
- `user_id` (for user-specific queries)

---

## 🔌 API Endpoints

### 1. POST `/api/support/bug-report`

**Purpose**: Submit a bug report

**Request Body**:
```json
{
  "email": "user@example.com",        // Required
  "description": "Bug description",   // Required
  "userId": "user-uuid-here"           // Optional: if user is logged in
}
```

**Process Flow**:
1. Validates email format
2. Validates required fields (email, description)
3. Generates unique 6-digit ticket number
4. Creates ticket in database
5. Sends confirmation email
6. Returns ticket number

**Response**:
```json
{
  "success": true,
  "ticketNumber": "123456",
  "message": "Bug report submitted successfully"
}
```

### 2. POST `/api/support/feedback`

**Purpose**: Submit general feedback

**Request Body**:
```json
{
  "email": "user@example.com",        // Optional
  "description": "Feedback text",    // Required
  "userId": "user-uuid-here"          // Optional: if user is logged in
}
```

**Process Flow**:
1. Validates description (required)
2. Validates email format (if provided)
3. Creates feedback entry with `FB-{timestamp}` ticket number
4. Sends confirmation email (only if email provided)
5. Returns success message

**Response**:
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

### 3. GET `/api/support/ticket/:ticketNumber`

**Purpose**: Check ticket status

**Response**:
```json
{
  "ticket": {
    "ticketNumber": "123456",
    "type": "bug-report",
    "status": "open",
    "description": "...",
    "createdAt": "2025-12-17T...",
    "adminResponse": null
  }
}
```

---

## 📧 Email System

### How Email Sending Works

The email system uses **MailChannels API** for Cloudflare Workers, but has different behavior in development vs production.

#### Email Function: `sendEmail()`

Located in `/src/routes/support.js`

```javascript
async function sendEmail(to, subject, htmlBody, env) {
  // 1. Check if we're in development mode
  if (env.NODE_ENV === 'development' || !env.SUPPORT_EMAIL) {
    // Local development: Just log the email
    console.log('📧 Email would be sent (local dev mode):');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', htmlBody);
    return true; // Simulate success
  }

  // 2. Production: Send via MailChannels API
  const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: {
        email: env.SUPPORT_EMAIL || 'noreply@localfirst.site',
        name: 'Local First Arizona',
      },
      subject: subject,
      content: [{ type: 'text/html', value: htmlBody }],
    }),
  });

  return emailResponse.ok;
}
```

### Email Templates

#### Bug Report Confirmation Email

**Subject**: `Bug Report Received - Ticket #[NUMBER]`

**Content**:
- Thank you message
- **Ticket number highlighted** in a box
- Instructions to save the ticket number
- Note about email confirmation

**Example**:
```
Thank You for Reporting a Bug

We have received your bug report and have created a ticket for tracking.

Ticket Number: 123456

Please save this ticket number to track the status of your report.
Our team is working on it and will update you as soon as possible.
```

#### Feedback Confirmation Email

**Subject**: `Thank You for Your Feedback`

**Content**:
- Appreciation message
- Confirmation that feedback was received
- Note about using feedback to improve

**Example**:
```
Thank You for Your Feedback

We have received your feedback and truly appreciate you taking 
the time to help us improve.

Your input is valuable to us and will be reviewed by our team.
```

---

## 🖥️ Frontend Integration

### Component: `SupportChat.js`

Located in `/packages/mobile/components/SupportChat.js`

#### Flow

1. **User clicks help icon** → Opens support popup
2. **User selects "Report a Bug" or "General Feedback"**
3. **User fills form**:
   - Email (required for bugs, optional for feedback)
   - Description (required)
4. **User clicks "Submit"**:
   - Frontend validates email format
   - Shows loading indicator
   - Calls API endpoint
5. **API responds**:
   - Success → Shows success message with ticket number
   - Error → Shows error message

#### API Call Example

```javascript
const response = await fetch(buildApiUrl('/api/support/bug-report'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: email.trim(),
    description: issueDescription.trim(),
    userId: currentUserId || undefined, // If user is logged in
  }),
});
```

#### Success Message Display

Instead of using `Alert.alert()` (which doesn't work well on web), we use a **custom success view**:
- Green checkmark icon
- "Thank You!" title
- Custom message with ticket number
- "OK" button to close

---

## 🚫 Why No Emails in Local Development?

### Reasons

1. **No Email Service Configured**
   - Local development doesn't have MailChannels API access
   - MailChannels requires Cloudflare Workers environment
   - No SMTP server configured locally

2. **Avoid Spam During Development**
   - Developers test frequently → would send many emails
   - Don't want to spam real email addresses
   - Don't want to hit email service rate limits

3. **Faster Development**
   - Email sending adds latency
   - Logging is instant
   - Easier to debug without waiting for emails

4. **Cost Savings**
   - Email services often charge per email
   - Development testing would incur costs
   - Logging is free

### How It Works Locally

When you submit a bug report or feedback in local development:

1. **Ticket is created** in the database ✅
2. **Email is logged** to console (not sent) 📝
3. **Success message** is shown to user ✅

**Console Output Example**:
```
📧 Email would be sent (local dev mode):
To: user@example.com
Subject: Bug Report Received - Ticket #123456
Body: <HTML email content>
```

### How to Test Emails Locally

If you want to test actual email sending locally, you have a few options:

#### Option 1: Use a Test Email Service
- Use services like [Mailtrap](https://mailtrap.io/) or [MailHog](https://github.com/mailhog/MailHog)
- Configure SMTP in your local environment
- Modify `sendEmail()` to use SMTP in development

#### Option 2: Use Development Email API Key
- Get a MailChannels API key for development
- Set `SUPPORT_EMAIL` environment variable
- Emails will be sent (but use a test domain)

#### Option 3: Check Production
- Deploy to Cloudflare Workers
- Test in production environment
- Emails will be sent normally

---

## 🚀 Production Setup

### Requirements

1. **Cloudflare Workers Environment**
   - MailChannels API works with Cloudflare Workers
   - No additional setup needed for MailChannels

2. **Environment Variables**
   ```bash
   SUPPORT_EMAIL=noreply@localfirst.site  # Your sending email
   NODE_ENV=production
   ```

3. **MailChannels Configuration**
   - MailChannels is automatically available in Cloudflare Workers
   - No API key needed
   - Just set the `from` email address

### Production Email Flow

1. User submits ticket → API creates ticket in database
2. API calls `sendEmail()` → Checks `NODE_ENV === 'production'`
3. API calls MailChannels → Sends email via `https://api.mailchannels.net/tx/v1/send`
4. User receives email → Confirmation with ticket number

### Email Delivery

- **MailChannels**: Free for Cloudflare Workers
- **Delivery**: Usually instant
- **Reliability**: High (handled by Cloudflare infrastructure)
- **Rate Limits**: Generous for typical usage

---

## 📊 Complete Flow Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Clicks "Report a Bug"
       │    Fills form (email, description)
       │
       ▼
┌─────────────────┐
│  SupportChat.js  │
│   (Frontend)     │
└──────┬───────────┘
       │
       │ 2. POST /api/support/bug-report
       │    { email, description, userId? }
       │
       ▼
┌─────────────────┐
│  support.js     │
│  (API Route)    │
└──────┬───────────┘
       │
       │ 3. Validate email & description
       │ 4. Generate ticket number
       │
       ▼
┌─────────────────┐
│   Database      │
│ support_tickets  │
└──────┬───────────┘
       │
       │ 5. Insert ticket
       │    (id, ticket_number, type, user_id, email, description)
       │
       ▼
┌─────────────────┐
│  sendEmail()    │
└──────┬───────────┘
       │
       ├─ Development: Log to console
       │
       └─ Production: Send via MailChannels
          │
          ▼
    ┌─────────────┐
    │ MailChannels│
    │     API     │
    └──────┬──────┘
           │
           │ 6. Deliver email
           │
           ▼
    ┌─────────────┐
    │ User's Email│
    │   Inbox     │
    └─────────────┘
```

---

## 🔍 Database Queries

### Get All Open Tickets
```sql
SELECT * FROM support_tickets 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

### Get Tickets for a User
```sql
SELECT * FROM support_tickets 
WHERE user_id = 'user-uuid-here';
```

### Get Tickets with User Info
```sql
SELECT 
  st.*,
  u.email as user_email,
  u.name as user_name
FROM support_tickets st
LEFT JOIN users u ON st.user_id = u.id
WHERE st.status = 'open';
```

### Count Tickets by Type
```sql
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count
FROM support_tickets
GROUP BY type;
```

---

## ✅ Summary

1. **Database**: Single `support_tickets` table stores both bugs and feedback
2. **API**: Two endpoints (`/bug-report`, `/feedback`) handle submissions
3. **Email**: MailChannels API in production, console logging in development
4. **Frontend**: Custom success messages, no browser alerts
5. **User Linking**: Optional `user_id` links tickets to user accounts
6. **Local Dev**: Emails logged, not sent (to avoid spam and costs)

The system is designed to work seamlessly in both development and production, with appropriate behavior for each environment.

