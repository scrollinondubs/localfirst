#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../src/db/schema.js';
import fs from 'fs';
import path from 'path';

const setupDatabase = async () => {
  console.log('Setting up Local First Arizona database...');

  try {
    // Create database directory if it doesn't exist
    const dbDir = path.dirname('./local.db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create database client
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });

    const db = drizzle(client, { schema });

    console.log('✅ Database connection established');
    
    // Create all tables by running the schema directly
    await client.batch([
      // Businesses table
      `CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        phone TEXT,
        website TEXT,
        category TEXT NOT NULL,
        lfa_member INTEGER DEFAULT 0,
        member_since TEXT,
        verified INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Chain businesses table
      `CREATE TABLE IF NOT EXISTS chain_businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        patterns TEXT,
        category TEXT,
        parent_company TEXT,
        confidence_score INTEGER DEFAULT 100,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Analytics events table
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        extension_id TEXT,
        event_type TEXT NOT NULL,
        business_id TEXT,
        metadata TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // User sessions table
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        extension_id TEXT NOT NULL,
        session_start TEXT DEFAULT CURRENT_TIMESTAMP,
        session_end TEXT,
        total_interactions INTEGER DEFAULT 0,
        businesses_viewed INTEGER DEFAULT 0,
        filters_toggled INTEGER DEFAULT 0
      )`,
      
      // Sync logs table
      `CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL,
        records_processed INTEGER,
        records_updated INTEGER,
        records_added INTEGER,
        error_details TEXT,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )`
    ]);

    // Create performance indexes
    await client.batch([
      `CREATE INDEX IF NOT EXISTS idx_businesses_location ON businesses(latitude, longitude)`,
      `CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category)`,
      `CREATE INDEX IF NOT EXISTS idx_businesses_lfa_member ON businesses(lfa_member)`,
      `CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name)`,
      `CREATE INDEX IF NOT EXISTS idx_chain_businesses_name ON chain_businesses(name)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_business ON analytics_events(business_id)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type)`
    ]);

    console.log('✅ Database tables and indexes created successfully');
    console.log('📊 Database ready for data import');
    
    client.close();
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();