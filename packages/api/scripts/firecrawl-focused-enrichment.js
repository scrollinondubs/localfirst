#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses } from '../src/db/schema.js';
import { eq, and, isNull, or, sql, desc, isNotNull } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Strategic Firecrawl Enrichment Script
 * Use 654 Firecrawl credits efficiently on high-priority businesses
 * Prioritize LFA members and businesses with good websites
 */

const FIRECRAWL_CREDITS = 654;
const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

async function selectOptimalBusinesses(db, limit) {
  console.log(`🎯 Selecting ${limit} optimal businesses for Firecrawl enrichment...`);
  
  // Priority selection strategy:
  // 1. LFA members with websites (highest value)
  // 2. Non-LFA businesses with good websites (fill remaining slots)
  const businessList = await db.select()
    .from(businesses)
    .where(and(
      isNull(businesses.primaryCategory), // Not yet enriched
      isNotNull(businesses.website),
      eq(businesses.status, 'active')
    ))
    .orderBy(
      desc(businesses.lfaMember),
      businesses.id
    )
    .limit(limit);
    
  const lfaMembers = businessList.filter(b => b.lfaMember);
  const nonLfaMembers = businessList.filter(b => !b.lfaMember);
  
  console.log(`📊 Selected businesses breakdown:`);
  console.log(`   • LFA Members: ${lfaMembers.length}`);
  console.log(`   • Non-LFA: ${nonLfaMembers.length}`);
  console.log(`   • Total: ${businessList.length}`);
  
  // Sample some businesses to show what we're enriching
  console.log(`\n📋 Sample businesses to be enriched:`);
  businessList.slice(0, 5).forEach((business, i) => {
    const memberStatus = business.lfaMember ? '👑 LFA' : '   ';
    console.log(`   ${i + 1}. ${memberStatus} ${business.name} - ${business.website}`);
  });
  
  if (businessList.length > 5) {
    console.log(`   ... and ${businessList.length - 5} more`);
  }
  
  return businessList;
}

async function runFirecrawlEnrichment() {
  console.log('🚀 Starting Strategic Firecrawl Enrichment');
  console.log(`💰 Budget: ${FIRECRAWL_CREDITS} Firecrawl credits`);
  console.log(`📦 Batch size: ${BATCH_SIZE} businesses per batch`);
  
  try {
    // Database connection
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses } });
    
    // Select optimal businesses for enrichment
    const selectedBusinesses = await selectOptimalBusinesses(db, FIRECRAWL_CREDITS);
    
    if (selectedBusinesses.length === 0) {
      console.log('ℹ️ No businesses found that need enrichment');
      return;
    }
    
    // Create enrichment summary
    const summary = {
      startTime: new Date().toISOString(),
      totalBusinesses: selectedBusinesses.length,
      expectedCost: selectedBusinesses.length * 0.01, // $0.01 per business
      batches: Math.ceil(selectedBusinesses.length / BATCH_SIZE),
      estimatedTime: Math.ceil(selectedBusinesses.length / BATCH_SIZE) * 2, // 2 seconds per batch
      businesses: selectedBusinesses.map(b => ({
        id: b.id,
        name: b.name,
        website: b.website,
        lfaMember: b.lfaMember
      }))
    };
    
    // Save enrichment plan
    const planPath = path.join(process.cwd(), 'enrichment-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(summary, null, 2));
    console.log(`📋 Enrichment plan saved to: ${planPath}`);
    
    console.log(`\n💡 Ready to enrich ${selectedBusinesses.length} businesses`);
    console.log(`💰 Estimated cost: $${summary.expectedCost.toFixed(2)}`);
    console.log(`⏱️ Estimated time: ${summary.estimatedTime} minutes`);
    
    // Confirm before proceeding
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const proceed = await new Promise((resolve) => {
      rl.question('\n❓ Proceed with Firecrawl enrichment? (y/N): ', (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    rl.close();
    
    if (!proceed) {
      console.log('❌ Enrichment cancelled by user');
      return;
    }
    
    console.log('\n🏃‍♂️ Starting enrichment process...');
    
    // Process in batches
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (let i = 0; i < selectedBusinesses.length; i += BATCH_SIZE) {
      const batch = selectedBusinesses.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(selectedBusinesses.length / BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} businesses)`);
      
      try {
        // Here you would call your actual enrichment script
        // For now, we'll use the existing enrichment script with specific business IDs
        const businessIds = batch.map(b => b.id).join(',');
        
        console.log(`   🔍 Enriching: ${batch.map(b => b.name).join(', ')}`);
        
        // Call the enrichment script with specific business IDs
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const enrichCommand = `node scripts/enrich-businesses.js --method firecrawl --business-ids "${businessIds}" --batch-size ${batch.length}`;
        
        console.log(`   📞 Running: ${enrichCommand}`);
        
        const enrichResult = await execAsync(enrichCommand, {
          cwd: process.cwd(),
          env: { ...process.env },
          timeout: 300000 // 5 minute timeout per batch
        });
        
        console.log(`   ✅ Batch ${batchNum} completed successfully`);
        results.successful += batch.length;
        
      } catch (error) {
        console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
        results.failed += batch.length;
        results.errors.push({
          batch: batchNum,
          businesses: batch.map(b => ({ id: b.id, name: b.name })),
          error: error.message
        });
      }
      
      // Wait between batches to be respectful
      if (i + BATCH_SIZE < selectedBusinesses.length) {
        console.log(`   ⏸️ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Final summary
    console.log('\n🎉 Firecrawl Enrichment Complete!');
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`💰 Credits used: ${results.successful} of ${FIRECRAWL_CREDITS}`);
    console.log(`💰 Estimated cost: $${(results.successful * 0.01).toFixed(2)}`);
    
    // Save final results
    const finalResults = {
      ...summary,
      endTime: new Date().toISOString(),
      results: results,
      creditsUsed: results.successful,
      creditsRemaining: FIRECRAWL_CREDITS - results.successful
    };
    
    const resultsPath = path.join(process.cwd(), 'firecrawl-enrichment-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(finalResults, null, 2));
    console.log(`📊 Results saved to: ${resultsPath}`);
    
    if (results.failed > 0) {
      console.log(`\n⚠️ ${results.failed} businesses failed enrichment. Check results file for details.`);
    }
    
    console.log(`\n🚀 Next steps:`);
    console.log(`   1. Review enriched businesses in database`);
    console.log(`   2. Test search API with enriched data`);
    console.log(`   3. Start background Playwright processing for remaining businesses`);
    console.log(`   4. Begin building mobile app integration`);
    
  } catch (error) {
    console.error('❌ Fatal error in Firecrawl enrichment:', error);
    process.exit(1);
  }
}

// Run the enrichment
if (import.meta.url === `file://${process.argv[1]}`) {
  runFirecrawlEnrichment().catch(console.error);
}

// Export for testing
export { selectOptimalBusinesses, runFirecrawlEnrichment };