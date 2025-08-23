#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';

// Real geocoding using nominatim
const geocodeAddress = async (address) => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=us`;
    
    console.log(`🔍 Testing geocoding for: ${address}`);
    console.log(`📡 URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LocalFirstArizona/1.0 (business-directory-app)'
      }
    });
    
    const results = await response.json();
    console.log(`📦 Raw response:`, JSON.stringify(results, null, 2));
    
    if (results && results.length > 0) {
      const result = results[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      console.log(`✅ Found coordinates: ${lat}, ${lng}`);
      console.log(`🎯 Display name: ${result.display_name}`);
      
      return { lat, lng, found: true, display_name: result.display_name };
    } else {
      console.log(`❌ No results found`);
      return { lat: null, lng: null, found: false };
    }
    
  } catch (error) {
    console.error(`❌ Geocoding error:`, error.message);
    return { lat: null, lng: null, found: false };
  }
};

const testGeocoding = async () => {
  console.log('🧪 Testing geocoding with sample addresses...\n');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client);
    
    // Get 5 sample businesses
    const sampleBusinesses = await db.select({
      id: businesses.id,
      name: businesses.name,
      address: businesses.address,
      latitude: businesses.latitude,
      longitude: businesses.longitude
    }).from(businesses).limit(5);
    
    console.log(`📊 Testing with ${sampleBusinesses.length} sample businesses\n`);
    
    for (const business of sampleBusinesses) {
      console.log(`\n🏢 Business: ${business.name}`);
      console.log(`📍 Current coords: ${business.latitude}, ${business.longitude}`);
      console.log(`🏠 Address: ${business.address}`);
      
      const result = await geocodeAddress(business.address);
      
      if (result.found) {
        const latDiff = Math.abs(result.lat - business.latitude).toFixed(4);
        const lngDiff = Math.abs(result.lng - business.longitude).toFixed(4);
        
        console.log(`📏 Coordinate differences:`);
        console.log(`   Latitude: ${latDiff}° (${latDiff > 0.01 ? 'SIGNIFICANT' : 'minor'})`);
        console.log(`   Longitude: ${lngDiff}° (${lngDiff > 0.01 ? 'SIGNIFICANT' : 'minor'})`);
      }
      
      console.log(`${'='.repeat(80)}`);
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    client.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testGeocoding();