#!/usr/bin/env node

import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';
// Added for local dev by Divya
import path from 'path'; 

// Simple geocoding function (in production, you'd use a real geocoding service)
const geocodeAddress = async (address, city, zip) => {
  // For now, we'll use approximate coordinates for Arizona cities
  // In production, integrate with Google Maps Geocoding API
  const arizonaCoordinates = {
    'Phoenix': { lat: 33.4484, lng: -112.0740 },
    'Tucson': { lat: 32.2226, lng: -110.9747 },
    'Scottsdale': { lat: 33.4942, lng: -111.9261 },
    'Mesa': { lat: 33.4152, lng: -111.8315 },
    'Flagstaff': { lat: 35.1983, lng: -111.6513 },
    'Tempe': { lat: 33.4255, lng: -111.9400 },
    'Glendale': { lat: 33.5387, lng: -112.1860 },
    'Gilbert': { lat: 33.3528, lng: -111.7890 },
    'Chandler': { lat: 33.3062, lng: -111.8413 },
    'Peoria': { lat: 33.5806, lng: -112.2374 },
    'Green Valley': { lat: 31.8545, lng: -110.9937 }
  };

  const coords = arizonaCoordinates[city] || { lat: 33.4484, lng: -112.0740 }; // Default to Phoenix
  
  // Add some random variation for more realistic spread
  const latVariation = (Math.random() - 0.5) * 0.1;
  const lngVariation = (Math.random() - 0.5) * 0.1;
  
  return {
    lat: coords.lat + latVariation,
    lng: coords.lng + lngVariation
  };
};

// Categorize business based on name
const categorizeDirectory = (businessName) => {
  const name = businessName.toLowerCase();
  
  if (name.includes('restaurant') || name.includes('grill') || name.includes('bar') || 
      name.includes('cafe') || name.includes('pizza') || name.includes('food') ||
      name.includes('brewing') || name.includes('bakehouse') || name.includes('bake')) {
    return 'restaurant';
  }
  
  if (name.includes('design') || name.includes('build') || name.includes('construction')) {
    return 'professional_services';
  }
  
  if (name.includes('brewing') || name.includes('brewery')) {
    return 'restaurant';
  }
  
  if (name.includes('pr') || name.includes('relations')) {
    return 'professional_services';
  }
  
  // Default category
  return 'other';
};

const importBusinesses = async () => {
  console.log('🚀 Starting business directory import...');
  
  //const csvPath = 'path/to/temp/Local First - All Directory Businesses.csv';
  // Newly added for local development by Divya
  const csvPath = path.join(process.cwd(), '..', '..', 'temp', 'Local First - All Directory Businesses.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at:', csvPath);
    process.exit(1);
  }

  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses } });
    
    const businessData = [];
    
    // Read and parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          businessData.push(row);
        })
        .on('end', () => {
          console.log(`📊 Parsed ${businessData.length} businesses from CSV`);
          resolve();
        })
        .on('error', reject);
    });

    // Process and insert businesses
    let imported = 0;
    let skipped = 0;

    for (const row of businessData) {
      try {
        const businessName = row.Business?.trim();
        const address = row.Address?.trim();
        const city = row.City?.trim();
        const zip = row.Zip?.trim();
        const phone = row['Business Phone']?.trim() || row['Contact phone']?.trim();
        const website = row.Website?.trim();

        if (!businessName || !address || !city) {
          console.log(`⚠️  Skipping incomplete record: ${businessName || 'Unknown'}`);
          skipped++;
          continue;
        }

        // Geocode address
        const coordinates = await geocodeAddress(address, city, zip);
        
        // Categorize business
        const category = categorizeDirectory(businessName);

        const businessRecord = {
          id: uuidv4(),
          name: businessName,
          address: `${address}, ${city}, AZ ${zip}`,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          phone: phone || null,
          website: website || null,
          category,
          lfaMember: true, // All businesses in this CSV are LFA members
          memberSince: '2024-01-01', // Default member date
          verified: true,
          status: 'active'
        };

        await db.insert(businesses).values(businessRecord);
        imported++;
        
        if (imported % 50 === 0) {
          console.log(`📈 Imported ${imported} businesses...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importing business ${row.Business}:`, error.message);
        skipped++;
      }
    }

    console.log(`\n✅ Import completed!`);
    console.log(`📊 Total processed: ${businessData.length}`);
    console.log(`✅ Successfully imported: ${imported}`);
    console.log(`⚠️  Skipped: ${skipped}`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
};

importBusinesses();