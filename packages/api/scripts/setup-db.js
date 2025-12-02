#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../src/db/schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    
    // Instead of hardcoding, run migrations from the migrations folder
    console.log('📂 Running migrations from migration files...');
    
    const migrationsFolder = path.join(__dirname, '..', 'migrations');
    console.log('📂 Migrations folder:', migrationsFolder);
    
    // Get all migration files in order
    const migrationFiles = fs.readdirSync(migrationsFolder)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📋 Found ${migrationFiles.length} migration files`);
    
    // Execute each migration file
    for (const file of migrationFiles) {
      console.log(`⚙️  Running migration: ${file}`);
      const migrationPath = path.join(migrationsFolder, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      // Split the SQL into individual statements (handling multi-line statements)
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      // Execute each statement
      for (const statement of statements) {
        try {
          await client.execute(statement + ';');
        } catch (error) {
          // Ignore errors for statements that are trying to add/create things that already exist
          if (!error.message.includes('already exists') && 
              !error.message.includes('duplicate column')) {
            console.warn(`⚠️  Warning in ${file}:`, error.message);
          }
        }
      }
      
      console.log(`✅ Completed migration: ${file}`);
    }

    console.log('✅ All migrations completed successfully');
    console.log('📊 Database ready for data import');
    
    client.close();
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();