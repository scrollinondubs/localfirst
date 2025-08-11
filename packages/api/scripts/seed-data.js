#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses, chainBusinesses } from '../src/db/schema.js';
import { count } from 'drizzle-orm';

const seedData = async () => {
  console.log('🌱 Starting database seeding process...\n');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses, chainBusinesses } });
    
    // Check if data already exists
    const existingBusinesses = await db.select({ count: count() }).from(businesses);
    const existingChains = await db.select({ count: count() }).from(chainBusinesses);
    
    if (existingBusinesses[0].count > 0 || existingChains[0].count > 0) {
      console.log('📊 Database already contains data:');
      console.log(`   • Businesses: ${existingBusinesses[0].count}`);
      console.log(`   • Chain businesses: ${existingChains[0].count}`);
      console.log('\n⚠️  Seeding skipped. Use --force to override existing data.');
      return;
    }
    
    console.log('📊 Database is empty, proceeding with seeding...\n');
    
    // Import businesses
    console.log('📥 Running business import...');
    const { execSync } = await import('child_process');
    execSync('node scripts/import-businesses.js', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    // Seed chains  
    console.log('\n📥 Running chain businesses seed...');
    execSync('node scripts/seed-chains.js', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    // Verify everything
    console.log('\n🔍 Running verification...');
    execSync('node scripts/verify-database.js', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('\n🎉 Database seeding completed successfully!');
    
    client.close();
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

// Check for force flag
const force = process.argv.includes('--force');
if (force) {
  console.log('⚠️  Force flag detected - this will override existing data');
}

seedData();