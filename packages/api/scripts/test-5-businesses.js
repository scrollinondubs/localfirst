#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { eq, like, or } from 'drizzle-orm';

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

const testFiveBusinesses = async () => {
  console.log('🚀 Testing geocoding on 5 specific businesses...');
  
  // Target businesses to update
  const targetBusinesses = [
    'Yenat Enjera Ethiopian Market and Grocery',
    'Lola\'s African Variety Store',
    'Kellys Cottage AZ, LLC',
    'Wheats Clothes Silo And Fair Trade Stores',
    'Palabras Bilingual Bookstore'
  ];
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client);
    
    console.log(`📊 Looking for businesses: ${targetBusinesses.join(', ')}`);
    
    // Find these specific businesses
    const foundBusinesses = [];
    
    for (const businessName of targetBusinesses) {
      const business = await db.select({
        id: businesses.id,
        name: businesses.name,
        address: businesses.address,
        latitude: businesses.latitude,
        longitude: businesses.longitude
      })
      .from(businesses)
      .where(like(businesses.name, `%${businessName}%`))
      .limit(1);
      
      if (business.length > 0) {
        foundBusinesses.push(business[0]);
        console.log(`✅ Found: ${business[0].name}`);
      } else {
        console.log(`❌ Not found: ${businessName}`);
      }
    }
    
    console.log(`\n📦 Found ${foundBusinesses.length} businesses to update\n`);
    
    let updated = 0;
    let failed = 0;
    
    for (const business of foundBusinesses) {
      try {
        console.log(`\n🏢 Processing: ${business.name}`);
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
          
          // Update the business coordinates
          await db.update(businesses)
            .set({
              latitude: result.lat,
              longitude: result.lng
            })
            .where(eq(businesses.id, business.id));
          
          updated++;
          console.log(`✅ Updated ${business.name} with new coordinates`);
        } else {
          failed++;
          console.log(`❌ Failed to geocode: ${business.name}`);
        }
        
        console.log(`${'='.repeat(80)}`);
        
      } catch (error) {
        console.error(`❌ Error processing ${business.name}:`, error.message);
        failed++;
      }
    }
    
    console.log(`\n✅ Test completed!`);
    console.log(`📊 Businesses found: ${foundBusinesses.length}`);
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Failed to geocode: ${failed}`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testFiveBusinesses();