#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path
const dbPath = path.resolve(__dirname, '../../../local.db');
const exportPath = path.resolve(__dirname, '../exports/d1-simple.sql');

// Ensure exports directory exists
const exportsDir = path.dirname(exportPath);
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

console.log(`Exporting data from ${dbPath} to ${exportPath}`);

const Database = sqlite3.verbose().Database;
const db = new Database(dbPath);

let sqlExport = `-- LocalFirst Arizona Production Database Export (D1 Compatible)
-- Generated: ${new Date().toISOString()}

-- Clear existing data (in correct order to avoid foreign key issues)
DELETE FROM analytics_events;
DELETE FROM user_favorites;
DELETE FROM user_sessions;
DELETE FROM conversation_sessions;
DELETE FROM consumer_profiles;
DELETE FROM user_preferences;
DELETE FROM concierge_recommendations;
DELETE FROM sync_logs;
DELETE FROM enrichment_logs;
DELETE FROM failed_enrichments;
DELETE FROM users;
DELETE FROM chain_businesses;
DELETE FROM business_categories;
DELETE FROM businesses;

`;

const tables = [
  'users',
  'businesses', 
  'business_categories',
  'chain_businesses',
  'user_preferences',
  'consumer_profiles',
  'conversation_sessions',
  'concierge_recommendations',
  'analytics_events',
  'enrichment_logs'
];

let processedTables = 0;

function processTable(tableName) {
  return new Promise((resolve, reject) => {
    console.log(`Exporting table: ${tableName}`);
    
    db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
      if (err) {
        console.error(`Error reading table ${tableName}:`, err.message);
        resolve(); // Continue with other tables
        return;
      }

      if (rows.length === 0) {
        console.log(`  -> Table ${tableName} is empty, skipping`);
        resolve();
        return;
      }

      // Get column information
      db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
          console.error(`Error getting table info for ${tableName}:`, err.message);
          resolve();
          return;
        }

        const columnNames = columns.map(col => col.name);
        
        sqlExport += `\n-- Data for table: ${tableName}\n`;
        
        rows.forEach(row => {
          const values = columnNames.map(col => {
            const value = row[col];
            if (value === null || value === undefined) {
              return 'NULL';
            } else if (typeof value === 'string') {
              return `'${value.replace(/'/g, "''")}'`;
            } else {
              return value;
            }
          });
          
          sqlExport += `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${values.join(', ')});\n`;
        });
        
        console.log(`  -> Exported ${rows.length} rows from ${tableName}`);
        resolve();
      });
    });
  });
}

async function exportAllTables() {
  for (const table of tables) {
    try {
      await processTable(table);
      processedTables++;
    } catch (error) {
      console.error(`Failed to process table ${table}:`, error);
    }
  }
  
  sqlExport += `\n-- Export complete\nSELECT 'Export completed successfully' as status;\n`;
  
  // Write to file
  fs.writeFileSync(exportPath, sqlExport);
  
  console.log(`\n✅ Export completed successfully!`);
  console.log(`📁 File: ${exportPath}`);
  console.log(`📊 Tables processed: ${processedTables}`);
  console.log(`💾 File size: ${(fs.statSync(exportPath).size / 1024).toFixed(2)} KB`);
  
  db.close();
}

// Start export
exportAllTables().catch(console.error);