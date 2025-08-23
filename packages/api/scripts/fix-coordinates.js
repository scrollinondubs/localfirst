#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';

// Real geocoding using a free service (nominatim)
const geocodeAddress = async (address) => {
  try {
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
        return { lat, lng, found: true };
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

const fixCoordinates = async () => {
  console.log('🚀 Starting coordinate fix...');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client);
    
    // Get all businesses
    const allBusinesses = await db.select({
      id: businesses.id,
      name: businesses.name,
      address: businesses.address,
      latitude: businesses.latitude,
      longitude: businesses.longitude
    }).from(businesses);
    
    console.log(`📊 Found ${allBusinesses.length} businesses to process`);
    
    let fixed = 0;
    let failed = 0;
    let skipped = 0;
    
    // Process in batches to avoid overwhelming the service
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < allBusinesses.length; i += BATCH_SIZE) {
      const batch = allBusinesses.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allBusinesses.length/BATCH_SIZE)}`);
      
      for (const business of batch) {
        try {
          const result = await geocodeAddress(business.address);
          
          if (result.found) {
            // Update the business coordinates
            await db.update(businesses)
              .set({
                latitude: result.lat,
                longitude: result.lng
              })
              .where({ id: business.id });
            
            fixed++;
            console.log(`✅ Updated ${business.name}`);
          } else {
            failed++;
            console.log(`❌ Failed to geocode: ${business.name} - ${business.address}`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing ${business.name}:`, error.message);
          failed++;
        }
      }
      
      // Longer pause between batches
      if (i + BATCH_SIZE < allBusinesses.length) {
        console.log('⏱️  Pausing 10 seconds between batches...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log(`\n✅ Coordinate fix completed!`);
    console.log(`📊 Total processed: ${allBusinesses.length}`);
    console.log(`✅ Successfully fixed: ${fixed}`);
    console.log(`❌ Failed to geocode: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
};

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  fixCoordinates();
} else {
  console.log('🚨 This will update coordinates for ALL businesses in the database.');
  console.log('⚠️  This is a potentially slow operation that will make thousands of API calls.');
  console.log('🔍 Using OpenStreetMap Nominatim service with rate limiting.');
  console.log('\n💡 Run with --confirm to proceed:');
  console.log('   npm run fix-coordinates -- --confirm');
}