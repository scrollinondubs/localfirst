/**
 * AI Business Classification Service
 * 
 * This service uses OpenAI's GPT-4 API to analyze scraped business data and generate:
 * - Accurate business categorizations with confidence scores
 * - Consumer-friendly descriptions (500-1000 characters)
 * - Structured products/services data
 * - Relevant search keywords
 * - Business attributes and special features
 * 
 * Features:
 * - Rate limiting and cost tracking
 * - Error handling and retries
 * - Bulk processing support
 * - Caching for repeated content analysis
 * - Quality assurance and validation
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class AIClassificationService {
  constructor(options = {}) {
    this.config = {
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      model: options.model || 'gpt-4',
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.3,
      requestDelayMs: options.requestDelayMs || 1000,
      maxRetries: options.maxRetries || 3,
      timeoutMs: options.timeoutMs || 30000,
      enableCache: options.enableCache !== false,
      enableCostTracking: options.enableCostTracking !== false,
      verbose: options.verbose || false
    };

    this.stats = {
      requestCount: 0,
      totalTokensUsed: 0,
      estimatedCost: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };

    this.cache = new Map();
    this.taxonomy = null;
    this.openai = null; // Initialize as null
    
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    // Don't initialize automatically - let caller control this
    // this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client
   */
  async initializeOpenAI() {
    try {
      // Only initialize if not already set (allows for mock injection)
      if (!this.openai) {
        // Dynamic import for OpenAI SDK
        const { OpenAI } = await import('openai');
        this.openai = new OpenAI({
          apiKey: this.config.apiKey,
          timeout: this.config.timeoutMs
        });
        
        if (this.config.verbose) {
          console.log('✅ OpenAI client initialized successfully');
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }

  /**
   * Load business taxonomy from config file
   */
  async loadTaxonomy() {
    if (this.taxonomy) return this.taxonomy;

    try {
      const taxonomyPath = path.resolve('./config/business-taxonomy.json');
      const taxonomyData = await fs.readFile(taxonomyPath, 'utf-8');
      this.taxonomy = JSON.parse(taxonomyData);
      
      if (this.config.verbose) {
        console.log('✅ Business taxonomy loaded successfully');
      }
      
      return this.taxonomy;
    } catch (error) {
      throw new Error(`Failed to load business taxonomy: ${error.message}`);
    }
  }

  /**
   * Create cache key for content
   */
  createCacheKey(businessData, scrapedContent) {
    const contentHash = this.hashContent(JSON.stringify({ businessData, scrapedContent }));
    return `ai_classification_${contentHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached result if available
   */
  getCachedResult(cacheKey) {
    if (!this.config.enableCache) return null;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 900000) { // 15 minutes
      this.stats.cacheHits++;
      return cached.data;
    }

    if (cached) {
      this.cache.delete(cacheKey); // Remove expired cache
    }
    
    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Cache result
   */
  setCachedResult(cacheKey, data) {
    if (!this.config.enableCache) return;

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Build comprehensive prompt for AI classification
   */
  buildClassificationPrompt(businessData, scrapedContent, taxonomy) {
    const categories = Object.keys(taxonomy.categories).map(key => {
      const cat = taxonomy.categories[key];
      return `${cat.name}: ${cat.displayName} - ${cat.description}`;
    }).join('\n');

    const attributeTypes = Object.keys(taxonomy.attributeTypes).map(key => {
      const attr = taxonomy.attributeTypes[key];
      const values = attr.values.map(v => v.key).join(', ');
      return `${attr.displayName}: ${values}`;
    }).join('\n');

    return `You are an expert business classifier analyzing Arizona local businesses. Your task is to analyze the provided business data and website content to generate accurate classifications and descriptions.

BUSINESS DATA:
Name: ${businessData.name}
Address: ${businessData.address || 'Not provided'}
Phone: ${businessData.phone || 'Not provided'}
Website: ${businessData.website || 'Not provided'}
Current Category: ${businessData.category || 'Not provided'}

SCRAPED WEBSITE CONTENT:
${typeof scrapedContent === 'object' 
  ? JSON.stringify(scrapedContent, null, 2) 
  : (scrapedContent?.toString() || 'No content available')
}

AVAILABLE CATEGORIES:
${categories}

BUSINESS ATTRIBUTES TO DETECT:
${attributeTypes}

Please analyze this business and provide a JSON response with the following structure:

{
  "primary_category": "exact_category_name_from_list",
  "subcategory": "subcategory_name_if_applicable",
  "confidence_score": 0.85,
  "classification_reasoning": "Brief explanation of why this category was chosen",
  "business_description": "Consumer-friendly description (500-1000 characters) that highlights key offerings and appeal",
  "products_services": {
    "primary_services": ["service1", "service2"],
    "specialties": ["specialty1", "specialty2"],
    "brands_carried": ["brand1", "brand2"],
    "certifications": ["cert1", "cert2"]
  },
  "keywords": ["keyword1", "keyword2", "keyword3", "arizona", "local"],
  "business_attributes": {
    "ownership_indicators": ["woman_owned", "veteran_owned", "family_owned", "locally_owned"],
    "certifications": ["licensed_bonded", "award_winning"],
    "accessibility": ["wheelchair_accessible", "ada_compliant"],
    "service_options": ["delivery_available", "online_ordering", "curbside_pickup", "emergency_service"]
  },
  "special_features": ["feature1", "feature2"],
  "location_context": "Brief mention of Arizona/local context if relevant",
  "quality_indicators": {
    "content_completeness": 0.8,
    "information_accuracy": 0.9,
    "professional_presentation": 0.85
  }
}

INSTRUCTIONS:
1. Choose the most accurate primary category from the provided list
2. Provide a confidence score (0.0 to 1.0) based on available evidence
3. Generate an engaging, consumer-friendly description between 500-1000 characters
4. Extract concrete products/services mentioned in the content
5. Generate relevant search keywords including location terms
6. Detect ownership and operational attributes from the content
7. Identify special features and capabilities
8. Include Arizona/local context where appropriate
9. Ensure all JSON keys match exactly as shown above
10. Be conservative with attributes - only include what you can reasonably infer

Focus on accuracy over comprehensiveness. If unsure about specific details, indicate lower confidence or omit uncertain attributes.`;
  }

  /**
   * Make API call to OpenAI with retry logic
   */
  async makeAPICall(prompt, businessName) {
    // Ensure OpenAI is initialized
    if (!this.openai) {
      await this.initializeOpenAI();
    }
    
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (this.config.verbose) {
          console.log(`🧠 Making OpenAI API call for ${businessName} (attempt ${attempt}/${this.config.maxRetries})`);
        }

        const response = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert business classifier specializing in Arizona local businesses. Provide accurate, detailed JSON responses for business classification and analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          response_format: { type: 'json_object' }
        });

        // Update statistics
        this.stats.requestCount++;
        this.stats.totalTokensUsed += response.usage.total_tokens;
        
        if (this.config.enableCostTracking) {
          // Estimate cost based on GPT-4 pricing (as of 2024)
          const inputCost = (response.usage.prompt_tokens / 1000) * 0.03;
          const outputCost = (response.usage.completion_tokens / 1000) * 0.06;
          this.stats.estimatedCost += inputCost + outputCost;
        }

        const processingTime = Date.now() - startTime;

        if (this.config.verbose) {
          console.log(`✅ OpenAI API call successful for ${businessName} in ${processingTime}ms`);
          console.log(`📊 Tokens: ${response.usage.total_tokens}, Est. Cost: $${(this.stats.estimatedCost).toFixed(4)}`);
        }

        return {
          content: response.choices[0].message.content,
          usage: response.usage,
          processingTime
        };

      } catch (error) {
        this.stats.errors++;
        
        if (attempt === this.config.maxRetries) {
          throw new Error(`OpenAI API call failed after ${this.config.maxRetries} attempts: ${error.message}`);
        }

        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        if (this.config.verbose) {
          console.log(`⚠️ API call failed for ${businessName}, retrying in ${delay}ms...`);
        }
        
        await this.sleep(delay);
      }
    }
  }

  /**
   * Parse and validate AI response
   */
  parseAIResponse(rawResponse, businessName) {
    try {
      const parsed = JSON.parse(rawResponse);
      
      // Validate required fields
      const requiredFields = [
        'primary_category', 'confidence_score', 'business_description', 
        'products_services', 'keywords', 'business_attributes'
      ];
      
      for (const field of requiredFields) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate confidence score
      if (typeof parsed.confidence_score !== 'number' || 
          parsed.confidence_score < 0 || parsed.confidence_score > 1) {
        throw new Error('Invalid confidence_score: must be a number between 0 and 1');
      }

      // Validate description length
      if (parsed.business_description.length < 100 || parsed.business_description.length > 1200) {
        console.warn(`⚠️ Description length for ${businessName}: ${parsed.business_description.length} characters`);
      }

      // Ensure arrays are properly formatted
      if (!Array.isArray(parsed.keywords)) {
        parsed.keywords = [];
      }

      if (!Array.isArray(parsed.special_features)) {
        parsed.special_features = [];
      }

      // Validate products_services structure
      if (typeof parsed.products_services !== 'object') {
        parsed.products_services = {
          primary_services: [],
          specialties: [],
          brands_carried: [],
          certifications: []
        };
      }

      return {
        success: true,
        data: parsed,
        validationWarnings: []
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse AI response for ${businessName}: ${error.message}`,
        rawResponse
      };
    }
  }

  /**
   * Classify a business into taxonomy categories
   * @param {Object} businessData - Business information (name, address, phone, website, etc.)
   * @param {Object|string} scrapedContent - Website content from scraping
   * @returns {Promise<Object>} Classification result with confidence score
   */
  async classifyBusiness(businessData, scrapedContent) {
    const startTime = Date.now();
    
    try {
      // Load taxonomy
      const taxonomy = await this.loadTaxonomy();
      
      // Check cache first
      const cacheKey = this.createCacheKey(businessData, scrapedContent);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        if (this.config.verbose) {
          console.log(`💾 Cache hit for ${businessData.name}`);
        }
        return cachedResult;
      }

      // Build prompt
      const prompt = this.buildClassificationPrompt(businessData, scrapedContent, taxonomy);
      
      // Make API call
      const apiResponse = await this.makeAPICall(prompt, businessData.name);
      
      // Parse response
      const parseResult = this.parseAIResponse(apiResponse.content, businessData.name);
      
      if (!parseResult.success) {
        throw new Error(parseResult.error);
      }

      const result = {
        success: true,
        primaryCategory: parseResult.data.primary_category,
        subcategory: parseResult.data.subcategory || null,
        confidence: parseResult.data.confidence_score,
        reasoning: parseResult.data.classification_reasoning,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: apiResponse.usage.total_tokens,
        cacheKey
      };

      // Cache the result
      this.setCachedResult(cacheKey, result);
      
      if (this.config.verbose) {
        console.log(`✅ Business classified: ${businessData.name} -> ${result.primaryCategory} (${result.confidence})`);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        processingTimeMs: Date.now() - startTime,
        primaryCategory: 'other',
        confidence: 0
      };
    }
  }

  /**
   * Generate consumer-friendly business description
   * @param {Object} businessData - Business information
   * @param {Object|string} scrapedContent - Website content
   * @returns {Promise<Object>} Generated description with quality metrics
   */
  async generateDescription(businessData, scrapedContent) {
    const startTime = Date.now();

    try {
      const taxonomy = await this.loadTaxonomy();
      const cacheKey = `desc_${this.createCacheKey(businessData, scrapedContent)}`;
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      const prompt = `Generate a consumer-friendly business description for this Arizona business:

BUSINESS: ${businessData.name}
LOCATION: ${businessData.address || 'Arizona'}
WEBSITE CONTENT: ${typeof scrapedContent === 'object' ? JSON.stringify(scrapedContent) : scrapedContent}

Requirements:
- 500-1000 characters long
- Professional yet conversational tone
- Highlight unique offerings and value propositions
- Include Arizona/local context where appropriate
- Focus on what matters to consumers
- Avoid generic language

Return JSON format:
{
  "description": "Your generated description here",
  "character_count": 850,
  "tone_score": 0.9,
  "uniqueness_score": 0.8,
  "local_relevance": 0.85
}`;

      const apiResponse = await this.makeAPICall(prompt, businessData.name);
      const parsed = JSON.parse(apiResponse.content);

      const result = {
        success: true,
        description: parsed.description,
        characterCount: parsed.character_count,
        qualityMetrics: {
          toneScore: parsed.tone_score,
          uniquenessScore: parsed.uniqueness_score,
          localRelevance: parsed.local_relevance
        },
        processingTimeMs: Date.now() - startTime
      };

      this.setCachedResult(cacheKey, result);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        description: `${businessData.name} is a local Arizona business serving the community with professional services.`,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Extract structured products and services data
   * @param {Object} businessData - Business information
   * @param {Object|string} scrapedContent - Website content
   * @returns {Promise<Object>} Structured products/services data
   */
  async extractProductsServices(businessData, scrapedContent) {
    const startTime = Date.now();

    try {
      const cacheKey = `products_${this.createCacheKey(businessData, scrapedContent)}`;
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) return cachedResult;

      const prompt = `Extract structured products and services information for this business:

BUSINESS: ${businessData.name}
CONTENT: ${typeof scrapedContent === 'object' ? JSON.stringify(scrapedContent) : scrapedContent}

Extract and categorize into this exact JSON format:
{
  "primary_services": ["main service 1", "main service 2"],
  "specialties": ["specialty area 1", "specialty area 2"],
  "brands_carried": ["brand 1", "brand 2"],
  "certifications": ["certification 1", "certification 2"],
  "service_areas": ["area 1", "area 2"],
  "unique_offerings": ["unique thing 1", "unique thing 2"],
  "confidence_level": 0.85
}

Only include items you can clearly identify from the content. Empty arrays are acceptable.`;

      const apiResponse = await this.makeAPICall(prompt, businessData.name);
      const parsed = JSON.parse(apiResponse.content);

      const result = {
        success: true,
        data: {
          primaryServices: parsed.primary_services || [],
          specialties: parsed.specialties || [],
          brandsCarried: parsed.brands_carried || [],
          certifications: parsed.certifications || [],
          serviceAreas: parsed.service_areas || [],
          uniqueOfferings: parsed.unique_offerings || []
        },
        confidence: parsed.confidence_level || 0.7,
        processingTimeMs: Date.now() - startTime
      };

      this.setCachedResult(cacheKey, result);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: {
          primaryServices: [],
          specialties: [],
          brandsCarried: [],
          certifications: [],
          serviceAreas: [],
          uniqueOfferings: []
        },
        confidence: 0,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Generate relevant search keywords
   * @param {Object} businessData - Business information  
   * @param {Object|string} scrapedContent - Website content
   * @param {string} category - Business category
   * @returns {Promise<Object>} Generated keywords with relevance scores
   */
  async generateKeywords(businessData, scrapedContent, category = null) {
    const startTime = Date.now();

    try {
      const taxonomy = await this.loadTaxonomy();
      const cacheKey = `keywords_${this.createCacheKey(businessData, scrapedContent)}_${category}`;
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) return cachedResult;

      const categoryInfo = category && taxonomy.categories[category] 
        ? taxonomy.categories[category] 
        : null;

      const prompt = `Generate SEO-optimized keywords for this Arizona business:

BUSINESS: ${businessData.name}
CATEGORY: ${category || 'unknown'}
LOCATION: ${businessData.address || 'Arizona'}
CONTENT: ${typeof scrapedContent === 'object' ? JSON.stringify(scrapedContent) : scrapedContent}
${categoryInfo ? `CATEGORY KEYWORDS: ${categoryInfo.keywords.join(', ')}` : ''}

Generate keywords in this JSON format:
{
  "primary_keywords": ["most important keywords"],
  "location_keywords": ["arizona", "phoenix", "mesa", "scottsdale"],
  "category_keywords": ["category-specific terms"],
  "service_keywords": ["service-related terms"],
  "long_tail_keywords": ["longer specific phrases"],
  "branded_keywords": ["business name variations"],
  "relevance_scores": {
    "primary_keywords": [0.95, 0.90],
    "location_keywords": [0.98, 0.85],
    "category_keywords": [0.88, 0.82],
    "service_keywords": [0.85, 0.80],
    "long_tail_keywords": [0.75, 0.70],
    "branded_keywords": [1.0, 0.95]
  }
}

Focus on terms people would actually search for. Include Arizona cities where relevant.`;

      const apiResponse = await this.makeAPICall(prompt, businessData.name);
      const parsed = JSON.parse(apiResponse.content);

      const result = {
        success: true,
        keywords: {
          primary: parsed.primary_keywords || [],
          location: parsed.location_keywords || [],
          category: parsed.category_keywords || [],
          service: parsed.service_keywords || [],
          longTail: parsed.long_tail_keywords || [],
          branded: parsed.branded_keywords || []
        },
        relevanceScores: parsed.relevance_scores || {},
        processingTimeMs: Date.now() - startTime
      };

      this.setCachedResult(cacheKey, result);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        keywords: {
          primary: [businessData.name?.toLowerCase(), 'arizona', 'local business'],
          location: ['arizona'],
          category: [category || 'business'],
          service: [],
          longTail: [],
          branded: [businessData.name?.toLowerCase()]
        },
        relevanceScores: {},
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Detect business attributes (ownership, certifications, etc.)
   * @param {Object} businessData - Business information
   * @param {Object|string} scrapedContent - Website content  
   * @returns {Promise<Object>} Detected attributes with confidence scores
   */
  async detectBusinessAttributes(businessData, scrapedContent) {
    const startTime = Date.now();

    try {
      const taxonomy = await this.loadTaxonomy();
      const cacheKey = `attrs_${this.createCacheKey(businessData, scrapedContent)}`;
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) return cachedResult;

      const prompt = `Analyze this business content to detect ownership, certifications, and special attributes:

BUSINESS: ${businessData.name}
CONTENT: ${typeof scrapedContent === 'object' ? JSON.stringify(scrapedContent) : scrapedContent}

Look for indicators of these attributes and return confidence scores:

{
  "ownership": {
    "woman_owned": {"detected": true/false, "confidence": 0.85, "evidence": "text evidence"},
    "veteran_owned": {"detected": true/false, "confidence": 0.0, "evidence": ""},
    "family_owned": {"detected": true/false, "confidence": 0.75, "evidence": "family business since"},
    "minority_owned": {"detected": true/false, "confidence": 0.0, "evidence": ""},
    "locally_owned": {"detected": true/false, "confidence": 0.90, "evidence": "arizona based"}
  },
  "certifications": {
    "licensed_bonded": {"detected": true/false, "confidence": 0.80, "evidence": "licensed and bonded"},
    "organic_certified": {"detected": true/false, "confidence": 0.0, "evidence": ""},
    "award_winning": {"detected": true/false, "confidence": 0.60, "evidence": "best of award"},
    "professional_certification": {"detected": true/false, "confidence": 0.0, "evidence": ""}
  },
  "accessibility": {
    "wheelchair_accessible": {"detected": true/false, "confidence": 0.0, "evidence": ""},
    "ada_compliant": {"detected": true/false, "confidence": 0.0, "evidence": ""}
  },
  "service_options": {
    "delivery_available": {"detected": true/false, "confidence": 0.85, "evidence": "we deliver"},
    "online_ordering": {"detected": true/false, "confidence": 0.70, "evidence": "order online"},
    "emergency_service": {"detected": true/false, "confidence": 0.0, "evidence": ""},
    "24_7_service": {"detected": true/false, "confidence": 0.0, "evidence": ""}
  }
}

Only mark detected=true if you have reasonable evidence. Be conservative with confidence scores.`;

      const apiResponse = await this.makeAPICall(prompt, businessData.name);
      const parsed = JSON.parse(apiResponse.content);

      const result = {
        success: true,
        attributes: parsed,
        detectedCount: this.countDetectedAttributes(parsed),
        overallConfidence: this.calculateAverageConfidence(parsed),
        processingTimeMs: Date.now() - startTime
      };

      this.setCachedResult(cacheKey, result);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        attributes: {},
        detectedCount: 0,
        overallConfidence: 0,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Process multiple businesses in bulk
   * @param {Array} businessList - Array of business data objects
   * @param {Object} scrapedContentMap - Map of business ID to scraped content
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Array of processing results
   */
  async bulkClassify(businessList, scrapedContentMap, options = {}) {
    const startTime = Date.now();
    const {
      batchSize = 5,
      concurrency = 3,
      includeDescriptions = true,
      includeKeywords = true,
      includeAttributes = true
    } = options;

    console.log(`🚀 Starting bulk classification of ${businessList.length} businesses`);
    console.log(`📊 Batch size: ${batchSize}, Concurrency: ${concurrency}`);

    const results = [];
    const errors = [];

    // Process in batches
    for (let i = 0; i < businessList.length; i += batchSize) {
      const batch = businessList.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} businesses`);

      // Process batch with concurrency control  
      const batchPromises = batch.map(async (business, index) => {
        try {
          // Add staggered delay to respect rate limits
          const delay = Math.floor(index / concurrency) * this.config.requestDelayMs;
          if (delay > 0) {
            await this.sleep(delay);
          }

          const scrapedContent = scrapedContentMap[business.id] || {};
          
          // Core classification
          const classification = await this.classifyBusiness(business, scrapedContent);
          
          const result = {
            businessId: business.id,
            businessName: business.name,
            classification,
            timestamp: new Date().toISOString()
          };

          // Optional additional processing
          if (includeDescriptions && classification.success) {
            result.description = await this.generateDescription(business, scrapedContent);
          }

          if (includeKeywords && classification.success) {
            result.keywords = await this.generateKeywords(
              business, 
              scrapedContent, 
              classification.primaryCategory
            );
          }

          if (includeAttributes && classification.success) {
            result.attributes = await this.detectBusinessAttributes(business, scrapedContent);
          }

          console.log(`✅ Processed ${business.name}: ${classification.primaryCategory || 'failed'}`);
          return result;

        } catch (error) {
          console.log(`❌ Failed to process ${business.name}: ${error.message}`);
          errors.push({
            businessId: business.id,
            businessName: business.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          return {
            businessId: business.id,
            businessName: business.name,
            classification: { success: false, error: error.message },
            timestamp: new Date().toISOString()
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Progress update
      const progress = ((i + batch.length) / businessList.length * 100).toFixed(1);
      console.log(`📈 Progress: ${progress}% (${i + batch.length}/${businessList.length})`);
      console.log(`📊 Stats: ${this.getStats()}`);
    }

    const processingTime = Date.now() - startTime;
    const successful = results.filter(r => r.classification.success).length;

    console.log(`\n🎉 Bulk classification completed in ${processingTime}ms`);
    console.log(`✅ Successful: ${successful}/${businessList.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log(`📈 Final Stats: ${this.getStats()}`);

    return {
      results,
      errors,
      summary: {
        total: businessList.length,
        successful,
        failed: errors.length,
        processingTimeMs: processingTime,
        stats: this.stats
      }
    };
  }

  /**
   * Helper methods
   */
  countDetectedAttributes(attributes) {
    let count = 0;
    for (const category of Object.values(attributes)) {
      for (const attr of Object.values(category)) {
        if (attr.detected) count++;
      }
    }
    return count;
  }

  calculateAverageConfidence(attributes) {
    let total = 0;
    let count = 0;
    for (const category of Object.values(attributes)) {
      for (const attr of Object.values(category)) {
        if (attr.detected) {
          total += attr.confidence;
          count++;
        }
      }
    }
    return count > 0 ? total / count : 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current statistics
   */
  getStats() {
    return `Requests: ${this.stats.requestCount}, Tokens: ${this.stats.totalTokensUsed}, Cost: $${this.stats.estimatedCost.toFixed(4)}, Cache: ${this.stats.cacheHits}/${this.stats.cacheHits + this.stats.cacheMisses}`;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      requestCount: 0,
      totalTokensUsed: 0,
      estimatedCost: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Export statistics and cache data
   */
  exportData() {
    return {
      stats: this.stats,
      cacheSize: this.cache.size,
      config: {
        model: this.config.model,
        enableCache: this.config.enableCache,
        enableCostTracking: this.config.enableCostTracking
      }
    };
  }
}

export default AIClassificationService;

/**
 * Convenience function for single business classification
 */
export async function classifyBusiness(businessData, scrapedContent, options = {}) {
  const classifier = new AIClassificationService(options);
  return await classifier.classifyBusiness(businessData, scrapedContent);
}

/**
 * Convenience function for generating business descriptions
 */
export async function generateBusinessDescription(businessData, scrapedContent, options = {}) {
  const classifier = new AIClassificationService(options);
  return await classifier.generateDescription(businessData, scrapedContent);
}