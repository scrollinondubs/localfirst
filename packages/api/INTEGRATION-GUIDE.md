# AI Classification Service Integration Guide

## Overview

The AI Classification Service provides comprehensive business analysis using OpenAI's GPT-4 API to classify businesses, generate descriptions, extract products/services, and detect business attributes.

## Quick Start

### 1. Configuration

Add your OpenAI API key to `.env`:
```bash
OPENAI_API_KEY="your-openai-api-key-here"
```

### 2. Basic Usage

```javascript
import AIClassificationService from './services/ai-classifier.js';

const classifier = new AIClassificationService({
  model: 'gpt-4',
  verbose: true,
  enableCache: true
});

// Initialize the service
await classifier.initializeOpenAI();

// Classify a business
const businessData = {
  id: 'biz-001',
  name: 'Desert Rose Bakery',
  address: '123 Main St, Phoenix, AZ',
  phone: '(602) 555-0123',
  website: 'https://desertrosebakery.com'
};

const scrapedContent = {
  title: 'Desert Rose Bakery - Fresh Artisan Baked Goods',
  description: 'Family-owned bakery serving fresh breads and pastries',
  content: 'We specialize in fresh-baked artisan breads, croissants...'
};

const result = await classifier.classifyBusiness(businessData, scrapedContent);
console.log(result);
// {
//   success: true,
//   primaryCategory: 'food_dining',
//   subcategory: 'bakeries',
//   confidence: 0.92,
//   reasoning: 'Business clearly operates as a bakery...'
// }
```

### 3. Testing

```bash
# Run tests in mock mode (no API key needed)
node scripts/test-ai-classifier.js

# Run full test suite
node scripts/test-ai-classifier.js --full-test

# Test with live API (requires OPENAI_API_KEY)
OPENAI_API_KEY="your-key" node scripts/test-ai-classifier.js --full-test
```

## Core Functions

### 1. Business Classification

```javascript
const classification = await classifier.classifyBusiness(businessData, scrapedContent);
```

**Returns:**
- `primaryCategory`: Main category from taxonomy
- `subcategory`: Specific subcategory if applicable  
- `confidence`: Score from 0.0 to 1.0
- `reasoning`: Explanation of classification decision

### 2. Description Generation

```javascript
const description = await classifier.generateDescription(businessData, scrapedContent);
```

**Returns:**
- `description`: Consumer-friendly description (500-1000 chars)
- `characterCount`: Length of generated description
- `qualityMetrics`: Tone, uniqueness, and local relevance scores

### 3. Products/Services Extraction

```javascript
const products = await classifier.extractProductsServices(businessData, scrapedContent);
```

**Returns structured data:**
```json
{
  "primaryServices": ["service1", "service2"],
  "specialties": ["specialty1", "specialty2"], 
  "brandsCarried": ["brand1", "brand2"],
  "certifications": ["cert1", "cert2"],
  "serviceAreas": ["area1", "area2"],
  "uniqueOfferings": ["unique1", "unique2"]
}
```

### 4. Keywords Generation

```javascript
const keywords = await classifier.generateKeywords(businessData, scrapedContent, category);
```

**Returns categorized keywords:**
- `primary`: Most important keywords
- `location`: Arizona cities and regions
- `category`: Business type related terms
- `service`: Service-specific keywords
- `longTail`: Longer search phrases
- `branded`: Business name variations

### 5. Business Attributes Detection

```javascript
const attributes = await classifier.detectBusinessAttributes(businessData, scrapedContent);
```

**Detects:**
- **Ownership**: Woman-owned, veteran-owned, family-owned, minority-owned, locally-owned
- **Certifications**: Licensed & bonded, organic certified, award-winning
- **Accessibility**: Wheelchair accessible, ADA compliant
- **Service Options**: Delivery, online ordering, emergency service, 24/7 service

### 6. Bulk Processing

```javascript
const results = await classifier.bulkClassify(
  businessList, 
  scrapedContentMap,
  {
    batchSize: 10,
    concurrency: 3,
    includeDescriptions: true,
    includeKeywords: true,
    includeAttributes: true
  }
);
```

## Integration with Existing Enrichment Pipeline

### Method 1: Replace Existing AI Logic

In `scripts/enrich-businesses.js`, replace the existing AI classification methods:

