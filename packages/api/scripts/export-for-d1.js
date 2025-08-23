#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import fs from 'fs';
import path from 'path';

const exportForD1 = async () => {
  console.log('🚀 Starting D1-compatible data export from local database...');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client);
    
    // Get all businesses with corrected coordinates
    console.log('📊 Fetching all businesses...');
    const allBusinesses = await db.select().from(businesses);
    
    console.log(`📋 Found ${allBusinesses.length} businesses to export`);
    
    // Generate SQL INSERT statements for Cloudflare D1
    let sqlStatements = [];
    
    // Clear existing data first
    sqlStatements.push('DELETE FROM businesses;');
    sqlStatements.push('');
    
    // Add insert statements in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < allBusinesses.length; i += BATCH_SIZE) {
      const batch = allBusinesses.slice(i, i + BATCH_SIZE);
      
      for (const business of batch) {
        // Escape single quotes in text fields
        const escapedName = business.name ? business.name.replace(/'/g, "''") : '';
        const escapedAddress = business.address ? business.address.replace(/'/g, "''") : '';
        const escapedCategory = business.category ? business.category.replace(/'/g, "''") : '';
        const escapedWebsite = business.website ? business.website.replace(/'/g, "''") : '';
        const escapedPhone = business.phone ? business.phone.replace(/'/g, "''") : '';
        
        // Use D1 schema column names (no description, subcategory)
        const insertSql = `INSERT INTO businesses (
          id, name, address, latitude, longitude, 
          phone, website, category, lfa_member, 
          member_since, verified, status, created_at, updated_at
        ) VALUES (
          '${business.id}',
          '${escapedName}',
          '${escapedAddress}',
          ${business.latitude},
          ${business.longitude},
          '${escapedPhone}',
          '${escapedWebsite}',
          '${escapedCategory}',
          ${business.localFirstMember ? 1 : 0},
          NULL,
          0,
          'active',
          '${business.createdAt}',
          '${business.updatedAt}'
        );`;
        
        sqlStatements.push(insertSql);
      }
      
      // Add a comment for batch tracking
      sqlStatements.push(`-- Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allBusinesses.length/BATCH_SIZE)} completed`);
      sqlStatements.push('');
    }
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'd1-businesses-export.sql');
    const sqlContent = sqlStatements.join('\n');
    
    fs.writeFileSync(outputPath, sqlContent);
    
    console.log(`✅ D1 export completed!`);
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`📊 Total businesses: ${allBusinesses.length}`);
    console.log(`📄 Total SQL statements: ${sqlStatements.length}`);
    
    // Create a smaller sample file for testing
    const sampleSize = 5;
    const sampleBusinesses = allBusinesses.slice(0, sampleSize);
    let sampleSql = ['DELETE FROM businesses WHERE id IN ('];
    
    sampleBusinesses.forEach((business, index) => {
      sampleSql.push(`  '${business.id}'${index < sampleBusinesses.length - 1 ? ',' : ''}`);
    });
    sampleSql.push(');');
    sampleSql.push('');
    
    sampleBusinesses.forEach(business => {
      const escapedName = business.name ? business.name.replace(/'/g, "''") : '';
      const escapedAddress = business.address ? business.address.replace(/'/g, "''") : '';
      const escapedCategory = business.category ? business.category.replace(/'/g, "''") : '';
      const escapedWebsite = business.website ? business.website.replace(/'/g, "''") : '';
      const escapedPhone = business.phone ? business.phone.replace(/'/g, "''") : '';
      
      const insertSql = `INSERT INTO businesses (
        id, name, address, latitude, longitude, 
        phone, website, category, lfa_member, 
        member_since, verified, status, created_at, updated_at
      ) VALUES (
        '${business.id}',
        '${escapedName}',
        '${escapedAddress}',
        ${business.latitude},
        ${business.longitude},
        '${escapedPhone}',
        '${escapedWebsite}',
        '${escapedCategory}',
        ${business.localFirstMember ? 1 : 0},
        NULL,
        0,
        'active',
        '${business.createdAt}',
        '${business.updatedAt}'
      );`;
      
      sampleSql.push(insertSql);
    });
    
    const samplePath = path.join(process.cwd(), 'd1-sample-businesses.sql');
    fs.writeFileSync(samplePath, sampleSql.join('\n'));
    
    console.log(`🧪 D1 sample file created: ${samplePath} (${sampleSize} businesses)`);
    console.log(`💡 Test with sample first: wrangler d1 execute localfirst-prod --env production --file d1-sample-businesses.sql --remote`);
    console.log(`🚀 Then use full export: wrangler d1 execute localfirst-prod --env production --file d1-businesses-export.sql --remote`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
};

exportForD1();