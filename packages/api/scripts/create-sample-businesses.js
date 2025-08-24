#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';

const sampleBusinesses = [
  {
    name: "Phoenix Local Bakery",
    address: "123 Main St, Phoenix, AZ 85001",
    latitude: 33.4484,
    longitude: -112.0740,
    phone: "(602) 555-0101",
    website: "https://phoenixlocalbakery.com",
    category: "restaurant",
    lfaMember: true
  },
  {
    name: "Scottsdale Web Design Studio",
    address: "456 Fashion Square Dr, Scottsdale, AZ 85251",
    latitude: 33.4942,
    longitude: -111.9261,
    phone: "(480) 555-0102",
    website: "https://scottsdalewebdesign.com",
    category: "professional_services",
    lfaMember: true
  },
  {
    name: "Tempe Coffee Roasters",
    address: "789 University Dr, Tempe, AZ 85281",
    latitude: 33.4255,
    longitude: -111.9400,
    phone: "(480) 555-0103",
    website: "https://tempecoffeeroasters.com",
    category: "restaurant",
    lfaMember: true
  },
  {
    name: "Mesa Fitness Center",
    address: "321 Fitness Way, Mesa, AZ 85201",
    latitude: 33.4152,
    longitude: -111.8315,
    phone: "(480) 555-0104",
    website: "https://mesafitnesscenter.com",
    category: "health_wellness",
    lfaMember: false
  },
  {
    name: "Tucson Art Gallery",
    address: "567 Art District Ave, Tucson, AZ 85701",
    latitude: 32.2226,
    longitude: -110.9747,
    phone: "(520) 555-0105",
    website: "https://tucsonartgallery.com",
    category: "retail",
    lfaMember: true
  },
  {
    name: "Chandler Auto Repair",
    address: "890 Repair Blvd, Chandler, AZ 85224",
    latitude: 33.3062,
    longitude: -111.8413,
    phone: "(480) 555-0106",
    website: "https://chandlerautorepair.com",
    category: "automotive",
    lfaMember: false
  },
  {
    name: "Glendale Pet Grooming",
    address: "234 Pet Lane, Glendale, AZ 85301",
    latitude: 33.5387,
    longitude: -112.1860,
    phone: "(623) 555-0107",
    website: "https://glendalepetgrooming.com",
    category: "services",
    lfaMember: true
  },
  {
    name: "Gilbert Photography Studio",
    address: "678 Creative Ave, Gilbert, AZ 85233",
    latitude: 33.3528,
    longitude: -111.7890,
    phone: "(480) 555-0108",
    website: "https://gilbertphotography.com",
    category: "professional_services",
    lfaMember: true
  },
  {
    name: "Peoria Plumbing Services",
    address: "345 Service Dr, Peoria, AZ 85345",
    latitude: 33.5806,
    longitude: -112.2374,
    phone: "(623) 555-0109",
    website: "https://peoriaplumbing.com",
    category: "services",
    lfaMember: false
  },
  {
    name: "Flagstaff Mountain Gear",
    address: "901 Mountain View Rd, Flagstaff, AZ 86001",
    latitude: 35.1983,
    longitude: -111.6513,
    phone: "(928) 555-0110",
    website: "https://flagstaffmountaingear.com",
    category: "retail",
    lfaMember: true
  }
];

const createSampleBusinesses = async () => {
  console.log('🏪 Creating sample businesses for enrichment testing...');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses } });
    
    let inserted = 0;
    
    for (const business of sampleBusinesses) {
      try {
        const businessRecord = {
          id: uuidv4(),
          name: business.name,
          address: business.address,
          latitude: business.latitude,
          longitude: business.longitude,
          phone: business.phone,
          website: business.website,
          category: business.category,
          lfaMember: business.lfaMember,
          memberSince: business.lfaMember ? '2024-01-01' : null,
          verified: true,
          status: 'active',
          enrichmentStatus: 'pending'
        };

        await db.insert(businesses).values(businessRecord);
        inserted++;
        
        console.log(`✅ Created: ${business.name}`);
        
      } catch (error) {
        console.error(`❌ Error creating business ${business.name}:`, error.message);
      }
    }

    console.log(`\n🎉 Sample businesses created successfully!`);
    console.log(`📊 Total businesses inserted: ${inserted}`);
    
    // Verify the data
    const result = await db.select().from(businesses).limit(3);
    console.log('\n📋 Sample of created businesses:');
    result.forEach(b => {
      console.log(`   ${b.name} - ${b.website} (${b.lfaMember ? 'LFA Member' : 'Non-member'})`);
    });
    
    client.close();
    
  } catch (error) {
    console.error('❌ Sample business creation failed:', error);
    process.exit(1);
  }
};

createSampleBusinesses();