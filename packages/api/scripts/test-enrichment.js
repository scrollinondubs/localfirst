#!/usr/bin/env node

/**
 * Test Enrichment Script for LocalFirst Arizona
 * 
 * This script runs the enrichment pipeline on a small sample of businesses
 * for testing and validation purposes. Perfect for development and debugging.
 */

import { EnrichmentPipeline } from './enrich-businesses.js';

async function runTestEnrichment() {
  console.log('🧪 Starting LocalFirst Arizona Test Enrichment...\n');
  
  // Test configuration - small batch with verbose output
  const testConfig = {
    batchSize: 10,      // Process up to 10 businesses
    concurrency: 2,     // Lower concurrency for testing
    method: 'auto',     // Auto-select based on LFA membership
    priority: 'all',    // Include both LFA and non-LFA businesses
    verbose: 2,         // Verbose output for debugging
    dryRun: false,      // Make actual changes (set to true for preview)
    retryAttempts: 2,   // Fewer retries for testing
    requestDelayMs: 1000, // Shorter delays for faster testing
    resumeFile: './test-enrichment-progress.json',
    exportResults: './test-enrichment-results.json'
  };
  
  console.log('📋 Test Configuration:');
  console.log(`   • Batch Size: ${testConfig.batchSize}`);
  console.log(`   • Concurrency: ${testConfig.concurrency}`);
  console.log(`   • Method: ${testConfig.method}`);
  console.log(`   • Priority: ${testConfig.priority}`);
  console.log(`   • Dry Run: ${testConfig.dryRun ? 'Yes' : 'No'}`);
  console.log('');
  
  try {
    const pipeline = new EnrichmentPipeline(testConfig);
    await pipeline.run();
    
    console.log('\n✅ Test enrichment completed successfully!');
    console.log('📄 Check test-enrichment-results.json for detailed results');
    
  } catch (error) {
    console.error('\n❌ Test enrichment failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments for test overrides
function parseTestArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
        showTestHelp();
        process.exit(0);
      case '--dry-run':
        console.log('🧪 Test will run in DRY RUN mode - no database changes');
        break;
      case '--verbose':
        console.log('📢 Test will run with maximum verbosity');
        break;
    }
  }
}

function showTestHelp() {
  console.log(`
LocalFirst Arizona Test Enrichment Script

This script tests the enrichment pipeline on a small sample of businesses.

USAGE:
  node scripts/test-enrichment.js [OPTIONS]

OPTIONS:
  --dry-run           Preview mode, no database changes
  --verbose           Maximum verbosity output
  --help              Show this help

WHAT IT DOES:
  • Processes up to 10 sample businesses
  • Uses both Firecrawl (LFA members) and Playwright (others)
  • Generates test results in test-enrichment-results.json
  • Creates progress tracking in test-enrichment-progress.json
  • Provides detailed logging for debugging

PERFECT FOR:
  • Testing the pipeline before production runs
  • Debugging scraping and AI classification
  • Validating database updates
  • Checking cost estimates for Firecrawl
`);
}

// Run the test
parseTestArgs();
runTestEnrichment();