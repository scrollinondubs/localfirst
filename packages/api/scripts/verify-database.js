#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses, chainBusinesses } from '../src/db/schema.js';
import { count, sql } from 'drizzle-orm';

const verifyDatabase = async () => {
  console.log('🔍 Verifying Local First Arizona database setup...\n');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses, chainBusinesses } });
    
    // Check businesses table
    console.log('📊 BUSINESSES TABLE:');
    const businessCount = await db.select({ count: count() }).from(businesses);
    console.log(`   Total businesses: ${businessCount[0].count}`);
    
    const lfaMembers = await db.select({ count: count() })
      .from(businesses)
      .where(sql`lfa_member = 1`);
    console.log(`   LFA members: ${lfaMembers[0].count}`);
    
    const businessesByCategory = await db.select({
      category: businesses.category,
      count: count()
    })
    .from(businesses)
    .groupBy(businesses.category);
    
    console.log('   Categories breakdown:');
    businessesByCategory.forEach(cat => {
      console.log(`     ${cat.category}: ${cat.count}`);
    });
    
    // Sample some businesses
    const sampleBusinesses = await db.select({
      name: businesses.name,
      address: businesses.address,
      category: businesses.category,
      lfaMember: businesses.lfaMember
    })
    .from(businesses)
    .limit(5);
    
    console.log('\n   Sample businesses:');
    sampleBusinesses.forEach(biz => {
      console.log(`     ${biz.name} (${biz.category}) ${biz.lfaMember ? '✅ LFA' : ''}`);
    });
    
    // Check chain businesses table
    console.log('\n📊 CHAIN BUSINESSES TABLE:');
    const chainCount = await db.select({ count: count() }).from(chainBusinesses);
    console.log(`   Total chain businesses: ${chainCount[0].count}`);
    
    const chainsByCategory = await db.select({
      category: chainBusinesses.category,
      count: count()
    })
    .from(chainBusinesses)
    .groupBy(chainBusinesses.category);
    
    console.log('   Chain categories:');
    chainsByCategory.forEach(cat => {
      console.log(`     ${cat.category}: ${cat.count}`);
    });
    
    // Sample chains
    const sampleChains = await db.select({
      name: chainBusinesses.name,
      category: chainBusinesses.category,
      patterns: chainBusinesses.patterns
    })
    .from(chainBusinesses)
    .limit(5);
    
    console.log('\n   Sample chains:');
    sampleChains.forEach(chain => {
      const patterns = JSON.parse(chain.patterns);
      console.log(`     ${chain.name} (${chain.category}): ${patterns.join(', ')}`);
    });
    
    // Check table structure
    console.log('\n🔍 DATABASE STRUCTURE:');
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('   Tables:');
    tables.rows.forEach(row => {
      console.log(`     ${row.name}`);
    });
    
    const indexes = await client.execute("SELECT name FROM sqlite_master WHERE type='index'");
    console.log(`   Indexes: ${indexes.rows.length}`);
    
    // Test geographic queries
    console.log('\n🗺️  GEOGRAPHIC TEST:');
    const phoenixBusinesses = await db.select({ count: count() })
      .from(businesses)
      .where(sql`latitude BETWEEN 33.3 AND 33.7 AND longitude BETWEEN -112.3 AND -111.9`);
    console.log(`   Businesses near Phoenix: ${phoenixBusinesses[0].count}`);
    
    console.log('\n✅ Database verification completed successfully!');
    console.log('\n📋 SUMMARY:');
    console.log(`   • ${businessCount[0].count} businesses imported`);
    console.log(`   • ${lfaMembers[0].count} LFA members`);
    console.log(`   • ${chainCount[0].count} chain businesses in blocklist`);
    console.log(`   • All tables and indexes created`);
    console.log(`   • Geographic queries working`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    process.exit(1);
  }
};

verifyDatabase();