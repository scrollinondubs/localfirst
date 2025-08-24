#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Strategic Firecrawl Usage
 * Use 654 credits efficiently on highest-value businesses
 */

async function main() {
  console.log('🎯 Strategic Firecrawl Enrichment - Using 654 Credits Optimally');
  
  try {
    // Database connection
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses } });
    
    // Get unenriched businesses with websites, LFA members first
    const unenrichedBusinesses = await db.select({
      id: businesses.id,
      name: businesses.name,
      website: businesses.website,
      lfaMember: businesses.lfaMember
    })
    .from(businesses)
    .where(and(
      isNull(businesses.primaryCategory), // Not yet enriched
      isNotNull(businesses.website),
      eq(businesses.status, 'active')
    ))
    .orderBy(desc(businesses.lfaMember), businesses.id)
    .limit(654);
    
    const lfaCount = unenrichedBusinesses.filter(b => b.lfaMember).length;
    const nonLfaCount = unenrichedBusinesses.length - lfaCount;
    
    console.log(`📊 Found ${unenrichedBusinesses.length} businesses to enrich:`);
    console.log(`   👑 LFA Members: ${lfaCount} (will use Firecrawl)`);
    console.log(`   📋 Non-LFA: ${nonLfaCount} (will use Firecrawl)`);
    console.log(`💰 Estimated cost: $${(unenrichedBusinesses.length * 0.01).toFixed(2)}`);
    
    // Show sample
    console.log(`\n📋 Sample businesses (first 5):`);
    unenrichedBusinesses.slice(0, 5).forEach((b, i) => {
      const status = b.lfaMember ? '👑 LFA' : '📋';
      console.log(`   ${i+1}. ${status} ${b.name}`);
    });
    
    if (unenrichedBusinesses.length === 0) {
      console.log('✨ No businesses need enrichment! All done.');
      return;
    }
    
    // Confirm
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const proceed = await new Promise((resolve) => {
      rl.question(`\n❓ Proceed with enriching ${unenrichedBusinesses.length} businesses using Firecrawl? (y/N): `, (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    rl.close();
    
    if (!proceed) {
      console.log('❌ Cancelled by user');
      return;
    }
    
    console.log('\n🚀 Starting enrichment with existing pipeline...');
    console.log('⏱️  This will take approximately 10-15 minutes...');
    
    // Use existing enrichment script with Firecrawl method
    const command = `node scripts/enrich-businesses.js --method firecrawl --batch-size ${Math.min(unenrichedBusinesses.length, 50)} --priority lfa --verbose 1`;
    
    console.log(`📞 Running: ${command}`);
    
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 30 * 60 * 1000 // 30 minute timeout
      });
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      console.log('\n🎉 Enrichment completed successfully!');
      console.log(`⏱️  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
      console.log(`💰 Credits used: ~${unenrichedBusinesses.length} of 654`);
      
      if (stdout) {
        console.log('\n📋 Output summary:');
        console.log(stdout.split('\n').slice(-10).join('\n')); // Last 10 lines
      }
      
    } catch (error) {
      console.error('\n❌ Enrichment failed:', error.message);
      
      if (error.stdout) {
        console.log('\n📋 Partial output:');
        console.log(error.stdout.split('\n').slice(-10).join('\n'));
      }
      
      if (error.stderr) {
        console.error('\n🚨 Errors:');
        console.error(error.stderr);
      }
    }
    
    // Check results
    console.log('\n🔍 Checking enrichment results...');
    
    const enrichedCount = await db.select()
      .from(businesses)
      .where(and(
        isNotNull(businesses.primaryCategory),
        eq(businesses.enrichmentSource, 'firecrawl')
      ));
      
    console.log(`✅ Successfully enriched ${enrichedCount.length} businesses with Firecrawl`);
    
    // Show remaining credits
    const creditsUsed = Math.min(enrichedCount.length, 654);
    const creditsRemaining = 654 - creditsUsed;
    console.log(`💰 Firecrawl credits remaining: ${creditsRemaining}`);
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Check the enriched business data in your database');
    console.log('   2. Test the enhanced search API with enriched data');
    console.log('   3. Start building mobile app integration');
    console.log('   4. Set up background Playwright processing for remaining businesses');
    
    if (creditsRemaining > 0) {
      console.log(`   5. You have ${creditsRemaining} Firecrawl credits left for additional processing`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);