```javascript
// Replace the existing callOpenAI method
async callOpenAI(business, content) {
  const classifier = new AIClassificationService({
    verbose: this.config.verbose,
    enableCache: true
  });
  
  await classifier.initializeOpenAI();
  
  // Use the comprehensive classification
  const classification = await classifier.classifyBusiness(business, content);
  const description = await classifier.generateDescription(business, content);
  const keywords = await classifier.generateKeywords(business, content, classification.primaryCategory);
  const attributes = await classifier.detectBusinessAttributes(business, content);
  
  return {
    primary_category: classification.primaryCategory,
    subcategory: classification.subcategory,
    business_description: description.description,
    products_services: [], // Extracted separately
    keywords: keywords.keywords.primary,
    business_attributes: attributes.attributes,
    confidence: classification.confidence
  };
}
```

### Method 2: New Enrichment Service

Create a new enrichment service that uses the AI classifier:

```javascript
import AIClassificationService from '../services/ai-classifier.js';

class AIEnrichmentService {
  constructor() {
    this.classifier = new AIClassificationService({
      verbose: true,
      enableCache: true,
      enableCostTracking: true
    });
  }

  async enrichBusiness(business, scrapedContent) {
    await this.classifier.initializeOpenAI();
    
    const [classification, description, products, keywords, attributes] = await Promise.all([
      this.classifier.classifyBusiness(business, scrapedContent),
      this.classifier.generateDescription(business, scrapedContent),
      this.classifier.extractProductsServices(business, scrapedContent),
      this.classifier.generateKeywords(business, scrapedContent),
      this.classifier.detectBusinessAttributes(business, scrapedContent)
    ]);

    return {
      primaryCategory: classification.primaryCategory,
      subcategory: classification.subcategory,
      businessDescription: description.description,
      productsServices: JSON.stringify(products.data),
      keywords: keywords.keywords.primary.join(', '),
      businessAttributes: JSON.stringify(attributes.attributes),
      confidence: classification.confidence
    };
  }
}
```

## Configuration Options

```javascript
const classifier = new AIClassificationService({
  apiKey: 'your-api-key',           // OpenAI API key
  model: 'gpt-4',                   // OpenAI model ('gpt-4' or 'gpt-3.5-turbo')
  maxTokens: 2000,                  // Maximum tokens per request
  temperature: 0.3,                 // Creativity level (0.0-1.0)
  requestDelayMs: 1000,             // Delay between requests (rate limiting)
  maxRetries: 3,                    // Retry attempts on failure
  timeoutMs: 30000,                 // Request timeout
  enableCache: true,                // Cache results (15 minutes)
  enableCostTracking: true,         // Track API costs
  verbose: false                    // Detailed logging
});
```

## Cost Management

The service includes built-in cost tracking:

```javascript
// Get current statistics
console.log(classifier.getStats());
// "Requests: 10, Tokens: 15000, Cost: $0.75, Cache: 5/10"

// Export detailed statistics
const data = classifier.exportData();
console.log(data.stats);
// {
//   requestCount: 10,
//   totalTokensUsed: 15000,
//   estimatedCost: 0.75,
//   cacheHits: 5,
//   cacheMisses: 5,
//   errors: 0
// }
```

## Error Handling

The service includes comprehensive error handling:

```javascript
const result = await classifier.classifyBusiness(business, content);
if (!result.success) {
  console.error('Classification failed:', result.error);
  // Use fallback classification
  const fallback = {
    primaryCategory: 'other',
    confidence: 0,
    // ... other defaults
  };
}
```

## Production Considerations

### 1. Rate Limiting
- Default delay: 1000ms between requests
- Adjust `requestDelayMs` based on your OpenAI plan limits
- Use bulk processing for better efficiency

### 2. Caching
- Enabled by default (15 minutes TTL)
- Reduces API calls for similar content
- Clear cache with `classifier.clearCache()`

### 3. Error Recovery
- Automatic retry with exponential backoff
- Graceful degradation on API failures
- Comprehensive logging for debugging

### 4. Cost Optimization
- Use caching to minimize duplicate requests
- Consider `gpt-3.5-turbo` for lower costs (adjust expectations)
- Monitor costs with built-in tracking

## Next Steps

1. **Install Dependencies**: `npm install openai`
2. **Set API Key**: Add `OPENAI_API_KEY` to `.env`
3. **Run Tests**: `node scripts/test-ai-classifier.js --full-test`
4. **Integrate**: Choose integration method above
5. **Monitor**: Track costs and performance in production

## Support

For questions or issues:
- Check test script output for debugging
- Review error logs for API failures
- Monitor costs and adjust configuration as needed
- Consider fallback strategies for production reliability