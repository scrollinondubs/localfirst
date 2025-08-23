#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

// Real geocoding using nominatim
const geocodeAddress = async (address) => {
  try {
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1200)); // Slightly longer delay
    
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=us`;
    
    console.log(`🔍 Geocoding: ${address}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LocalFirstArizona/1.0 (business-directory-app)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const results = await response.json();
    
    if (results && results.length > 0) {
      const result = results[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      // Verify coordinates are in Arizona (rough bounds)
      if (lat >= 31.0 && lat <= 37.0 && lng >= -115.0 && lng <= -109.0) {
        console.log(`✅ Found coordinates: ${lat}, ${lng}`);
        return { lat, lng, found: true, display_name: result.display_name };
      } else {
        console.log(`⚠️  Coordinates outside Arizona: ${lat}, ${lng}`);
        return { lat: null, lng: null, found: false };
      }
    } else {
      console.log(`❌ No results found for: ${address}`);
      return { lat: null, lng: null, found: false };
    }
    
  } catch (error) {
    console.error(`❌ Geocoding error for ${address}:`, error.message);
    return { lat: null, lng: null, found: false };
  }
};

const fixCoordinatesSafe = async () => {
  console.log('🚀 Starting safe coordinate fix...');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client);
    
    // Get all businesses in smaller chunks to avoid memory issues
    console.log('📊 Getting business count...');
    const countResult = await db.select().from(businesses);
    const totalBusinesses = countResult.length;
    console.log(`📊 Found ${totalBusinesses} businesses to process`);
    
    let fixed = 0;
    let failed = 0;
    let processed = 0;
    
    // Process in very small batches to avoid memory/connection issues
    const BATCH_SIZE = 50; // Smaller batch size
    
    for (let offset = 0; offset < totalBusinesses; offset += BATCH_SIZE) {
      try {
        // Get a small batch
        const batch = countResult.slice(offset, offset + BATCH_SIZE);
        console.log(`\n📦 Processing batch ${Math.floor(offset/BATCH_SIZE) + 1}/${Math.ceil(totalBusinesses/BATCH_SIZE)} (${batch.length} businesses)`);
        
        for (const business of batch) {
          try {
            processed++;
            console.log(`\n[${processed}/${totalBusinesses}] 🏢 Processing: ${business.name}`);
            console.log(`📍 Current coords: ${business.latitude}, ${business.longitude}`);
            console.log(`🏠 Address: ${business.address}`);
            
            const result = await geocodeAddress(business.address);
            
            if (result.found) {
              // Show coordinate comparison
              const latDiff = Math.abs(result.lat - business.latitude).toFixed(4);
              const lngDiff = Math.abs(result.lng - business.longitude).toFixed(4);
              
              console.log(`📏 Coordinate differences:`);
              console.log(`   Latitude: ${latDiff}° (${latDiff > 0.01 ? 'SIGNIFICANT' : 'minor'})`);
              console.log(`   Longitude: ${lngDiff}° (${lngDiff > 0.01 ? 'SIGNIFICANT' : 'minor'})`);
              
              try {
                // Update using direct SQL to avoid Drizzle/libsql issues
                const updateQuery = `UPDATE businesses SET latitude = ?, longitude = ? WHERE id = ?`;
                await client.execute({
                  sql: updateQuery,
                  args: [result.lat, result.lng, business.id]
                });
                
                fixed++;
                console.log(`✅ Updated ${business.name} with new coordinates`);
              } catch (updateError) {
                console.error(`❌ Failed to update database for ${business.name}:`, updateError.message);
                failed++;
              }
            } else {
              failed++;
              console.log(`❌ Failed to geocode: ${business.name}`);
            }
            
            // Progress update every 50 businesses
            if (processed % 50 === 0) {
              console.log(`\n📈 Progress: ${processed}/${totalBusinesses} (${((processed/totalBusinesses)*100).toFixed(1)}%)`);
              console.log(`✅ Fixed: ${fixed}, ❌ Failed: ${failed}`);
            }
            
          } catch (error) {
            console.error(`❌ Error processing ${business.name}:`, error.message);
            failed++;
            processed++;
          }
        }
        
        // Longer pause between batches to be respectful of API limits
        if (offset + BATCH_SIZE < totalBusinesses) {
          console.log('⏱️  Pausing 15 seconds between batches...');
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
        
      } catch (batchError) {
        console.error(`❌ Error processing batch starting at ${offset}:`, batchError.message);
        console.log('⏭️  Skipping to next batch...');
        continue;
      }
    }
    
    console.log(`\n🎉 Coordinate fix completed!`);
    console.log(`📊 Total businesses: ${totalBusinesses}`);
    console.log(`📊 Processed: ${processed}`);
    console.log(`✅ Successfully fixed: ${fixed}`);
    console.log(`❌ Failed to geocode: ${failed}`);
    console.log(`📍 Success rate: ${((fixed/processed)*100).toFixed(1)}%`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
};

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  fixCoordinatesSafe();
} else {
  console.log('🚨 This will update coordinates for ALL businesses in the database.');
  console.log('⚠️  This is a potentially slow operation that will make thousands of API calls.');
  console.log('🔍 Using OpenStreetMap Nominatim service with respectful rate limiting.');
  console.log('💾 Using direct SQL updates to avoid ORM issues.');
  console.log('\\n💡 Run with --confirm to proceed:');
  console.log('   node scripts/fix-coordinates-safe.js --confirm');
}