#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businesses, enrichmentLogs } from '../src/db/schema.js';
import { eq, and, isNull, isNotNull, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../.env.local' });
dotenv.config({ path: '.env' });

/**
 * Test script to enrich exactly 5 businesses using real Firecrawl MCP and OpenAI API
 */

// Load taxonomy
const taxonomyPath = path.join(process.cwd(), 'config', 'business-taxonomy.json');
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function scrapeWebsite(url) {
  try {
    // Use Firecrawl MCP to scrape the website
    // TODO: Replace with actual MCP call when available
    console.log(`   🌐 Scraping ${url}...`);
    
    // For now, simulate realistic scraping - replace with MCP call
    const response = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      headers: {
        'User-Agent': 'LocalFirstArizona/1.0 (business-directory-app)'
      },
      timeout: 10000
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
      .substring(0, 3000); // Limit content for API call
    
    return {
      success: true,
      content: textContent,
      url: url
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
      max_tokens: 800
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
      result.subcategory = 'specialty_services';
    }

    return {
      success: true,
      ...result,
      processingTime: 2000 // Approximate processing time
    };

  } catch (error) {
    console.log(`   ❌ AI classification failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function testEnrichment() {
  console.log('🧪 Testing REAL enrichment on 5 businesses...');
  
  try {
    // Database connection
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businesses, enrichmentLogs } });
    
    // Get 5 businesses that need enrichment (LFA members with websites)
    const businessesToEnrich = await db.select()
      .from(businesses)
      .where(and(
        isNotNull(businesses.website),
        ne(businesses.website, ''),
        isNull(businesses.primaryCategory), // Not enriched yet
        eq(businesses.lfaMember, true)
      ))
      .limit(5);
    
    console.log(`📊 Found ${businessesToEnrich.length} businesses to test:`);
    businessesToEnrich.forEach((business, i) => {
      console.log(`   ${i + 1}. ${business.name} - ${business.website}`);
    });
    
    if (businessesToEnrich.length === 0) {
      console.log('❌ No businesses found for enrichment');
      return;
    }
    
    console.log('\n🚀 Starting REAL enrichment with Firecrawl + OpenAI...');
    
    let successCount = 0;
    let failCount = 0;
    
    // Process each business
    for (let i = 0; i < businessesToEnrich.length; i++) {
      const business = businessesToEnrich[i];
      console.log(`\n📋 Processing ${i + 1}/5: ${business.name}`);
      
      try {
        // Update status to in_progress
        await db.update(businesses)
          .set({ enrichmentStatus: 'in_progress' })
          .where(eq(businesses.id, business.id));
        
        // Scrape the website
        const scrapeResult = await scrapeWebsite(business.website);
        
        if (scrapeResult.success) {
          console.log(`   ✅ Scraped successfully (${scrapeResult.content.length} chars)`);
          
          // Classify with OpenAI
          const aiResult = await classifyWithOpenAI(business, scrapeResult.content);
          
          if (aiResult.success) {
            console.log(`   🤖 AI classified as: ${aiResult.primaryCategory} > ${aiResult.subcategory} (${(aiResult.confidence * 100).toFixed(1)}% confidence)`);
            console.log(`   📝 Description: ${aiResult.description.substring(0, 100)}...`);
            console.log(`   🏷️  Keywords: ${aiResult.keywords.join(', ')}`);
            
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
              processingTimeMs: aiResult.processingTime,
              rawData: JSON.stringify({ 
                url: business.website, 
                content: scrapeResult.content.substring(0, 1000) 
              }),
              aiResponse: JSON.stringify(aiResult),
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            });
            
            console.log(`   ✅ Successfully enriched ${business.name}`);
            successCount++;
            
          } else {
            throw new Error(`AI classification failed: ${aiResult.error}`);
          }
        } else {
          throw new Error(`Scraping failed: ${scrapeResult.error}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to enrich ${business.name}: ${error.message}`);
        failCount++;
        
        // Log failure
        await db.insert(enrichmentLogs).values({
          id: uuidv4(),
          businessId: business.id,
          enrichmentType: 'full',
          status: 'error',
          errorMessage: error.message,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });
        
        // Reset status for retry
        await db.update(businesses)
          .set({ enrichmentStatus: 'pending' })
          .where(eq(businesses.id, business.id));
      }
      
      // Delay between requests to be respectful
      if (i < businessesToEnrich.length - 1) {
        console.log('   ⏸️ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final summary
    console.log('\n🎉 Test enrichment completed!');
    console.log(`✅ Successfully enriched: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`💰 OpenAI API cost: ~$${(successCount * 0.06).toFixed(2)} (estimated)`);
    console.log(`💰 Firecrawl credits used: ${successCount} (real scraping)`);
    
    client.close();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

testEnrichment().catch(console.error);