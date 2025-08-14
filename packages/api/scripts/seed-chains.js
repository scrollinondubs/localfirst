#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { chainBusinesses } from '../src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';

// Chain businesses data from PRD appendix and common chains
const chainData = [
  // Retail chains
  {
    name: 'Walmart',
    patterns: ['walmart', 'wal-mart', 'walmart supercenter'],
    category: 'retail',
    parentCompany: 'Walmart Inc.',
    confidenceScore: 100
  },
  {
    name: 'Target',
    patterns: ['target', 'target store'],
    category: 'retail',
    parentCompany: 'Target Corporation',
    confidenceScore: 100
  },
  {
    name: 'Best Buy',
    patterns: ['best buy', 'bestbuy'],
    category: 'retail',
    parentCompany: 'Best Buy Co., Inc.',
    confidenceScore: 100
  },
  {
    name: 'Home Depot',
    patterns: ['home depot', 'the home depot'],
    category: 'retail',
    parentCompany: 'The Home Depot, Inc.',
    confidenceScore: 100
  },
  {
    name: "Lowe's",
    patterns: ["lowe's", "lowes", "lowe's home improvement"],
    category: 'retail',
    parentCompany: "Lowe's Companies, Inc.",
    confidenceScore: 100
  },
  {
    name: 'Costco',
    patterns: ['costco', 'costco wholesale'],
    category: 'retail',
    parentCompany: 'Costco Wholesale Corporation',
    confidenceScore: 100
  },
  {
    name: "Sam's Club",
    patterns: ["sam's club", "sams club"],
    category: 'retail',
    parentCompany: 'Walmart Inc.',
    confidenceScore: 100
  },

  // Fast Food chains
  {
    name: "McDonald's",
    patterns: ["mcdonald's", "mcdonalds"],
    category: 'restaurant',
    parentCompany: "McDonald's Corporation",
    confidenceScore: 100
  },
  {
    name: 'Burger King',
    patterns: ['burger king', 'bk'],
    category: 'restaurant',
    parentCompany: 'Restaurant Brands International',
    confidenceScore: 100
  },
  {
    name: 'KFC',
    patterns: ['kfc', 'kentucky fried chicken'],
    category: 'restaurant',
    parentCompany: 'Yum! Brands',
    confidenceScore: 100
  },
  {
    name: 'Taco Bell',
    patterns: ['taco bell', 'tacobell'],
    category: 'restaurant',
    parentCompany: 'Yum! Brands',
    confidenceScore: 100
  },
  {
    name: 'Subway',
    patterns: ['subway', 'subway restaurant'],
    category: 'restaurant',
    parentCompany: 'Subway IP LLC',
    confidenceScore: 100
  },
  {
    name: 'Starbucks',
    patterns: ['starbucks', 'starbucks coffee'],
    category: 'restaurant',
    parentCompany: 'Starbucks Corporation',
    confidenceScore: 100
  },
  {
    name: 'Chipotle',
    patterns: ['chipotle', 'chipotle mexican grill'],
    category: 'restaurant',
    parentCompany: 'Chipotle Mexican Grill, Inc.',
    confidenceScore: 100
  },
  {
    name: 'Pizza Hut',
    patterns: ['pizza hut', 'pizzahut'],
    category: 'restaurant',
    parentCompany: 'Yum! Brands',
    confidenceScore: 100
  },
  {
    name: 'Dominos',
    patterns: ['dominos', "domino's", "domino's pizza"],
    category: 'restaurant',
    parentCompany: "Domino's Pizza, Inc.",
    confidenceScore: 100
  },
  {
    name: 'Papa Johns',
    patterns: ['papa johns', "papa john's", "papa john's pizza"],
    category: 'restaurant',
    parentCompany: "Papa John's International",
    confidenceScore: 100
  },

  // Clothing & Fashion chains
  {
    name: 'Gap',
    patterns: ['gap', 'gap inc'],
    category: 'retail',
    parentCompany: 'Gap Inc.',
    confidenceScore: 100
  },
  {
    name: 'Gap Factory',
    patterns: ['gap factory', 'gap outlet'],
    category: 'retail',
    parentCompany: 'Gap Inc.',
    confidenceScore: 100
  },
  {
    name: 'H&M',
    patterns: ['h&m', 'h & m', 'hennes & mauritz'],
    category: 'retail',
    parentCompany: 'H & M Hennes & Mauritz AB',
    confidenceScore: 100
  },
  {
    name: 'Urban Outfitters',
    patterns: ['urban outfitters'],
    category: 'retail',
    parentCompany: 'Urban Outfitters, Inc.',
    confidenceScore: 100
  },
  {
    name: 'T.J. Maxx',
    patterns: ['t.j. maxx', 'tj maxx', 'tjmaxx'],
    category: 'retail',
    parentCompany: 'TJX Companies',
    confidenceScore: 100
  },
  {
    name: 'Marshall\'s',
    patterns: ['marshall\'s', 'marshalls'],
    category: 'retail',
    parentCompany: 'TJX Companies',
    confidenceScore: 100
  },
  {
    name: 'Old Navy',
    patterns: ['old navy'],
    category: 'retail',
    parentCompany: 'Gap Inc.',
    confidenceScore: 100
  },
  {
    name: 'American Eagle',
    patterns: ['american eagle', 'american eagle outfitters', 'ae'],
    category: 'retail',
    parentCompany: 'American Eagle Outfitters',
    confidenceScore: 100
  },
  {
    name: 'Forever 21',
    patterns: ['forever 21', 'forever21'],
    category: 'retail',
    parentCompany: 'Authentic Brands Group',
    confidenceScore: 100
  },
  {
    name: 'Zara',
    patterns: ['zara'],
    category: 'retail',
    parentCompany: 'Inditex',
    confidenceScore: 100
  },
  {
    name: 'Banana Republic',
    patterns: ['banana republic'],
    category: 'retail',
    parentCompany: 'Gap Inc.',
    confidenceScore: 100
  },
  {
    name: 'Nordstrom',
    patterns: ['nordstrom'],
    category: 'retail',
    parentCompany: 'Nordstrom, Inc.',
    confidenceScore: 100
  },
  {
    name: 'Nordstrom Rack',
    patterns: ['nordstrom rack'],
    category: 'retail',
    parentCompany: 'Nordstrom, Inc.',
    confidenceScore: 100
  },
  {
    name: 'Macy\'s',
    patterns: ['macy\'s', 'macys'],
    category: 'retail',
    parentCompany: 'Macy\'s, Inc.',
    confidenceScore: 100
  },

  // Service chains
  {
    name: 'H&R Block',
    patterns: ['h&r block', 'hr block', 'h and r block'],
    category: 'professional_services',
    parentCompany: 'H&R Block, Inc.',
    confidenceScore: 100
  },
  {
    name: 'Jiffy Lube',
    patterns: ['jiffy lube', 'jiffylube'],
    category: 'automotive',
    parentCompany: 'Shell Oil Company',
    confidenceScore: 100
  },
  {
    name: 'Valvoline Instant Oil Change',
    patterns: ['valvoline instant oil change', 'valvoline', 'vioc'],
    category: 'automotive',
    parentCompany: 'Valvoline Inc.',
    confidenceScore: 100
  },

  // Additional common chains
  {
    name: 'CVS Pharmacy',
    patterns: ['cvs', 'cvs pharmacy'],
    category: 'retail',
    parentCompany: 'CVS Health Corporation',
    confidenceScore: 100
  },
  {
    name: 'Walgreens',
    patterns: ['walgreens', 'walgreens pharmacy'],
    category: 'retail',
    parentCompany: 'Walgreens Boots Alliance',
    confidenceScore: 100
  },
  {
    name: 'Applebees',
    patterns: ["applebee's", 'applebees', "applebee's grill + bar"],
    category: 'restaurant',
    parentCompany: 'Dine Brands Global',
    confidenceScore: 100
  },
  {
    name: 'Chilis',
    patterns: ["chili's", 'chilis', "chili's grill & bar"],
    category: 'restaurant',
    parentCompany: 'Brinker International',
    confidenceScore: 100
  },
  {
    name: 'Olive Garden',
    patterns: ['olive garden'],
    category: 'restaurant',
    parentCompany: 'Darden Restaurants',
    confidenceScore: 100
  },
  {
    name: 'Red Lobster',
    patterns: ['red lobster'],
    category: 'restaurant',
    parentCompany: 'Golden Gate Capital',
    confidenceScore: 100
  },
  {
    name: 'Dennys',
    patterns: ["denny's", 'dennys'],
    category: 'restaurant',
    parentCompany: "Denny's Corporation",
    confidenceScore: 100
  },
  {
    name: 'IHOP',
    patterns: ['ihop', 'international house of pancakes'],
    category: 'restaurant',
    parentCompany: 'Dine Brands Global',
    confidenceScore: 100
  },
  {
    name: 'Panda Express',
    patterns: ['panda express', 'pandaexpress'],
    category: 'restaurant',
    parentCompany: 'Panda Restaurant Group',
    confidenceScore: 100
  },
  {
    name: '7-Eleven',
    patterns: ['7-eleven', '7 eleven', 'seven eleven'],
    category: 'retail',
    parentCompany: 'Seven & I Holdings Co.',
    confidenceScore: 100
  },
  {
    name: 'Circle K',
    patterns: ['circle k'],
    category: 'retail',
    parentCompany: 'Alimentation Couche-Tard',
    confidenceScore: 100
  },
  {
    name: 'QuikTrip',
    patterns: ['quiktrip', 'qt'],
    category: 'retail',
    parentCompany: 'QuikTrip Corporation',
    confidenceScore: 90
  }
];

const seedChains = async () => {
  console.log('🚀 Starting chain businesses seed...');
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { chainBusinesses } });
    
    let imported = 0;

    for (const chain of chainData) {
      try {
        const chainRecord = {
          id: uuidv4(),
          name: chain.name,
          patterns: JSON.stringify(chain.patterns),
          category: chain.category,
          parentCompany: chain.parentCompany,
          confidenceScore: chain.confidenceScore
        };

        await db.insert(chainBusinesses).values(chainRecord);
        imported++;
        
        console.log(`✅ Added chain: ${chain.name} (${chain.patterns.length} patterns)`);
        
      } catch (error) {
        console.error(`❌ Error importing chain ${chain.name}:`, error.message);
      }
    }

    console.log(`\n✅ Chain seed completed!`);
    console.log(`📊 Total chains added: ${imported}`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Chain seed failed:', error);
    process.exit(1);
  }
};

seedChains();