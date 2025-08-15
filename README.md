# Local First Arizona Chrome Extension

A Chrome extension and backend API system to promote locally-owned businesses over chain stores in Google Maps searches.

## 📋 Project Overview

This project consists of three main components:
- **Chrome Extension**: Client-side extension for Google Maps manipulation
- **Backend API**: Stateless web service for business data and analytics
- **Admin Dashboard**: Management interface for LFA staff

## 🏗️ Architecture

```
local-first-extension/
├── packages/
│   ├── extension/          # Chrome Extension
│   ├── api/               # Backend API (Hono.js + SQLite)
│   └── dashboard/         # Admin Dashboard (Next.js)
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
└── temp/                  # Temporary data files
```

## 🚀 Quick Start

### Database Setup

The database has been successfully set up with:
- **5,146 Local First Arizona member businesses** imported
- **32 major chain businesses** in the blocklist
- **Full geographic indexing** for Arizona locations

### Starting the API Server

To test the Chrome extension locally, start the Node.js API server:

```bash
# From the project root
cd packages/api
node temp-server.js

# Or using the full path
WORKING_DIR=/Users/sean/NodeJSprojs/localfirst/packages/api node /Users/sean/NodeJSprojs/localfirst/packages/api/temp-server.js
```

The API server will run on **http://localhost:8787** and provide:
- `/api/businesses/nearby` - Search for nearby LFA businesses
- `/api/chains` - Get chain business patterns for filtering
- `/api/analytics/events` - Track extension usage events

### Available Commands

```bash
# Database management
npm run db:setup     # Create database tables and indexes
npm run db:import    # Import businesses from CSV
npm run db:chains    # Seed chain businesses blocklist  
npm run db:seed      # Full database seeding
npm run db:verify    # Verify database setup
npm run db:reset     # Reset and re-seed database

# Development
npm run dev          # Start all development servers
npm run build        # Build all packages
```

## 📊 Database Summary

✅ **Database Ready for Development**

- **Businesses Table**: 5,146 records
  - All marked as LFA members
  - Categories: Restaurant (392), Professional Services (361), Other (4,393)
  - Full address and coordinate data
  - Geographic indexing for fast location queries

- **Chain Businesses Table**: 32 records  
  - Major retail chains (Walmart, Target, Best Buy, etc.)
  - Restaurant chains (McDonald's, Starbucks, Chipotle, etc.)
  - Service chains (H&R Block, Jiffy Lube, etc.)
  - Pattern matching for name variations

- **Analytics Tables**: Ready for extension usage tracking


## 📁 Key Files Created

### Database Schema & Scripts
- `packages/api/src/db/schema.js` - Database schema definition
- `packages/api/src/db/index.js` - Database connection
- `packages/api/scripts/setup-db.js` - Database initialization
- `packages/api/scripts/import-businesses.js` - CSV import script
- `packages/api/scripts/seed-chains.js` - Chain businesses seed
- `packages/api/scripts/verify-database.js` - Verification script

### Configuration
- `packages/api/package.json` - API package configuration
- `packages/api/drizzle.config.js` - Drizzle ORM configuration  
- `packages/api/.env.example` - Environment template

## 🔧 Tech Stack

- **Database**: SQLite with Drizzle ORM
- **API Framework**: Hono.js (ready for Cloudflare Workers)
- **Extension**: Vanilla JavaScript (Manifest V3)
- **Dashboard**: Next.js 14 + Tailwind CSS



## 📝 Notes

- All businesses imported from the CSV are marked as LFA members
- Geographic coordinates use approximate city centers with variation
- Chain business patterns support fuzzy matching
- Database includes performance indexes for fast queries
- Full verification shows all systems operational

---
