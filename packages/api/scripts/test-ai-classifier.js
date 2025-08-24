#!/usr/bin/env node

/**
 * AI Classification Service Test Script
 * 
 * This script validates the AI classification service with sample business data
 * to ensure it works correctly before integration with the enrichment pipeline.
 * 
 * Usage:
 *   # Basic test with sample data
 *   node scripts/test-ai-classifier.js
 * 
 *   # Test with custom business data
 *   node scripts/test-ai-classifier.js --business-id <id>
 * 
 *   # Verbose output
 *   node scripts/test-ai-classifier.js --verbose
 * 
 *   # Test all functions
 *   node scripts/test-ai-classifier.js --full-test
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import AIClassificationService from '../services/ai-classifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample business data for testing
const SAMPLE_BUSINESSES = [
  {
    id: 'test-001',
    name: 'Desert Rose Bakery & Café',
    address: '123 Main Street, Phoenix, AZ 85001',
    phone: '(602) 555-0123',
    website: 'https://desertrosebakery.com',
    category: 'restaurant'
  },
  {
    id: 'test-002',  
    name: 'Valley Fitness Center',
    address: '456 Fitness Ave, Scottsdale, AZ 85251',
    phone: '(480) 555-0456',
    website: 'https://valleyfitness.com',
    category: 'fitness'
  },
  {
    id: 'test-003',
    name: 'Arizona Auto Repair',
    address: '789 Mechanic Blvd, Mesa, AZ 85203',
    phone: '(623) 555-0789',
    website: 'https://azautorepair.com',
    category: 'automotive'
  },
  {
    id: 'test-004',
    name: 'Smith & Associates Law Firm',
    address: '321 Legal Lane, Tempe, AZ 85281',
    phone: '(480) 555-0321',
    website: 'https://smithlawaz.com',
    category: 'legal'
  },
  {
    id: 'test-005',
    name: 'Cactus Bloom Hair Salon',
    address: '654 Beauty Blvd, Chandler, AZ 85225',
    phone: '(480) 555-0654',
    website: 'https://cactusbloonsalon.com',
    category: 'beauty'
  }
];

// Sample scraped content for different business types
const SAMPLE_SCRAPED_CONTENT = {
  'test-001': {
    title: 'Desert Rose Bakery & Café - Fresh Artisan Baked Goods',
    description: 'Family-owned bakery serving fresh artisan breads, pastries, and coffee since 2015',
    content: `Welcome to Desert Rose Bakery & Café, a family-owned Arizona business serving the Phoenix community since 2015. We specialize in fresh-baked artisan breads, croissants, muffins, and custom cakes. Our coffee is locally roasted and we're proud to support local farmers. We offer catering services for weddings and corporate events. Hours: Monday-Friday 6AM-6PM, Saturday-Sunday 7AM-4PM. We use organic ingredients whenever possible and offer gluten-free options. Our signature items include sourdough bread, bear claws, and our famous Arizona sunset cake. Family-owned and operated with three generations of baking expertise.`,
    metadata: {
      phone: '(602) 555-0123',
      address: '123 Main Street, Phoenix, AZ',
      hours: 'Mon-Fri 6AM-6PM, Sat-Sun 7AM-4PM'
    }
  },
  'test-002': {
    title: 'Valley Fitness Center - Complete Fitness Solutions',
    description: 'State-of-the-art fitness facility with personal training and group classes',
    content: `Valley Fitness Center offers complete fitness solutions for Scottsdale and surrounding areas. Our 15,000 sq ft facility features state-of-the-art cardio and strength equipment, group fitness classes, and certified personal trainers. We offer 24/7 access for members, steam rooms, and nutritional counseling. Our classes include yoga, Pilates, Zumba, spin, and crossfit. We have been serving the Arizona community for over 10 years and are veteran-owned. Free guest passes available and we accept all major insurance plans. Special programs for seniors and youth athletics.`,
    metadata: {
      phone: '(480) 555-0456',
      address: '456 Fitness Ave, Scottsdale, AZ',
      hours: '24/7 for members, staffed Mon-Fri 5AM-10PM'
    }
  },
  'test-003': {
    title: 'Arizona Auto Repair - ASE Certified Mechanics',
    description: 'Professional automotive repair and maintenance services',
    content: `Arizona Auto Repair has been serving Mesa and the East Valley for over 20 years. Our ASE-certified technicians provide comprehensive automotive services including oil changes, brake repair, transmission service, engine diagnostics, and air conditioning repair. We work on all makes and models, both foreign and domestic. Licensed and bonded with a 12-month/12,000 mile warranty on all repairs. We offer free estimates, shuttle service, and accept all major insurance companies. Emergency roadside assistance available 24/7. Family-owned business committed to honest, reliable service.`,
    metadata: {
      phone: '(623) 555-0789',
      address: '789 Mechanic Blvd, Mesa, AZ',
      hours: 'Mon-Fri 7AM-6PM, Sat 8AM-4PM'
    }
  },
  'test-004': {
    title: 'Smith & Associates Law Firm - Arizona Legal Experts',
    description: 'Experienced attorneys providing comprehensive legal services',
    content: `Smith & Associates Law Firm has been providing exceptional legal services to Arizona residents and businesses for over 25 years. Our experienced attorneys specialize in personal injury, family law, criminal defense, business law, and estate planning. We are committed to protecting our clients\' rights and achieving the best possible outcomes. Free consultations available and we work on contingency for personal injury cases. Our team includes certified specialists and we have offices in Tempe, Phoenix, and Tucson. Bilingual services available and we accept payment plans.`,
    metadata: {
      phone: '(480) 555-0321',
      address: '321 Legal Lane, Tempe, AZ',
      hours: 'Mon-Fri 8AM-6PM, Saturday by appointment'
    }
  },
  'test-005': {
    title: 'Cactus Bloom Hair Salon - Full Service Beauty',
    description: 'Professional hair and beauty services in a relaxing environment',
    content: `Cactus Bloom Hair Salon is Chandler\\'s premier full-service beauty salon. Our experienced stylists provide haircuts, coloring, highlights, perms, and styling for men and women. We also offer manicures, pedicures, facials, and waxing services. We use only professional products from top brands like Redken and Paul Mitchell. Walk-ins welcome or schedule your appointment online. We specialize in wedding and special event styling. Our salon has been woman-owned and operated since 2010, and we\\'re proud to support local Arizona beauty professionals.`,
    metadata: {
      phone: '(480) 555-0654',
      address: '654 Beauty Blvd, Chandler, AZ',
      hours: 'Tue-Fri 9AM-7PM, Sat 8AM-5PM, Sun 10AM-4PM'
    }
  }
};

class AIClassifierTester {
  constructor(options = {}) {
    this.config = {
      verbose: options.verbose || false,
      fullTest: options.fullTest || false,
      businessId: options.businessId || null,
      mockMode: !process.env.OPENAI_API_KEY // Use mock mode if no API key
    };
    
    this.results = [];
    this.errors = [];
    this.startTime = null;
  }

  /**
   * Create and configure classifier for testing
   */
  async createClassifier() {
    const classifier = new AIClassificationService({
      verbose: this.config.verbose,
      apiKey: this.config.mockMode ? 'mock-key' : process.env.OPENAI_API_KEY
    });
    
    if (this.config.mockMode) {
      classifier.openai = this.createMockOpenAI();
    } else {
      await classifier.initializeOpenAI();
    }
    
    return classifier;
  }

  /**
   * Run all tests
   */
  async runTests() {
    this.startTime = Date.now();
    
    console.log('🧪 AI Classification Service Test Suite');
    console.log('==========================================');
    
    if (this.config.mockMode) {
      console.log('⚠️  Mock mode enabled - no actual API calls will be made');
      console.log('   To test with real OpenAI API, set OPENAI_API_KEY environment variable\n');
    } else {
      console.log('✅ Live mode - testing with OpenAI API\n');
    }

    try {
      // Test 1: Service initialization
      await this.testServiceInitialization();
      
      // Test 2: Single business classification
      await this.testSingleBusinessClassification();
      
      if (this.config.fullTest) {
        // Test 3: Description generation
        await this.testDescriptionGeneration();
        
        // Test 4: Products/services extraction
        await this.testProductsServicesExtraction();
        
        // Test 5: Keywords generation
        await this.testKeywordsGeneration();
        
        // Test 6: Business attributes detection
        await this.testBusinessAttributesDetection();
        
        // Test 7: Bulk processing
        await this.testBulkProcessing();
      }
      
      // Generate summary report
      this.generateSummary();
      
    } catch (error) {
      console.error(`💥 Test suite failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Test service initialization
   */
  async testServiceInitialization() {
    console.log('🔧 Test 1: Service Initialization');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      if (this.config.mockMode) {
        console.log('✅ Mock OpenAI client initialized');
      }
      
      // Test taxonomy loading
      const taxonomy = await classifier.loadTaxonomy();
      const categoryCount = Object.keys(taxonomy.categories).length;
      
      console.log(`✅ Service initialized successfully`);
      console.log(`✅ Taxonomy loaded: ${categoryCount} categories`);
      console.log(`✅ Configuration: Model=${classifier.config.model}, Cache=${classifier.config.enableCache}\n`);
      
      this.results.push({
        test: 'Service Initialization',
        status: 'passed',
        details: { categoryCount, model: classifier.config.model }
      });
      
    } catch (error) {
      console.log(`❌ Service initialization failed: ${error.message}\n`);
      this.errors.push({
        test: 'Service Initialization',
        error: error.message
      });
    }
  }

  /**
   * Test single business classification
   */
  async testSingleBusinessClassification() {
    console.log('🏢 Test 2: Single Business Classification');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      // Test each sample business
      const businesses = this.config.businessId 
        ? SAMPLE_BUSINESSES.filter(b => b.id === this.config.businessId)
        : SAMPLE_BUSINESSES.slice(0, 2); // Test first 2 in regular mode
      
      for (const business of businesses) {
        const scrapedContent = SAMPLE_SCRAPED_CONTENT[business.id];
        const startTime = Date.now();
        
        console.log(`\n📊 Testing: ${business.name}`);
        
        const result = await classifier.classifyBusiness(business, scrapedContent);
        const processingTime = Date.now() - startTime;
        
        if (result.success) {
          console.log(`✅ Classification: ${result.primaryCategory}`);
          console.log(`✅ Confidence: ${result.confidence}`);
          console.log(`✅ Processing time: ${processingTime}ms`);
          
          if (this.config.verbose && result.reasoning) {
            console.log(`📝 Reasoning: ${result.reasoning}`);
          }
          
          this.results.push({
            test: `Classification - ${business.name}`,
            status: 'passed',
            details: {
              category: result.primaryCategory,
              confidence: result.confidence,
              processingTime: processingTime
            }
          });
          
        } else {
          console.log(`❌ Classification failed: ${result.error}`);
          this.errors.push({
            test: `Classification - ${business.name}`,
            error: result.error
          });
        }
      }
      
      console.log(`\n📈 Stats: ${classifier.getStats()}\n`);
      
    } catch (error) {
      console.log(`❌ Classification test failed: ${error.message}\n`);
      this.errors.push({
        test: 'Single Business Classification',
        error: error.message
      });
    }
  }

  /**
   * Test description generation
   */
  async testDescriptionGeneration() {
    console.log('📝 Test 3: Description Generation');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      const business = SAMPLE_BUSINESSES[0];
      const scrapedContent = SAMPLE_SCRAPED_CONTENT[business.id];
      
      console.log(`\n📊 Testing description for: ${business.name}`);
      
      const result = await classifier.generateDescription(business, scrapedContent);
      
      if (result.success) {
        console.log(`✅ Description generated (${result.characterCount} chars)`);
        if (this.config.verbose) {
          console.log(`📖 Description: ${result.description}`);
          console.log(`📊 Quality scores: ${JSON.stringify(result.qualityMetrics, null, 2)}`);
        }
        
        this.results.push({
          test: 'Description Generation',
          status: 'passed',
          details: {
            characterCount: result.characterCount,
            qualityMetrics: result.qualityMetrics
          }
        });
      } else {
        console.log(`❌ Description generation failed: ${result.error}`);
        this.errors.push({
          test: 'Description Generation',
          error: result.error
        });
      }
      
    } catch (error) {
      console.log(`❌ Description test failed: ${error.message}`);
      this.errors.push({
        test: 'Description Generation',
        error: error.message
      });
    }
    
    console.log();
  }

  /**
   * Test products/services extraction
   */
  async testProductsServicesExtraction() {
    console.log('🛍️ Test 4: Products/Services Extraction');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      const business = SAMPLE_BUSINESSES[1]; // Fitness center
      const scrapedContent = SAMPLE_SCRAPED_CONTENT[business.id];
      
      console.log(`\n📊 Testing products/services for: ${business.name}`);
      
      const result = await classifier.extractProductsServices(business, scrapedContent);
      
      if (result.success) {
        console.log(`✅ Products/services extracted (confidence: ${result.confidence})`);
        if (this.config.verbose) {
          console.log(`📦 Data: ${JSON.stringify(result.data, null, 2)}`);
        }
        
        this.results.push({
          test: 'Products/Services Extraction',
          status: 'passed',
          details: {
            confidence: result.confidence,
            extractedItems: Object.values(result.data).reduce((sum, arr) => sum + arr.length, 0)
          }
        });
      } else {
        console.log(`❌ Products/services extraction failed: ${result.error}`);
        this.errors.push({
          test: 'Products/Services Extraction',
          error: result.error
        });
      }
      
    } catch (error) {
      console.log(`❌ Products/services test failed: ${error.message}`);
      this.errors.push({
        test: 'Products/Services Extraction',
        error: error.message
      });
    }
    
    console.log();
  }

  /**
   * Test keywords generation
   */
  async testKeywordsGeneration() {
    console.log('🔍 Test 5: Keywords Generation');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      const business = SAMPLE_BUSINESSES[2]; // Auto repair
      const scrapedContent = SAMPLE_SCRAPED_CONTENT[business.id];
      
      console.log(`\n📊 Testing keywords for: ${business.name}`);
      
      const result = await classifier.generateKeywords(business, scrapedContent, 'automotive');
      
      if (result.success) {
        const totalKeywords = Object.values(result.keywords).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`✅ Keywords generated: ${totalKeywords} total`);
        
        if (this.config.verbose) {
          console.log(`🔍 Keywords: ${JSON.stringify(result.keywords, null, 2)}`);
          console.log(`📊 Scores: ${JSON.stringify(result.relevanceScores, null, 2)}`);
        }
        
        this.results.push({
          test: 'Keywords Generation',
          status: 'passed',
          details: {
            totalKeywords,
            categories: Object.keys(result.keywords).length
          }
        });
      } else {
        console.log(`❌ Keywords generation failed: ${result.error}`);
        this.errors.push({
          test: 'Keywords Generation',
          error: result.error
        });
      }
      
    } catch (error) {
      console.log(`❌ Keywords test failed: ${error.message}`);
      this.errors.push({
        test: 'Keywords Generation',
        error: error.message
      });
    }
    
    console.log();
  }

  /**
   * Test business attributes detection
   */
  async testBusinessAttributesDetection() {
    console.log('🏷️ Test 6: Business Attributes Detection');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      const business = SAMPLE_BUSINESSES[4]; // Hair salon (woman-owned)
      const scrapedContent = SAMPLE_SCRAPED_CONTENT[business.id];
      
      console.log(`\n📊 Testing attributes for: ${business.name}`);
      
      const result = await classifier.detectBusinessAttributes(business, scrapedContent);
      
      if (result.success) {
        console.log(`✅ Attributes detected: ${result.detectedCount}`);
        console.log(`✅ Overall confidence: ${result.overallConfidence.toFixed(2)}`);
        
        if (this.config.verbose) {
          console.log(`🏷️ Attributes: ${JSON.stringify(result.attributes, null, 2)}`);
        }
        
        this.results.push({
          test: 'Business Attributes Detection',
          status: 'passed',
          details: {
            detectedCount: result.detectedCount,
            overallConfidence: result.overallConfidence
          }
        });
      } else {
        console.log(`❌ Attributes detection failed: ${result.error}`);
        this.errors.push({
          test: 'Business Attributes Detection',
          error: result.error
        });
      }
      
    } catch (error) {
      console.log(`❌ Attributes test failed: ${error.message}`);
      this.errors.push({
        test: 'Business Attributes Detection',
        error: error.message
      });
    }
    
    console.log();
  }

  /**
   * Test bulk processing
   */
  async testBulkProcessing() {
    console.log('📦 Test 7: Bulk Processing');
    console.log('-'.repeat(40));
    
    try {
      const classifier = await this.createClassifier();
      
      console.log(`\n📊 Testing bulk processing with ${SAMPLE_BUSINESSES.length} businesses`);
      
      const startTime = Date.now();
      const result = await classifier.bulkClassify(
        SAMPLE_BUSINESSES, 
        SAMPLE_SCRAPED_CONTENT,
        { 
          batchSize: 3, 
          concurrency: 2,
          includeDescriptions: false, // Skip to speed up testing
          includeKeywords: false,
          includeAttributes: false
        }
      );
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Bulk processing completed in ${processingTime}ms`);
      console.log(`✅ Successful: ${result.summary.successful}/${result.summary.total}`);
      console.log(`✅ Failed: ${result.summary.failed}`);
      
      if (this.config.verbose) {
        console.log(`📊 Results: ${JSON.stringify(result.summary, null, 2)}`);
      }
      
      this.results.push({
        test: 'Bulk Processing',
        status: 'passed',
        details: {
          total: result.summary.total,
          successful: result.summary.successful,
          failed: result.summary.failed,
          processingTime
        }
      });
      
    } catch (error) {
      console.log(`❌ Bulk processing test failed: ${error.message}`);
      this.errors.push({
        test: 'Bulk Processing',
        error: error.message
      });
    }
    
    console.log();
  }

  /**
   * Create mock OpenAI client for testing without API calls
   */
  createMockOpenAI() {
    return {
      chat: {
        completions: {
          create: async (params) => {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Return mock response based on request
            const messages = params.messages;
            const userMessage = messages.find(m => m.role === 'user')?.content || '';
            
            let mockResponse;
            
            if (userMessage.includes('classif')) {
              // Classification request
              mockResponse = {
                primary_category: 'food_dining',
                subcategory: 'bakeries',
                confidence_score: 0.92,
                classification_reasoning: 'Business name and content clearly indicate bakery operations',
                business_description: 'Desert Rose Bakery & Café is a family-owned Arizona bakery serving fresh artisan breads, pastries, and locally roasted coffee since 2015. Located in Phoenix, they specialize in custom cakes, organic ingredients, and catering services for weddings and corporate events. With three generations of baking expertise, they offer gluten-free options and signature items like sourdough bread and Arizona sunset cake.',
                products_services: {
                  primary_services: ['Fresh baked goods', 'Coffee service', 'Custom cakes', 'Catering'],
                  specialties: ['Artisan breads', 'Sourdough', 'Gluten-free options'],
                  brands_carried: ['Local coffee roasters'],
                  certifications: ['Organic certified']
                },
                keywords: ['bakery', 'phoenix', 'arizona', 'fresh bread', 'coffee', 'catering', 'family owned'],
                business_attributes: {
                  ownership_indicators: ['family_owned', 'locally_owned'],
                  certifications: ['organic_certified'],
                  accessibility: [],
                  service_options: ['catering_available', 'custom_orders']
                },
                special_features: ['organic ingredients', 'custom cakes', 'catering services'],
                location_context: 'Phoenix, Arizona local bakery',
                quality_indicators: {
                  content_completeness: 0.9,
                  information_accuracy: 0.95,
                  professional_presentation: 0.88
                }
              };
            } else if (userMessage.includes('description')) {
              // Description request
              mockResponse = {
                description: 'Desert Rose Bakery & Café is a family-owned Arizona bakery serving fresh artisan breads, pastries, and locally roasted coffee since 2015. Located in Phoenix, they offer custom cakes, catering services, and organic ingredients with three generations of baking expertise.',
                character_count: 285,
                tone_score: 0.9,
                uniqueness_score: 0.85,
                local_relevance: 0.92
              };
            } else if (userMessage.includes('products')) {
              // Products/services request
              mockResponse = {
                primary_services: ['Fresh baked goods', 'Coffee service', 'Custom cakes'],
                specialties: ['Artisan breads', 'Sourdough', 'Pastries'],
                brands_carried: ['Local roasters'],
                certifications: ['Organic certified'],
                service_areas: ['Phoenix', 'Metro area'],
                unique_offerings: ['Arizona sunset cake', 'Three generation recipes'],
                confidence_level: 0.88
              };
            } else if (userMessage.includes('keywords')) {
              // Keywords request
              mockResponse = {
                primary_keywords: ['bakery', 'arizona', 'phoenix'],
                location_keywords: ['phoenix', 'arizona', 'metro'],
                category_keywords: ['bakery', 'cafe', 'fresh bread'],
                service_keywords: ['catering', 'custom cakes', 'coffee'],
                long_tail_keywords: ['fresh artisan bread phoenix', 'custom wedding cakes arizona'],
                branded_keywords: ['desert rose bakery', 'desert rose cafe'],
                relevance_scores: {
                  primary_keywords: [0.95, 0.90, 0.88],
                  location_keywords: [0.98, 0.95, 0.85],
                  category_keywords: [0.92, 0.88, 0.85],
                  service_keywords: [0.85, 0.82, 0.80],
                  long_tail_keywords: [0.75, 0.72],
                  branded_keywords: [1.0, 0.98]
                }
              };
            } else if (userMessage.includes('attributes')) {
              // Attributes request
              mockResponse = {
                ownership: {
                  woman_owned: {detected: false, confidence: 0.0, evidence: ''},
                  veteran_owned: {detected: false, confidence: 0.0, evidence: ''},
                  family_owned: {detected: true, confidence: 0.95, evidence: 'family-owned business'},
                  minority_owned: {detected: false, confidence: 0.0, evidence: ''},
                  locally_owned: {detected: true, confidence: 0.90, evidence: 'arizona based'}
                },
                certifications: {
                  licensed_bonded: {detected: false, confidence: 0.0, evidence: ''},
                  organic_certified: {detected: true, confidence: 0.85, evidence: 'organic ingredients'},
                  award_winning: {detected: false, confidence: 0.0, evidence: ''},
                  professional_certification: {detected: false, confidence: 0.0, evidence: ''}
                },
                accessibility: {
                  wheelchair_accessible: {detected: false, confidence: 0.0, evidence: ''},
                  ada_compliant: {detected: false, confidence: 0.0, evidence: ''}
                },
                service_options: {
                  delivery_available: {detected: false, confidence: 0.0, evidence: ''},
                  online_ordering: {detected: false, confidence: 0.0, evidence: ''},
                  emergency_service: {detected: false, confidence: 0.0, evidence: ''},
                  '24_7_service': {detected: false, confidence: 0.0, evidence: ''}
                }
              };
            }
            
            return {
              choices: [{
                message: {
                  content: JSON.stringify(mockResponse)
                }
              }],
              usage: {
                prompt_tokens: 150,
                completion_tokens: 200,
                total_tokens: 350
              }
            };
          }
        }
      }
    };
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    const duration = Date.now() - this.startTime;
    const passed = this.results.length;
    const failed = this.errors.length;
    const total = passed + failed;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 AI CLASSIFICATION SERVICE TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`📋 Tests Run: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${total > 0 ? (passed / total * 100).toFixed(1) : 0}%`);
    
    if (this.config.mockMode) {
      console.log(`🤖 Mode: Mock (no API calls made)`);
    } else {
      console.log(`🌐 Mode: Live (OpenAI API used)`);
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.error}`);
      });
    }
    
    if (this.results.length > 0) {
      console.log('\n✅ Passed Tests:');
      this.results.forEach(result => {
        console.log(`   • ${result.test}`);
        if (this.config.verbose && result.details) {
          console.log(`     ${JSON.stringify(result.details)}`);
        }
      });
    }
    
    console.log('\n💡 Next Steps:');
    if (this.config.mockMode && this.errors.length === 0) {
      console.log('   • Set OPENAI_API_KEY environment variable to test with live API');
      console.log('   • Run with --full-test flag to test all service functions');
    } else if (this.errors.length === 0) {
      console.log('   • AI classification service is ready for production use');
      console.log('   • Integrate with the enrichment pipeline');
    } else {
      console.log('   • Fix failing tests before proceeding to production');
    }
    
    console.log('='.repeat(60));
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--verbose':
        options.verbose = true;
        break;
      case '--full-test':
        options.fullTest = true;
        break;
      case '--business-id':
        options.businessId = args[++i];
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
AI Classification Service Test Script

USAGE:
  node scripts/test-ai-classifier.js [OPTIONS]

OPTIONS:
  --verbose         Show detailed output and API responses
  --full-test       Run all test functions (classification, descriptions, keywords, etc.)
  --business-id     Test specific business by ID (e.g., test-001)
  --help            Show this help message

EXAMPLES:
  # Basic test with sample data
  node scripts/test-ai-classifier.js

  # Full test suite with verbose output
  node scripts/test-ai-classifier.js --full-test --verbose

  # Test specific business
  node scripts/test-ai-classifier.js --business-id test-001

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY    OpenAI API key (if not set, runs in mock mode)

NOTES:
  - If OPENAI_API_KEY is not set, the script runs in mock mode
  - Mock mode simulates API responses for testing the service logic
  - Live mode makes actual API calls to OpenAI (costs apply)
`);
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const tester = new AIClassifierTester(options);
  tester.runTests();
}