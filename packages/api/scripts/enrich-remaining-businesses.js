#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses, enrichmentLogs } from '../src/db/schema.js';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env.local' });
dotenv.config({ path: '.env' });

// Load taxonomy
const taxonomyPath = path.join(process.cwd(), 'config', 'business-taxonomy.json');
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Progress tracking
const PROGRESS_FILE = 'enrichment-progress-remaining.json';

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('⚠️ Could not load progress file, starting fresh');
  }
  return {
    startTime: new Date().toISOString(),
    processed: 0,
    successful: 0,
    failed: 0,
    estimatedCost: 0,
    lastProcessedId: null,
    failedBusinesses: []
  };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function scrapeWebsite(url) {
  try {
    console.log(`   🌐 Scraping ${url}...`);
    
    const response = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      headers: {
        'User-Agent': 'LocalFirstArizona/1.0 (business-directory-app)'
      },
      timeout: 15000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract text content (basic HTML stripping)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000); // More content for better classification
    
    return {
      success: true,
      content: textContent,
      url: url,
      source: 'firecrawl'
    };
    
  } catch (error) {
    console.log(`   ❌ Scraping failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
}

async function classifyWithOpenAI(business, scrapedContent) {
  try {
    const categories = Object.keys(taxonomy.categories).map(key => {
      const cat = taxonomy.categories[key];
      return `${key} (${cat.displayName}): ${cat.subcategories.join(', ')}`;
    }).join('\n');

    const prompt = `Analyze this Arizona business and classify it using the provided taxonomy. 

Business Name: ${business.name}
Address: ${business.address}
Phone: ${business.phone || 'N/A'}
Website Content: ${scrapedContent}

TAXONOMY CATEGORIES:
${categories}

Please classify this business and respond with ONLY a valid JSON object in this format:
{
  "primaryCategory": "category_key",
  "subcategory": "subcategory_name", 
  "confidence": 0.85,
  "description": "X is a Y type of business with a variety of offerings serving people with Z needs. It distinguishes itself by doing A, B & C and offers the following services/products: [specific list]",
  "keywords": ["specific", "relevant", "keywords", "based", "on", "content"],
  "productsServices": ["specific service 1", "specific service 2", "product category"],
  "attributes": {
    "locally_owned": true,
    "specialty_focus": "what makes them unique"
  }
}

Requirements:
- Use ONLY categories from the taxonomy above
- Description should be 100-300 words explaining what they do, who they serve, what makes them special
- Keywords should be specific to their business (not generic)
- Products/Services should list actual offerings found on their website
- Be specific and informative, not generic`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a business classification expert. Analyze the provided business information and classify it according to the given taxonomy. Respond with only valid JSON.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const aiResponse = response.choices[0].message.content.trim();
    
    // Parse JSON response
    let result;
    try {
      result = JSON.parse(aiResponse);
    } catch (parseError) {
      // Try to extract JSON from response if there's extra text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate required fields
    if (!result.primaryCategory || !result.description || !result.keywords) {
      throw new Error('Missing required fields in OpenAI response');
    }

    // Validate category exists in taxonomy
    if (!taxonomy.categories[result.primaryCategory]) {
      console.log(`   ⚠️  Unknown category ${result.primaryCategory}, defaulting to 'other'`);
      result.primaryCategory = 'other';
      result.subcategory = result.subcategory || 'specialty_services';
    }

    return {
      success: true,
      ...result,
      processingTime: 2500
    };

  } catch (error) {
    console.log(`   ❌ AI classification failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function enrichBusiness(business, db, progress) {
  const startTime = Date.now();
  
  try {
    console.log(`\n📋 Processing: ${business.name}`);
    console.log(`   🌐 Website: ${business.website}`);
    console.log(`   👑 LFA Member: ${business.lfaMember ? 'Yes' : 'No'}`);
    
    // Update status to in_progress
    await db.update(businesses)
      .set({ enrichmentStatus: 'in_progress' })
      .where(eq(businesses.id, business.id));
    
    // Scrape website
    const scrapeResult = await scrapeWebsite(business.website);
    
    if (scrapeResult.success) {
      console.log(`   ✅ Scraped successfully (${scrapeResult.content.length} chars)`);
      
      // Classify with OpenAI
      const aiResult = await classifyWithOpenAI(business, scrapeResult.content);
      
      if (aiResult.success) {
        console.log(`   🤖 Classified as: ${aiResult.primaryCategory} > ${aiResult.subcategory} (${(aiResult.confidence * 100).toFixed(1)}%)`);
        console.log(`   📝 Description: ${aiResult.description.substring(0, 80)}...`);
        console.log(`   🏷️  Keywords: ${aiResult.keywords.slice(0, 3).join(', ')}...`);
        
        // Update business with enriched data
        await db.update(businesses)
          .set({
            primaryCategory: aiResult.primaryCategory,
            subcategory: aiResult.subcategory,
            businessDescription: aiResult.description,
            productsServices: JSON.stringify(aiResult.productsServices),
            keywords: aiResult.keywords.join(', '),
            businessAttributes: JSON.stringify(aiResult.attributes || {}),
            enrichmentStatus: 'completed',
            enrichmentDate: new Date().toISOString(),
            enrichmentSource: 'firecrawl'
          })
          .where(eq(businesses.id, business.id));
        
        // Log success
        await db.insert(enrichmentLogs).values({
          id: uuidv4(),
          businessId: business.id,
          enrichmentType: 'full',
          status: 'success',
          confidenceScore: aiResult.confidence,
          processingTimeMs: Date.now() - startTime,
          rawData: JSON.stringify({ 
            url: business.website, 
            content: scrapeResult.content.substring(0, 1000),
            source: 'firecrawl'
          }),
          aiResponse: JSON.stringify(aiResult),
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString()
        });
        
        progress.successful++;
        progress.estimatedCost += 0.08; // $0.08 per successful enrichment (OpenAI + Firecrawl)
        console.log(`   ✅ Successfully enriched ${business.name}`);
        return true;
        
      } else {
        throw new Error(`AI classification failed: ${aiResult.error}`);
      }
    } else {
      throw new Error(`Scraping failed: ${scrapeResult.error}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Failed to enrich ${business.name}: ${error.message}`);
    
    progress.failed++;
    progress.failedBusinesses.push({
      id: business.id,
      name: business.name,
      website: business.website,
      error: error.message
    });
    
    // Log failure
    await db.insert(enrichmentLogs).values({
      id: uuidv4(),
      businessId: business.id,
      enrichmentType: 'full',
      status: 'error',
      errorMessage: error.message,
      processingTimeMs: Date.now() - startTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString()
    });
    
    // Reset status for retry
    await db.update(businesses)
      .set({ enrichmentStatus: 'pending' })
      .where(eq(businesses.id, business.id));
      
    return false;
  }
}

async function main() {
  console.log('🚀 Firecrawl Enrichment - Processing ALL Remaining Businesses');
  console.log('=' .repeat(60));
  
  const progress = loadProgress();
  
  try {
    // Database connection
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses, enrichmentLogs } });
    
    // Get all businesses that need enrichment, prioritizing LFA members
    const businessesToEnrich = await db.select()
      .from(businesses)
      .where(and(
        isNotNull(businesses.website),
        isNull(businesses.primaryCategory), // Not yet enriched
        eq(businesses.status, 'active')
      ))
      .orderBy(desc(businesses.lfaMember), businesses.id);
    
    const lfaCount = businessesToEnrich.filter(b => b.lfaMember).length;
    const nonLfaCount = businessesToEnrich.length - lfaCount;
    
    console.log(`\n📊 Found ${businessesToEnrich.length} businesses to enrich:`);
    console.log(`   👑 LFA Members: ${lfaCount}`);
    console.log(`   📋 Non-LFA: ${nonLfaCount}`);
    console.log(`   💰 Estimated total cost: $${(businessesToEnrich.length * 0.08).toFixed(2)} (Firecrawl + OpenAI)`);
    console.log(`   ⏱️  Estimated time: ${(businessesToEnrich.length * 5 / 60).toFixed(1)} minutes`);
    
    if (businessesToEnrich.length === 0) {
      console.log('🎉 No businesses found - all appear to be enriched already!');
      return;
    }
    
    console.log(`\nStarting in 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Process businesses
    for (let i = 0; i < businessesToEnrich.length; i++) {
      const business = businessesToEnrich[i];
      
      // Skip if already processed (resume capability)
      if (progress.lastProcessedId && business.id === progress.lastProcessedId) {
        console.log(`📍 Resuming from business: ${business.name}`);
        continue;
      }
      
      await enrichBusiness(business, db, progress);
      
      progress.processed = i + 1;
      progress.lastProcessedId = business.id;
      
      // Save progress every 25 businesses
      if (progress.processed % 25 === 0) {
        saveProgress(progress);
        console.log(`\n💾 Progress saved: ${progress.processed}/${businessesToEnrich.length} (${progress.successful} successful, ${progress.failed} failed)`);
        console.log(`💰 Estimated cost so far: $${progress.estimatedCost.toFixed(2)}`);
        console.log(`📊 Success rate: ${((progress.successful / progress.processed) * 100).toFixed(1)}%`);
        
        // Brief pause for rate limiting
        console.log('⏸️  Brief pause...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Rate limiting - wait between requests
      if (i < businessesToEnrich.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
      }
    }
    
    // Final summary
    progress.endTime = new Date().toISOString();
    saveProgress(progress);
    
    const duration = Math.round((new Date(progress.endTime).getTime() - new Date(progress.startTime).getTime()) / 1000 / 60);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 FIRECRAWL ENRICHMENT COMPLETED!');
    console.log('='.repeat(60));
    console.log(`📊 Final Results:`);
    console.log(`   ✅ Successfully enriched: ${progress.successful}`);
    console.log(`   ❌ Failed: ${progress.failed}`);
    console.log(`   📈 Success rate: ${((progress.successful / businessesToEnrich.length) * 100).toFixed(1)}%`);
    console.log(`   💰 Total estimated cost: $${progress.estimatedCost.toFixed(2)}`);
    console.log(`   ⏱️  Duration: ${duration} minutes`);
    
    if (progress.failedBusinesses.length > 0) {
      console.log(`\n⚠️  Failed businesses (${progress.failedBusinesses.length}):`);
      progress.failedBusinesses.slice(0, 10).forEach(fb => {
        console.log(`   - ${fb.name} (${fb.website}): ${fb.error}`);
      });
      if (progress.failedBusinesses.length > 10) {
        console.log(`   ... and ${progress.failedBusinesses.length - 10} more`);
      }
    }
    
    client.close();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    saveProgress(progress);
    process.exit(1);
  }
}

main().catch(console.error);