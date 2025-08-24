#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { businessCategories } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Update business taxonomy from configuration file
 * This script reads the taxonomy configuration and updates the database
 */

const updateTaxonomy = async () => {
  console.log('🔄 Updating business taxonomy...');

  // Load taxonomy configuration
  const taxonomyPath = path.join(process.cwd(), 'config', 'business-taxonomy.json');
  if (!fs.existsSync(taxonomyPath)) {
    console.error('❌ Taxonomy configuration file not found:', taxonomyPath);
    process.exit(1);
  }

  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
  console.log(`📋 Loaded taxonomy v${taxonomy.version} (${taxonomy.lastUpdated})`);

  try {
    // Database connection
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:../../local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    const db = drizzle(client, { schema: { businessCategories } });

    // Update primary categories
    console.log('📂 Updating primary categories...');
    let updatedCount = 0;
    let createdCount = 0;

    for (const [categoryKey, categoryData] of Object.entries(taxonomy.categories)) {
      // Check if category exists
      const existing = await db.select()
        .from(businessCategories)
        .where(eq(businessCategories.name, categoryKey))
        .limit(1);

      const categoryRecord = {
        name: categoryData.name,
        displayName: categoryData.displayName,
        description: categoryData.description,
        keywords: JSON.stringify(categoryData.keywords),
        iconName: categoryData.icon,
        colorCode: categoryData.color,
        sortOrder: categoryData.sortOrder,
        isActive: true,
        updatedAt: new Date().toISOString()
      };

      if (existing.length > 0) {
        // Update existing category
        await db.update(businessCategories)
          .set(categoryRecord)
          .where(eq(businessCategories.name, categoryKey));
        updatedCount++;
        console.log(`  ✅ Updated: ${categoryData.displayName}`);
      } else {
        // Create new category
        await db.insert(businessCategories).values({
          id: uuidv4(),
          ...categoryRecord,
          createdAt: new Date().toISOString()
        });
        createdCount++;
        console.log(`  ➕ Created: ${categoryData.displayName}`);
      }

      // Handle subcategories
      if (categoryData.subcategories && Object.keys(categoryData.subcategories).length > 0) {
        console.log(`    📁 Processing ${Object.keys(categoryData.subcategories).length} subcategories...`);
        
        for (const [subKey, subData] of Object.entries(categoryData.subcategories)) {
          const subCategoryRecord = {
            name: subData.name,
            parentCategoryId: categoryKey, // Reference to parent
            displayName: subData.displayName,
            description: subData.description || `${subData.displayName} services and businesses`,
            keywords: JSON.stringify(subData.keywords || []),
            sortOrder: 0,
            isActive: true
          };

          const existingSub = await db.select()
            .from(businessCategories)
            .where(eq(businessCategories.name, subKey))
            .limit(1);

          if (existingSub.length > 0) {
            await db.update(businessCategories)
              .set({
                ...subCategoryRecord,
                updatedAt: new Date().toISOString()
              })
              .where(eq(businessCategories.name, subKey));
            console.log(`      ✅ Updated subcategory: ${subData.displayName}`);
          } else {
            await db.insert(businessCategories).values({
              id: uuidv4(),
              ...subCategoryRecord,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            console.log(`      ➕ Created subcategory: ${subData.displayName}`);
          }
        }
      }
    }

    // Generate summary report
    console.log('\n📊 Taxonomy Update Summary:');
    console.log(`   Categories updated: ${updatedCount}`);
    console.log(`   Categories created: ${createdCount}`);
    
    // Count total categories and subcategories
    const totalCategories = await db.select().from(businessCategories);
    const primaryCategories = totalCategories.filter(cat => !cat.parentCategoryId);
    const subcategories = totalCategories.filter(cat => cat.parentCategoryId);
    
    console.log(`   Total primary categories: ${primaryCategories.length}`);
    console.log(`   Total subcategories: ${subcategories.length}`);
    
    // Save taxonomy metadata
    const metadataPath = path.join(process.cwd(), 'config', 'taxonomy-metadata.json');
    const metadata = {
      lastUpdated: new Date().toISOString(),
      version: taxonomy.version,
      totalCategories: primaryCategories.length,
      totalSubcategories: subcategories.length,
      attributeTypes: Object.keys(taxonomy.attributeTypes).length
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`💾 Saved taxonomy metadata to: ${metadataPath}`);

    console.log('\n✅ Taxonomy update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating taxonomy:', error);
    process.exit(1);
  }
};

// Export taxonomy loader function for use in other scripts
export const loadTaxonomy = () => {
  const taxonomyPath = path.join(process.cwd(), 'config', 'business-taxonomy.json');
  return JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
};

// Export category classification function
export const classifyBusiness = (businessName, websiteContent = '') => {
  const taxonomy = loadTaxonomy();
  const name = businessName.toLowerCase();
  const content = websiteContent.toLowerCase();
  
  const scores = {};
  
  // Score based on name patterns
  for (const [categoryKey, categoryData] of Object.entries(taxonomy.categories)) {
    let score = 0;
    
    // Check keywords in business name
    for (const keyword of categoryData.keywords) {
      if (name.includes(keyword.toLowerCase())) {
        score += 10; // High weight for name matches
      }
    }
    
    // Check keywords in website content (if available)
    if (content) {
      for (const keyword of categoryData.keywords) {
        const keywordCount = (content.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
        score += keywordCount * 2; // Medium weight for content matches
      }
    }
    
    // Check classification rules
    if (taxonomy.classificationRules.namePatterns) {
      for (const [ruleCategory, patterns] of Object.entries(taxonomy.classificationRules.namePatterns)) {
        if (categoryKey.includes(ruleCategory) || categoryData.name.includes(ruleCategory)) {
          for (const pattern of patterns) {
            if (name.includes(pattern.toLowerCase())) {
              score += 15; // Very high weight for specific patterns
            }
          }
        }
      }
    }
    
    if (score > 0) {
      scores[categoryKey] = score;
    }
  }
  
  // Return top classification with confidence
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sortedScores.length > 0) {
    const [topCategory, topScore] = sortedScores[0];
    const confidence = Math.min(topScore / 20, 1.0); // Normalize to 0-1
    
    return {
      primaryCategory: topCategory,
      confidence: confidence,
      alternatives: sortedScores.slice(1, 3).map(([cat, score]) => ({
        category: cat,
        confidence: Math.min(score / 20, 1.0)
      }))
    };
  }
  
  return {
    primaryCategory: 'other',
    confidence: 0.1,
    alternatives: []
  };
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateTaxonomy();
}