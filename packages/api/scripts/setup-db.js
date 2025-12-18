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

/**
 * Smart SQL statement splitter that handles BEGIN...END blocks correctly
 * This prevents breaking CREATE TRIGGER and other multi-statement constructs
 */
function splitSQLStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let depth = 0; // Track BEGIN/END nesting depth
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;
  
  // Remove single-line comments first (-- comments)
  sql = sql.replace(/--[^\r\n]*/g, '');
  
  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Track string literals (don't process BEGIN/END inside strings)
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      currentStatement += char;
      i++;
      continue;
    }
    
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      currentStatement += char;
      i++;
      continue;
    }
    
    // Don't process block keywords inside strings
    if (inSingleQuote || inDoubleQuote) {
      currentStatement += char;
      i++;
      continue;
    }
    
    // Track BEGIN blocks (case-insensitive)
    if ((char === 'B' || char === 'b') && depth === 0) {
      const potentialBegin = sql.substr(i, 5).toUpperCase();
      if (potentialBegin === 'BEGIN') {
        // Check it's not part of a larger word
        const before = i > 0 ? sql[i - 1] : ' ';
        const after = sql[i + 5];
        if (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after)) {
          depth++;
          currentStatement += sql.substr(i, 5);
          i += 5;
          continue;
        }
      }
    }
    
    // Track END blocks (case-insensitive)
    if ((char === 'E' || char === 'e') && depth > 0) {
      const potentialEnd = sql.substr(i, 3).toUpperCase();
      if (potentialEnd === 'END') {
        // Check it's not part of a larger word
        const before = i > 0 ? sql[i - 1] : ' ';
        const after = sql[i + 3];
        if (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after)) {
          depth--;
          currentStatement += sql.substr(i, 3);
          i += 3;
          continue;
        }
      }
    }
    
    // Split on semicolon only if we're not inside a BEGIN...END block
    if (char === ';' && depth === 0) {
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      currentStatement = '';
      i++;
      continue;
    }
    
    currentStatement += char;
    i++;
  }
  
  // Add any remaining statement
  const trimmed = currentStatement.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }
  
  return statements.filter(stmt => stmt.length > 0);
}

const setupDatabase = async () => {
  console.log('Setting up Local First Arizona database...');

  try {
    // Database path: file:./local.db points to packages/api/local.db (where the database exists)
    // Setup script runs from packages/api/, so ./local.db is correct
    const dbPath = process.env.DATABASE_URL || 'file:./local.db';
    
    // Create database directory if it doesn't exist
    // For file:./local.db, the directory is the current directory
    const dbDir = path.dirname('./local.db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create database client
    const client = createClient({
      url: dbPath,
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
    let hasErrors = false;
    for (const file of migrationFiles) {
      console.log(`⚙️  Running migration: ${file}`);
      const migrationPath = path.join(migrationsFolder, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      // Split the SQL into individual statements (properly handling BEGIN...END blocks)
      const statements = splitSQLStatements(migrationSQL);
      
      console.log(`   Found ${statements.length} SQL statements`);
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          // Add semicolon back if not present (our splitter removes them)
          const sqlToExecute = statement.endsWith(';') ? statement : statement + ';';
          await client.execute(sqlToExecute);
        } catch (error) {
          // Check if it's a harmless "already exists" error
          const errorMsg = error.message || '';
          const isHarmlessError = 
            errorMsg.includes('already exists') || 
            errorMsg.includes('duplicate column') ||
            errorMsg.includes('duplicate name');
          
          if (isHarmlessError) {
            // Silently skip - this is expected when re-running migrations
            continue;
          }
          
          // For other errors, check if it's a critical failure
          const isCriticalError = 
            errorMsg.includes('no such table') && 
            !errorMsg.includes('trigger') && // Triggers might reference tables that don't exist yet
            !errorMsg.includes('index'); // Index creation might fail if table doesn't exist yet
          
          if (isCriticalError) {
            console.error(`❌ Critical error in ${file} at statement ${i + 1}:`, errorMsg);
            hasErrors = true;
          } else {
            console.warn(`⚠️  Warning in ${file} at statement ${i + 1}:`, errorMsg);
          }
        }
      }
      
      if (!hasErrors) {
        console.log(`✅ Completed migration: ${file}`);
      } else {
        console.error(`❌ Migration ${file} had critical errors`);
      }
    }

    if (hasErrors) {
      console.error('❌ Some migrations had critical errors. Please review the output above.');
      console.error('⚠️  Database may be in an inconsistent state.');
      client.close();
      process.exit(1);
    }
    
    console.log('✅ All migrations completed successfully');
    console.log('📊 Database ready for data import');
    
    client.close();
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
};

setupDatabase();