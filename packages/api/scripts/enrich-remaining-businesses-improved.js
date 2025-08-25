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
const PROGRESS_FILE = 'enrichment-progress-improved.json';

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
    failedBusinesses: [],
    skippedInvalidUrls: 0
  };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Improved URL validation and normalization
function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }
  
  // Clean the URL
  let url = rawUrl.trim();
  
  // Skip obviously invalid URLs
  const invalidPatterns = [
    /^(n\/a|na|N\/A|TBD|tbd)$/i,
    /^(none|null|undefined|-)$/i,
    /^[^.\s]+$/, // Single words without dots (like company names)
    /^\s*$/,     // Empty or whitespace only
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(url)) {
      return null;
    }
  }
  
  // Handle Facebook URLs - clean up complex query parameters
  if (url.includes('facebook.com')) {
    // Remove complex notification parameters
    url = url.replace(/[?&](notif_t|notif_id|ref|paipv|eav)=[^&]+/g, '');
    url = url.replace(/[?&]+$/, ''); // Clean trailing ? or &
  }
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Try https first for most sites
    url = `https://${url}`;
  }
  
  // Validate URL format
  try {
    new URL(url);
    return url;
  } catch (error) {
    return null;
  }
}

async function scrapeWebsite(rawUrl) {
  const normalizedUrl = normalizeUrl(rawUrl);
  
  if (!normalizedUrl) {
    return {
      success: false,
      error: 'Invalid or missing URL',
      url: rawUrl
    };
  }
  
  console.log(`   🌐 Scraping ${normalizedUrl}...`);
  
  // Try HTTPS first, then HTTP fallback
  const urlsToTry = [
    normalizedUrl,
    normalizedUrl.replace('https://', 'http://')
  ];
  
  for (let i = 0; i < urlsToTry.length; i++) {
    const url = urlsToTry[i];
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LocalFirstArizona/1.0; +https://localfirst.site)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 20000,
        redirect: 'follow',
        signal: AbortSignal.timeout(20000)
      });
      
      if (!response.ok) {
        if (i === 0 && urlsToTry.length > 1) {
          console.log(`   ⚠️  HTTPS failed (${response.status}), trying HTTP...`);
          continue; // Try HTTP fallback
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      
      // Extract text content (improved HTML stripping)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML entities
        .trim()
        .substring(0, 4000);
      
      return {
        success: true,
        content: textContent,
        url: url,
        source: 'improved_scraper'
      };
      
    } catch (error) {
      if (i === 0 && urlsToTry.length > 1) {
        console.log(`   ⚠️  HTTPS failed (${error.message}), trying HTTP...`);
        continue; // Try HTTP fallback
      }
      
      console.log(`   ❌ Scraping failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        url: url
      };
    }
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
    
    // Check if URL is valid before processing
    const normalizedUrl = normalizeUrl(business.website);
    if (!normalizedUrl) {
      console.log(`   ⚠️  Skipping invalid URL: ${business.website}`);
      progress.skippedInvalidUrls++;
      
      // Log as skipped
      await db.insert(enrichmentLogs).values({
        id: uuidv4(),
        businessId: business.id,
        enrichmentType: 'full',
        status: 'skipped',
        errorMessage: 'Invalid or missing URL',
        processingTimeMs: Date.now() - startTime,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString()
      });
      
      return false;
    }
    
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
            enrichmentSource: 'improved_firecrawl'
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
            url: scrapeResult.url, 
            content: scrapeResult.content.substring(0, 1000),
            source: 'improved_scraper'
          }),
          aiResponse: JSON.stringify(aiResult),
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString()
        });
        
        progress.successful++;
        progress.estimatedCost += 0.08;
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
  console.log('🚀 IMPROVED Firecrawl Enrichment - Better URL Handling');
  console.log('=' .repeat(60));
  
  const progress = loadProgress();
  
  try {
    // Database connection
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses, enrichmentLogs } });
    
    // Get businesses that need enrichment, prioritizing LFA members
    const businessesToEnrich = await db.select()
      .from(businesses)
      .where(and(
        isNotNull(businesses.website),
        isNull(businesses.primaryCategory),
        eq(businesses.status, 'active')
      ))
      .orderBy(desc(businesses.lfaMember), businesses.id)
      .limit(500); // Process in smaller batches for better monitoring
    
    const lfaCount = businessesToEnrich.filter(b => b.lfaMember).length;
    const nonLfaCount = businessesToEnrich.length - lfaCount;
    
    console.log(`\n📊 Found ${businessesToEnrich.length} businesses to enrich (batch of 500):`);
    console.log(`   👑 LFA Members: ${lfaCount}`);
    console.log(`   📋 Non-LFA: ${nonLfaCount}`);
    console.log(`   💰 Estimated batch cost: $${(businessesToEnrich.length * 0.08).toFixed(2)}`);
    console.log(`   ⏱️  Estimated time: ${(businessesToEnrich.length * 4 / 60).toFixed(1)} minutes`);
    
    if (businessesToEnrich.length === 0) {
      console.log('🎉 No businesses found in this batch - may be complete!');
      return;
    }
    
    console.log(`\nStarting improved enrichment in 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Process businesses
    for (let i = 0; i < businessesToEnrich.length; i++) {
      const business = businessesToEnrich[i];
      
      await enrichBusiness(business, db, progress);
      
      progress.processed = i + 1;
      progress.lastProcessedId = business.id;
      
      // Save progress every 10 businesses for better monitoring
      if (progress.processed % 10 === 0) {
        saveProgress(progress);
        const totalAttempts = progress.successful + progress.failed;
        const successRate = totalAttempts > 0 ? (progress.successful / totalAttempts * 100) : 0;
        console.log(`\n💾 Progress: ${progress.processed}/${businessesToEnrich.length}`);
        console.log(`   ✅ Successful: ${progress.successful}`);
        console.log(`   ❌ Failed: ${progress.failed}`);
        console.log(`   ⚠️  Skipped (invalid URLs): ${progress.skippedInvalidUrls}`);
        console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
        console.log(`   💰 Cost so far: $${progress.estimatedCost.toFixed(2)}`);
      }
      
      // Rate limiting - wait between requests
      if (i < businessesToEnrich.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2 second delay
      }
    }
    
    // Final summary
    progress.endTime = new Date().toISOString();
    saveProgress(progress);
    
    const duration = Math.round((new Date(progress.endTime).getTime() - new Date(progress.startTime).getTime()) / 1000 / 60);
    const totalAttempts = progress.successful + progress.failed;
    const successRate = totalAttempts > 0 ? (progress.successful / totalAttempts * 100) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 IMPROVED ENRICHMENT BATCH COMPLETED!');
    console.log('='.repeat(60));
    console.log(`📊 Results:`);
    console.log(`   ✅ Successfully enriched: ${progress.successful}`);
    console.log(`   ❌ Failed: ${progress.failed}`);
    console.log(`   ⚠️  Skipped (invalid URLs): ${progress.skippedInvalidUrls}`);
    console.log(`   📈 Success rate: ${successRate.toFixed(1)}%`);
    console.log(`   💰 Cost: $${progress.estimatedCost.toFixed(2)}`);
    console.log(`   ⏱️  Duration: ${duration} minutes`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    saveProgress(progress);
    process.exit(1);
  }
}

main().catch(console.error);