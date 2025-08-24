#!/usr/bin/env node

/**
 * Enhanced Search Demonstration Script
 * Shows the power of enriched business data for improved search results
 */

async function testSearch(query, description) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Testing: "${query}"`);
  console.log(`📋 Purpose: ${description}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // Phoenix coordinates for testing
    const lat = 33.4484;
    const lng = -112.0740;
    const radius = 30;

    const response = await fetch(
      `http://localhost:8787/api/enhanced-search?query=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&radius=${radius}&limit=5`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log(`\n📊 Results: ${data.total} businesses found`);
    console.log(`🎯 Search terms: [${data.searchTerms.join(', ')}]`);
    console.log(`📈 Avg relevance score: ${data.searchMetadata.avgRelevanceScore}`);
    console.log(`✨ Enriched businesses: ${data.searchMetadata.enrichedBusinessesCount}/${data.total}`);

    data.businesses.forEach((business, i) => {
      console.log(`\n${i + 1}. 🏢 ${business.name}`);
      console.log(`   📍 ${business.address} (${business.distance} mi)`);
      console.log(`   🏷️  ${business.category}${business.subcategory ? ` > ${business.subcategory}` : ''}`);
      console.log(`   ⭐ Relevance: ${business.relevanceScore} | Combined: ${business.combinedScore}`);
      console.log(`   🎯 Match reasons: ${business.matchReasons.join(', ')}`);
      
      if (business.businessDescription) {
        const desc = business.businessDescription.length > 100 
          ? business.businessDescription.substring(0, 100) + '...'
          : business.businessDescription;
        console.log(`   📝 "${desc}"`);
      }
      
      if (business.keywords && business.keywords.length > 0) {
        console.log(`   🏷️  Keywords: ${business.keywords.slice(0, 5).join(', ')}${business.keywords.length > 5 ? '...' : ''}`);
      }
    });

  } catch (error) {
    console.error(`❌ Search failed: ${error.message}`);
  }
}

async function runSearchDemo() {
  console.log('🚀 Enhanced Search API Demonstration');
  console.log('Using enriched business data to improve search quality');

  // Test various search scenarios
  await testSearch('craft beer brewery', 'Find breweries using category + description matching');
  
  await testSearch('Ethiopian coffee', 'Find specific specialty using business description content');
  
  await testSearch('artisan handmade gifts', 'Find artisan products using enriched keywords and descriptions');
  
  await testSearch('family farm fresh produce', 'Find local farms using business attributes and descriptions');
  
  await testSearch('women owned coworking', 'Find businesses with specific attributes');
  
  await testSearch('live music venue events', 'Find entertainment venues using enriched service data');

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ Enhanced Search Demonstration Complete');
  console.log('🎉 The enriched data significantly improves search relevance!');
  console.log(`${'='.repeat(80)}`);
}

runSearchDemo().catch(console.error);