#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { eq, like } from 'drizzle-orm';

// Real geocoding using nominatim
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
        console.log(`🎯 Display name: ${result.display_name}`);
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

const retryFailedBusinesses = async () => {
  console.log('🚀 Retrying failed businesses with cleaned addresses...');
  
  // Failed businesses with alternative address formats
  const businessFixes = [
    {
      name: 'Lola\'s African Variety Store',
      originalAddress: '8021 N. 43rd Venue, Suites 8A & B, Phoenix, AZ 85051',
      cleanedAddresses: [
        '8021 N 43rd Ave, Phoenix, AZ 85051', // Avenue instead of Venue
        '8021 North 43rd Avenue, Phoenix, AZ 85051',
        '43rd Avenue and Camelback, Phoenix, AZ 85051'
      ]
    },
    {
      name: 'Wheats Clothes Silo And Fair Trade Stores',
      originalAddress: '4000 North 7th Street in Plaza 4000, Phoenix, AZ 85014',
      cleanedAddresses: [
        '4000 N 7th St, Phoenix, AZ 85014',
        '4000 North 7th Street, Phoenix, AZ 85014',
        '7th Street and Indian School, Phoenix, AZ 85014'
      ]
    },
    {
      name: 'Palabras Bilingual Bookstore',
      originalAddress: '906 W. Roosevelt St. Unit 2 Phoenix, AZ. 85007, Phoenix, AZ 85007',
      cleanedAddresses: [
        '906 W Roosevelt St, Phoenix, AZ 85007',
        '906 West Roosevelt Street, Phoenix, AZ 85007',
        'Roosevelt Row, Phoenix, AZ 85007'
      ]
    }
  ];
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client);
    
    let updated = 0;
    let failed = 0;
    
    for (const businessFix of businessFixes) {
      console.log(`\n🏢 Processing: ${businessFix.name}`);
      
      // Find the business
      const business = await db.select({
        id: businesses.id,
        name: businesses.name,
        address: businesses.address,
        latitude: businesses.latitude,
        longitude: businesses.longitude
      })
      .from(businesses)
      .where(like(businesses.name, `%${businessFix.name}%`))
      .limit(1);
      
      if (business.length === 0) {
        console.log(`❌ Business not found: ${businessFix.name}`);
        failed++;
        continue;
      }
      
      const businessRecord = business[0];
      console.log(`📍 Current coords: ${businessRecord.latitude}, ${businessRecord.longitude}`);
      console.log(`🏠 Original address: ${businessRecord.address}`);
      
      // Try each cleaned address until one works
      let success = false;
      for (const cleanedAddress of businessFix.cleanedAddresses) {
        console.log(`\n🧹 Trying cleaned address: ${cleanedAddress}`);
        
        const result = await geocodeAddress(cleanedAddress);
        
        if (result.found) {
          // Show coordinate comparison
          const latDiff = Math.abs(result.lat - businessRecord.latitude).toFixed(4);
          const lngDiff = Math.abs(result.lng - businessRecord.longitude).toFixed(4);
          
          console.log(`📏 Coordinate differences:`);
          console.log(`   Latitude: ${latDiff}° (${latDiff > 0.01 ? 'SIGNIFICANT' : 'minor'})`);
          console.log(`   Longitude: ${lngDiff}° (${lngDiff > 0.01 ? 'SIGNIFICANT' : 'minor'})`);
          
          // Update the business coordinates
          await db.update(businesses)
            .set({
              latitude: result.lat,
              longitude: result.lng
            })
            .where(eq(businesses.id, businessRecord.id));
          
          updated++;
          console.log(`✅ Updated ${businessFix.name} with new coordinates`);
          success = true;
          break; // Stop trying other addresses
        }
      }
      
      if (!success) {
        console.log(`❌ All attempts failed for: ${businessFix.name}`);
        failed++;
      }
      
      console.log(`${'='.repeat(80)}`);
    }
    
    console.log(`\n✅ Retry completed!`);
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Still failed: ${failed}`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Retry failed:', error);
    process.exit(1);
  }
};

retryFailedBusinesses();