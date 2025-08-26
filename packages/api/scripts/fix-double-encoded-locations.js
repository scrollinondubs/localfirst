#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || path.resolve(__dirname, '../../local.db');

console.log('🔧 Fixing double-encoded location settings in user preferences...');

try {
  // Find all users with location_settings that appear to be double-encoded (start with a quote)
  const queryCmd = `sqlite3 "${dbPath}" "SELECT id || '|' || user_id || '|' || location_settings FROM user_preferences WHERE location_settings IS NOT NULL AND location_settings LIKE '\\"{%';"`;
  
  const rawOutput = execSync(queryCmd, { encoding: 'utf8' });
  const lines = rawOutput.trim().split('\n').filter(line => line.length > 0);
  
  console.log(`Found ${lines.length} users with double-encoded location settings`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const line of lines) {
    const [id, userId, locationSettings] = line.split('|');
    
    try {
      console.log(`\n--- Processing user ${userId} (id: ${id}) ---`);
      console.log(`Original: ${locationSettings.substring(0, 100)}...`);
      
      // Parse the double-encoded JSON
      let parsedOnce = JSON.parse(locationSettings);
      let locationObject = JSON.parse(parsedOnce);
      
      // Validate that we have a proper location object
      if (typeof locationObject === 'object' && 
          locationObject.lat !== undefined && 
          locationObject.lng !== undefined) {
        
        // Re-encode correctly (single encoding)
        const correctlyEncoded = JSON.stringify(locationObject);
        console.log(`Fixed: ${correctlyEncoded}`);
        
        // Update the database - use proper JSON escaping for sqlite3
        const escapedJson = correctlyEncoded.replace(/"/g, '\\"');
        const updateCmd = `sqlite3 "${dbPath}" "UPDATE user_preferences SET location_settings = '${escapedJson}' WHERE id = '${id}';"`;
        
        execSync(updateCmd, { encoding: 'utf8' });
        console.log('✅ Successfully fixed location settings');
        fixedCount++;
        
      } else {
        console.log('⚠️ Invalid location object structure, skipping');
        errorCount++;
      }
      
    } catch (error) {
      console.error(`❌ Error processing user ${userId}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Fixed: ${fixedCount} users`);
  console.log(`❌ Errors: ${errorCount} users`);
  console.log(`📋 Total processed: ${lines.length} users`);

  // Verify the fix by checking for remaining double-encoded entries
  const verifyCmd = `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM user_preferences WHERE location_settings IS NOT NULL AND location_settings LIKE '\\"{%';"`;
  const remainingCount = execSync(verifyCmd, { encoding: 'utf8' }).trim();

  console.log(`\n🔍 Verification: ${remainingCount} double-encoded entries remain`);

} catch (error) {
  console.error('💥 Migration failed:', error);
  process.exit(1);
}

console.log('🎉 Migration completed successfully!');