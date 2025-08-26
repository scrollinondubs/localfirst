import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { userPreferences } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Fix Location Geocoding Script
 * 
 * This script addresses GRID7-210 by finding user preferences with address-only
 * location data (missing lat/lng coordinates) and geocoding them to add the
 * required numerical coordinates.
 */

const OPENSTREETMAP_API = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode an address using OpenStreetMap's Nominatim API
 */
async function geocodeAddress(address) {
  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `${OPENSTREETMAP_API}?format=json&q=${encodedAddress}&limit=1`;
    
    console.log(`[GEOCODE] Requesting: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      throw new Error('No results found');
    }
    
    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.display_name || address.trim()
    };
  } catch (error) {
    console.error(`[GEOCODE] Failed to geocode "${address}":`, error.message);
    return null;
  }
}

/**
 * Add delay between API requests to be respectful to OpenStreetMap
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let client;
  let db;
  
  try {
    // Connect to database
    const dbUrl = process.env.DATABASE_URL || 'file:../../local.db';
    console.log(`[FIX-GEOCODING] Connecting to database: ${dbUrl}`);
    
    client = createClient({
      url: dbUrl
    });
    db = drizzle(client);
    
    // Find all user preferences with location settings
    console.log('[FIX-GEOCODING] Searching for users with location preferences...');
    
    const allPreferences = await db.select({
      id: userPreferences.id,
      userId: userPreferences.userId,
      locationSettings: userPreferences.locationSettings
    }).from(userPreferences);
    
    console.log(`[FIX-GEOCODING] Found ${allPreferences.length} user preference records`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const pref of allPreferences) {
      try {
        if (!pref.locationSettings) {
          console.log(`[FIX-GEOCODING] User ${pref.userId}: No location settings, skipping`);
          skippedCount++;
          continue;
        }
        
        const locationData = JSON.parse(pref.locationSettings);
        console.log(`[FIX-GEOCODING] User ${pref.userId}: Checking location data:`, locationData);
        
        let needsUpdate = false;
        let updatedLocationData = { ...locationData };
        
        // Check if this is the direct format {lat, lng, address}
        if (locationData.address && (!locationData.lat || !locationData.lng)) {
          console.log(`[FIX-GEOCODING] User ${pref.userId}: Direct format needs geocoding`);
          
          const geocoded = await geocodeAddress(locationData.address);
          if (geocoded) {
            updatedLocationData = {
              lat: geocoded.lat,
              lng: geocoded.lng,
              address: geocoded.address
            };
            needsUpdate = true;
            console.log(`[FIX-GEOCODING] User ${pref.userId}: Geocoded to:`, updatedLocationData);
          } else {
            console.error(`[FIX-GEOCODING] User ${pref.userId}: Failed to geocode address`);
            errorCount++;
            continue;
          }
        }
        
        // Check nested format {current: "home", home: {...}, work: {...}}
        else if (locationData.current && locationData[locationData.current]) {
          const currentLocationKey = locationData.current;
          const currentLocation = locationData[currentLocationKey];
          
          if (currentLocation.address && (!currentLocation.lat || !currentLocation.lng)) {
            console.log(`[FIX-GEOCODING] User ${pref.userId}: Nested ${currentLocationKey} needs geocoding`);
            
            const geocoded = await geocodeAddress(currentLocation.address);
            if (geocoded) {
              updatedLocationData[currentLocationKey] = {
                lat: geocoded.lat,
                lng: geocoded.lng,
                address: geocoded.address
              };
              needsUpdate = true;
              console.log(`[FIX-GEOCODING] User ${pref.userId}: Updated ${currentLocationKey}:`, updatedLocationData[currentLocationKey]);
            } else {
              console.error(`[FIX-GEOCODING] User ${pref.userId}: Failed to geocode ${currentLocationKey} address`);
              errorCount++;
              continue;
            }
          }
        }
        
        if (needsUpdate) {
          // Update the database
          await db.update(userPreferences)
            .set({
              locationSettings: JSON.stringify(updatedLocationData),
              updatedAt: new Date().toISOString()
            })
            .where(eq(userPreferences.id, pref.id));
          
          console.log(`[FIX-GEOCODING] User ${pref.userId}: Successfully updated location settings`);
          fixedCount++;
          
          // Be respectful to the geocoding service
          await delay(1000); // 1 second delay between requests
        } else {
          console.log(`[FIX-GEOCODING] User ${pref.userId}: Location already has coordinates, skipping`);
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`[FIX-GEOCODING] Error processing user ${pref.userId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n[FIX-GEOCODING] Summary:');
    console.log(`  - Fixed: ${fixedCount} users`);
    console.log(`  - Skipped: ${skippedCount} users`);
    console.log(`  - Errors: ${errorCount} users`);
    console.log(`  - Total processed: ${allPreferences.length} users`);
    
  } catch (error) {
    console.error('[FIX-GEOCODING] Fatal error:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.close();
    }
  }
}

// Run the script
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export { main as fixLocationGeocoding };