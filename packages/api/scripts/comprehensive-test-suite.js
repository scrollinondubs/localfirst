#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Business Enrichment Pipeline
 * 
 * This comprehensive testing framework validates:
 * - Pipeline functionality across different methods and batch sizes
 * - AI classification accuracy vs manual expectations
 * - Description quality and consumer-friendliness  
 * - Performance metrics and cost tracking
 * - Error handling and edge cases
 * - Quality assurance and production readiness
 */

import { EnrichmentPipeline } from './enrich-businesses.js';
import AIClassificationService from '../services/ai-classifier.js';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, inArray } from 'drizzle-orm';
import { businesses, enrichmentLogs } from '../src/db/schema.js';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

class ComprehensiveTestSuite {
  constructor(config = {}) {
    this.config = {
      testDataFile: './test-dataset-expected-outcomes.json',
      outputDir: './test-results',
      sampleSize: config.sampleSize || 100,
      batchSizes: config.batchSizes || [5, 10, 25],
      concurrencyLevels: config.concurrencyLevels || [1, 2, 3],
      testMethods: config.testMethods || ['firecrawl', 'playwright', 'auto'],
      performanceThresholds: {
        avgProcessingTime: 30000, // 30 seconds per business
        successRate: 0.85, // 85% success rate
        accuracyRate: 0.80, // 80% classification accuracy
        costPerBusiness: 0.10 // $0.10 max per business
      },
      qualityThresholds: {
        minDescriptionLength: 100,
        maxDescriptionLength: 1200,
        minKeywords: 3,
        minProducts: 1,
        confidenceThreshold: 0.6
      },
      ...config
    };

    this.db = null;
    this.testResults = {
      startTime: null,
      endTime: null,
      duration: null,
      summary: {},
      methodTests: {},
      batchTests: {},
      qualityTests: {},
      performanceTests: {},
      errors: [],
      recommendations: []
    };
  }

  async initialize() {
    console.log('🚀 Initializing Comprehensive Test Suite...');
    
    // Initialize database
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    this.db = drizzle(client, { schema: { businesses, enrichmentLogs } });
    
    // Ensure output directory exists
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    console.log('✅ Test suite initialized');
  }

  async loadExpectedOutcomes() {
    console.log('📄 Loading expected outcomes from test dataset...');
    
    try {
      const data = await fs.readFile(this.config.testDataFile, 'utf-8');
      const testData = JSON.parse(data);
      
      console.log(`📊 Loaded ${testData.expectedOutcomes.length} expected outcomes`);
      console.log('📈 Category Distribution:', testData.metadata.categoryBreakdown);
      console.log('🏢 LFA Distribution:', testData.metadata.lfaBreakdown);
      
      return testData.expectedOutcomes;
    } catch (error) {
      throw new Error(`Failed to load test data: ${error.message}`);
    }
  }

  async runMethodComparisonTests() {
    console.log('\n🔄 Running Method Comparison Tests...');
    
    const methodResults = {};
    
    for (const method of this.config.testMethods) {
      console.log(`\n🧪 Testing method: ${method}`);
      
      const testConfig = {
        method: method,
        batchSize: 10,
        concurrency: 2,
        verbose: 1,
        dryRun: false,
        priority: method === 'firecrawl' ? 'lfa' : 'all',
        resumeFile: `./test-${method}-progress.json`,
        exportResults: `./test-${method}-results.json`
      };
      
      const startTime = performance.now();
      
      try {
        const pipeline = new EnrichmentPipeline(testConfig);
        await pipeline.run();
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Load and analyze results
        const results = await this.loadTestResults(testConfig.exportResults);
        
        methodResults[method] = {
          success: true,
          duration: duration,
          stats: results.metadata.stats,
          successRate: results.metadata.stats.successful / results.metadata.stats.total,
          avgProcessingTime: duration / results.metadata.stats.total,
          errors: results.results.filter(r => !r.success).length,
          cost: results.metadata.stats.costs?.firecrawl || 0
        };
        
        console.log(`✅ ${method} test completed: ${methodResults[method].successRate * 100}% success rate`);
        
      } catch (error) {
        console.error(`❌ ${method} test failed: ${error.message}`);
        methodResults[method] = {
          success: false,
          error: error.message,
          duration: performance.now() - startTime
        };
      }
    }
    
    this.testResults.methodTests = methodResults;
    return methodResults;
  }

  async runBatchSizeTests() {
    console.log('\n📦 Running Batch Size Performance Tests...');
    
    const batchResults = {};
    
    for (const batchSize of this.config.batchSizes) {
      console.log(`\n📊 Testing batch size: ${batchSize}`);
      
      const testConfig = {
        method: 'auto',
        batchSize: batchSize,
        concurrency: 2,
        verbose: 1,
        dryRun: false,
        resumeFile: `./test-batch-${batchSize}-progress.json`,
        exportResults: `./test-batch-${batchSize}-results.json`
      };
      
      const startTime = performance.now();
      
      try {
        const pipeline = new EnrichmentPipeline(testConfig);
        await pipeline.run();
        
        const endTime = performance.now();
        const results = await this.loadTestResults(testConfig.exportResults);
        
        batchResults[batchSize] = {
          success: true,
          duration: endTime - startTime,
          throughput: results.metadata.stats.total / ((endTime - startTime) / 1000),
          memoryUsage: process.memoryUsage(),
          successRate: results.metadata.stats.successful / results.metadata.stats.total,
          avgProcessingTime: (endTime - startTime) / results.metadata.stats.total
        };
        
        console.log(`✅ Batch size ${batchSize} completed: ${batchResults[batchSize].throughput.toFixed(2)} businesses/sec`);
        
      } catch (error) {
        console.error(`❌ Batch size ${batchSize} failed: ${error.message}`);
        batchResults[batchSize] = {
          success: false,
          error: error.message
        };
      }
    }
    
    this.testResults.batchTests = batchResults;
    return batchResults;
  }

  async runAccuracyValidationTests(expectedOutcomes) {
    console.log('\n🎯 Running Classification Accuracy Tests...');
    
    // Get enriched businesses
    const enrichedBusinesses = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.enrichmentStatus, 'completed'));
    
    if (enrichedBusinesses.length === 0) {
      console.log('⚠️  No enriched businesses found for accuracy testing');
      return { accuracy: 0, matches: 0, total: 0 };
    }
    
    console.log(`📊 Validating ${enrichedBusinesses.length} enriched businesses against expected outcomes`);
    
    let correctClassifications = 0;
    let totalValidated = 0;
    const mismatches = [];
    const accuracyByCategory = {};
    
    for (const business of enrichedBusinesses) {
      const expected = expectedOutcomes.find(e => e.id === business.id);
      if (!expected) continue;
      
      totalValidated++;
      
      const actualCategory = business.primaryCategory;
      const expectedCategory = expected.expectedPrimaryCategory;
      
      if (actualCategory === expectedCategory) {
        correctClassifications++;
      } else {
        mismatches.push({
          businessId: business.id,
          businessName: business.name,
          expected: expectedCategory,
          actual: actualCategory,
          confidence: this.parseConfidenceFromLogs(business.id)
        });
      }
      
      // Track by category
      if (!accuracyByCategory[expectedCategory]) {
        accuracyByCategory[expectedCategory] = { correct: 0, total: 0 };
      }
      accuracyByCategory[expectedCategory].total++;
      if (actualCategory === expectedCategory) {
        accuracyByCategory[expectedCategory].correct++;
      }
    }
    
    const overallAccuracy = totalValidated > 0 ? correctClassifications / totalValidated : 0;
    
    const accuracyResults = {
      overallAccuracy,
      correctClassifications,
      totalValidated,
      mismatches: mismatches.slice(0, 20), // First 20 mismatches
      accuracyByCategory: Object.entries(accuracyByCategory).map(([category, data]) => ({
        category,
        accuracy: data.correct / data.total,
        correct: data.correct,
        total: data.total
      })),
      meetsTreshold: overallAccuracy >= this.config.performanceThresholds.accuracyRate
    };
    
    console.log(`🎯 Classification Accuracy: ${(overallAccuracy * 100).toFixed(1)}% (${correctClassifications}/${totalValidated})`);
    
    if (!accuracyResults.meetsTreshold) {
      console.log(`⚠️  Below accuracy threshold of ${this.config.performanceThresholds.accuracyRate * 100}%`);
    }
    
    this.testResults.qualityTests.accuracy = accuracyResults;
    
    // Save detailed mismatch report
    await this.saveMismatchReport(mismatches, accuracyByCategory);
    
    return accuracyResults;
  }

  async parseConfidenceFromLogs(businessId) {
    try {
      const logs = await this.db
        .select()
        .from(enrichmentLogs)
        .where(eq(enrichmentLogs.businessId, businessId));
      
      if (logs.length > 0) {
        return logs[0].confidenceScore;
      }
    } catch (error) {
      console.warn(`Failed to get confidence for ${businessId}`);
    }
    return null;
  }

  async runQualityAssessmentTests() {
    console.log('\n📝 Running Quality Assessment Tests...');
    
    const enrichedBusinesses = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.enrichmentStatus, 'completed'));
    
    if (enrichedBusinesses.length === 0) {
      console.log('⚠️  No enriched businesses found for quality testing');
      return {};
    }
    
    let qualityMetrics = {
      descriptions: { passed: 0, total: 0, issues: [] },
      products: { passed: 0, total: 0, issues: [] },
      keywords: { passed: 0, total: 0, issues: [] },
      overall: { score: 0, passed: 0, total: 0 }
    };
    
    for (const business of enrichedBusinesses) {
      // Test description quality
      const descQuality = this.assessDescriptionQuality(business);
      qualityMetrics.descriptions.total++;
      if (descQuality.passed) qualityMetrics.descriptions.passed++;
      else qualityMetrics.descriptions.issues.push({ id: business.id, name: business.name, issues: descQuality.issues });
      
      // Test products/services
      const productQuality = this.assessProductsQuality(business);
      qualityMetrics.products.total++;
      if (productQuality.passed) qualityMetrics.products.passed++;
      else qualityMetrics.products.issues.push({ id: business.id, name: business.name, issues: productQuality.issues });
      
      // Test keywords
      const keywordQuality = this.assessKeywordsQuality(business);
      qualityMetrics.keywords.total++;
      if (keywordQuality.passed) qualityMetrics.keywords.passed++;
      else qualityMetrics.keywords.issues.push({ id: business.id, name: business.name, issues: keywordQuality.issues });
      
      // Overall quality
      qualityMetrics.overall.total++;
      if (descQuality.passed && productQuality.passed && keywordQuality.passed) {
        qualityMetrics.overall.passed++;
      }
    }
    
    // Calculate quality scores
    const qualityResults = {
      descriptionQuality: qualityMetrics.descriptions.passed / qualityMetrics.descriptions.total,
      productsQuality: qualityMetrics.products.passed / qualityMetrics.products.total,
      keywordsQuality: qualityMetrics.keywords.passed / qualityMetrics.keywords.total,
      overallQuality: qualityMetrics.overall.passed / qualityMetrics.overall.total,
      issuesSummary: {
        descriptions: qualityMetrics.descriptions.issues.length,
        products: qualityMetrics.products.issues.length,
        keywords: qualityMetrics.keywords.issues.length
      },
      sampleIssues: {
        descriptions: qualityMetrics.descriptions.issues.slice(0, 5),
        products: qualityMetrics.products.issues.slice(0, 5),
        keywords: qualityMetrics.keywords.issues.slice(0, 5)
      }
    };
    
    console.log('📊 Quality Assessment Results:');
    console.log(`   Description Quality: ${(qualityResults.descriptionQuality * 100).toFixed(1)}%`);
    console.log(`   Products Quality: ${(qualityResults.productsQuality * 100).toFixed(1)}%`);
    console.log(`   Keywords Quality: ${(qualityResults.keywordsQuality * 100).toFixed(1)}%`);
    console.log(`   Overall Quality: ${(qualityResults.overallQuality * 100).toFixed(1)}%`);
    
    this.testResults.qualityTests.quality = qualityResults;
    return qualityResults;
  }

  assessDescriptionQuality(business) {
    const issues = [];
    const desc = business.businessDescription || '';
    
    // Length check
    if (desc.length < this.config.qualityThresholds.minDescriptionLength) {
      issues.push(`Description too short: ${desc.length} chars`);
    }
    if (desc.length > this.config.qualityThresholds.maxDescriptionLength) {
      issues.push(`Description too long: ${desc.length} chars`);
    }
    
    // Content quality checks
    if (!desc.includes('Arizona')) {
      issues.push('Missing Arizona location context');
    }
    
    if (desc.includes('Lorem ipsum') || desc.includes('placeholder')) {
      issues.push('Contains placeholder text');
    }
    
    if (desc.split(business.name).length - 1 > 3) {
      issues.push('Business name repeated too frequently');
    }
    
    // Readability check (simple)
    const sentences = desc.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) {
      issues.push('Too few sentences for good readability');
    }
    
    return {
      passed: issues.length === 0,
      issues: issues,
      score: Math.max(0, 1 - (issues.length * 0.2))
    };
  }

  assessProductsQuality(business) {
    const issues = [];
    let products = [];
    
    try {
      products = JSON.parse(business.productsServices || '[]');
    } catch (error) {
      issues.push('Invalid JSON format for products/services');
      return { passed: false, issues, score: 0 };
    }
    
    if (!Array.isArray(products) && typeof products !== 'object') {
      issues.push('Products/services not in expected format');
    }
    
    let productCount = 0;
    if (Array.isArray(products)) {
      productCount = products.length;
    } else if (typeof products === 'object') {
      productCount = Object.values(products).flat().length;
    }
    
    if (productCount < this.config.qualityThresholds.minProducts) {
      issues.push(`Too few products/services: ${productCount}`);
    }
    
    return {
      passed: issues.length === 0,
      issues: issues,
      score: Math.max(0, 1 - (issues.length * 0.25))
    };
  }

  assessKeywordsQuality(business) {
    const issues = [];
    const keywords = business.keywords || '';
    const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywordArray.length < this.config.qualityThresholds.minKeywords) {
      issues.push(`Too few keywords: ${keywordArray.length}`);
    }
    
    if (!keywords.toLowerCase().includes('arizona')) {
      issues.push('Missing Arizona location keyword');
    }
    
    if (!keywords.toLowerCase().includes(business.name.toLowerCase())) {
      issues.push('Missing business name in keywords');
    }
    
    // Check for duplicate keywords
    const uniqueKeywords = [...new Set(keywordArray.map(k => k.toLowerCase()))];
    if (uniqueKeywords.length < keywordArray.length) {
      issues.push('Contains duplicate keywords');
    }
    
    return {
      passed: issues.length === 0,
      issues: issues,
      score: Math.max(0, 1 - (issues.length * 0.2))
    };
  }

  async runPerformanceTests() {
    console.log('\n⚡ Running Performance Analysis...');
    
    // Get enrichment logs for performance analysis
    const logs = await this.db.select().from(enrichmentLogs);
    
    if (logs.length === 0) {
      console.log('⚠️  No enrichment logs found for performance analysis');
      return {};
    }
    
    const processingTimes = logs.map(log => log.processingTimeMs).filter(t => t != null);
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const maxProcessingTime = Math.max(...processingTimes);
    const minProcessingTime = Math.min(...processingTimes);
    
    const successfulLogs = logs.filter(log => log.status === 'success');
    const successRate = successfulLogs.length / logs.length;
    
    const performanceResults = {
      avgProcessingTime,
      maxProcessingTime,
      minProcessingTime,
      successRate,
      totalProcessed: logs.length,
      successfulProcessed: successfulLogs.length,
      failedProcessed: logs.length - successfulLogs.length,
      meetsTimeThreshold: avgProcessingTime <= this.config.performanceThresholds.avgProcessingTime,
      meetsSuccessThreshold: successRate >= this.config.performanceThresholds.successRate
    };
    
    console.log('⚡ Performance Results:');
    console.log(`   Avg Processing Time: ${(avgProcessingTime / 1000).toFixed(2)}s per business`);
    console.log(`   Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`   Time Threshold: ${performanceResults.meetsTimeThreshold ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Success Threshold: ${performanceResults.meetsSuccessThreshold ? '✅ PASS' : '❌ FAIL'}`);
    
    this.testResults.performanceTests = performanceResults;
    return performanceResults;
  }

  async loadTestResults(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Could not load test results from ${filePath}: ${error.message}`);
      return { metadata: { stats: { total: 0, successful: 0, failed: 0 } }, results: [] };
    }
  }

  async saveMismatchReport(mismatches, accuracyByCategory) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMismatches: mismatches.length,
        accuracyByCategory: accuracyByCategory
      },
      mismatches: mismatches,
      recommendations: this.generateAccuracyRecommendations(mismatches, accuracyByCategory)
    };
    
    const filePath = `${this.config.outputDir}/accuracy-mismatch-report.json`;
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    console.log(`📊 Accuracy mismatch report saved to ${filePath}`);
  }

  generateAccuracyRecommendations(mismatches, accuracyByCategory) {
    const recommendations = [];
    
    // Category-specific recommendations
    Object.entries(accuracyByCategory).forEach(([category, data]) => {
      const accuracy = data.correct / data.total;
      if (accuracy < 0.7) {
        recommendations.push(`Improve ${category} classification - only ${(accuracy * 100).toFixed(1)}% accurate`);
      }
    });
    
    // Pattern analysis in mismatches
    const commonErrors = {};
    mismatches.forEach(mismatch => {
      const errorPattern = `${mismatch.expected} → ${mismatch.actual}`;
      commonErrors[errorPattern] = (commonErrors[errorPattern] || 0) + 1;
    });
    
    const frequentErrors = Object.entries(commonErrors)
      .filter(([pattern, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    frequentErrors.forEach(([pattern, count]) => {
      recommendations.push(`Address common misclassification: ${pattern} (${count} occurrences)`);
    });
    
    return recommendations;
  }

  async generateProductionReadinessReport() {
    console.log('\n🎯 Generating Production Readiness Assessment...');
    
    const readiness = {
      overallScore: 0,
      readyForProduction: false,
      criticalIssues: [],
      warnings: [],
      recommendations: [],
      scalabilityAssessment: {},
      costProjection: {},
      riskAssessment: {}
    };
    
    // Calculate overall readiness score
    let scoreComponents = [];
    
    // Performance score (30%)
    const perfTests = this.testResults.performanceTests;
    if (perfTests) {
      let perfScore = 0;
      if (perfTests.meetsTimeThreshold) perfScore += 0.5;
      if (perfTests.meetsSuccessThreshold) perfScore += 0.5;
      scoreComponents.push({ component: 'performance', weight: 0.3, score: perfScore });
    }
    
    // Accuracy score (40%)
    const accuracyTests = this.testResults.qualityTests?.accuracy;
    if (accuracyTests) {
      const accuracyScore = accuracyTests.meetsTreshold ? 1.0 : accuracyTests.overallAccuracy;
      scoreComponents.push({ component: 'accuracy', weight: 0.4, score: accuracyScore });
    }
    
    // Quality score (30%)
    const qualityTests = this.testResults.qualityTests?.quality;
    if (qualityTests) {
      const qualityScore = qualityTests.overallQuality;
      scoreComponents.push({ component: 'quality', weight: 0.3, score: qualityScore });
    }
    
    // Calculate weighted average
    const totalWeight = scoreComponents.reduce((sum, comp) => sum + comp.weight, 0);
    const weightedScore = scoreComponents.reduce((sum, comp) => sum + (comp.score * comp.weight), 0);
    readiness.overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Determine production readiness
    readiness.readyForProduction = readiness.overallScore >= 0.8;
    
    // Identify critical issues
    if (perfTests && !perfTests.meetsSuccessThreshold) {
      readiness.criticalIssues.push(`Success rate too low: ${(perfTests.successRate * 100).toFixed(1)}%`);
    }
    
    if (accuracyTests && !accuracyTests.meetsTreshold) {
      readiness.criticalIssues.push(`Classification accuracy too low: ${(accuracyTests.overallAccuracy * 100).toFixed(1)}%`);
    }
    
    if (qualityTests && qualityTests.overallQuality < 0.7) {
      readiness.criticalIssues.push(`Data quality too low: ${(qualityTests.overallQuality * 100).toFixed(1)}%`);
    }
    
    // Generate scalability assessment
    readiness.scalabilityAssessment = this.assessScalability();
    
    // Generate cost projection
    readiness.costProjection = this.projectCosts();
    
    // Generate risk assessment
    readiness.riskAssessment = this.assessRisks();
    
    // Generate recommendations
    readiness.recommendations = this.generateProductionRecommendations(readiness);
    
    // Save report
    const reportPath = `${this.config.outputDir}/production-readiness-report.json`;
    await fs.writeFile(reportPath, JSON.stringify(readiness, null, 2));
    
    console.log(`📋 Production readiness score: ${(readiness.overallScore * 100).toFixed(1)}%`);
    console.log(`🚀 Ready for production: ${readiness.readyForProduction ? '✅ YES' : '❌ NO'}`);
    
    if (readiness.criticalIssues.length > 0) {
      console.log('🚨 Critical Issues:');
      readiness.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
    }
    
    return readiness;
  }

  assessScalability() {
    const batchTests = this.testResults.batchTests || {};
    const methodTests = this.testResults.methodTests || {};
    
    let bestThroughput = 0;
    let optimalBatchSize = 10;
    
    Object.entries(batchTests).forEach(([batchSize, results]) => {
      if (results.success && results.throughput > bestThroughput) {
        bestThroughput = results.throughput;
        optimalBatchSize = parseInt(batchSize);
      }
    });
    
    const estimatedTimeFor4521 = Math.ceil(4521 / bestThroughput / 60); // minutes
    
    return {
      bestThroughput: bestThroughput,
      optimalBatchSize: optimalBatchSize,
      estimatedTimeFor4521Businesses: estimatedTimeFor4521,
      memoryRequirements: this.calculateMemoryRequirements(),
      concurrencyRecommendation: this.recommendOptimalConcurrency()
    };
  }

  projectCosts() {
    const methodTests = this.testResults.methodTests || {};
    
    // Estimate costs based on method distribution
    const lfaBusinesses = Math.floor(4521 * 0.3); // Estimate 30% LFA members
    const nonLfaBusinesses = 4521 - lfaBusinesses;
    
    const firecrawlCostPerBusiness = methodTests.firecrawl?.cost || 0.01;
    const playwrightCostPerBusiness = 0; // Free
    
    const totalFirecrawlCost = lfaBusinesses * firecrawlCostPerBusiness;
    const totalPlaywrightCost = nonLfaBusinesses * playwrightCostPerBusiness;
    const openaiCost = 4521 * 0.02; // Estimate $0.02 per business for AI processing
    
    return {
      firecrawlCost: totalFirecrawlCost,
      playwrightCost: totalPlaywrightCost,
      openaiCost: openaiCost,
      totalEstimatedCost: totalFirecrawlCost + totalPlaywrightCost + openaiCost,
      costPerBusiness: (totalFirecrawlCost + totalPlaywrightCost + openaiCost) / 4521,
      withinBudget: (totalFirecrawlCost + totalPlaywrightCost + openaiCost) <= 125
    };
  }

  assessRisks() {
    const risks = [];
    
    // Performance risks
    const perfTests = this.testResults.performanceTests || {};
    if (perfTests.avgProcessingTime > 25000) {
      risks.push({
        category: 'performance',
        level: 'medium',
        description: 'Processing time close to threshold',
        mitigation: 'Monitor processing time during full run'
      });
    }
    
    // Accuracy risks
    const accuracyTests = this.testResults.qualityTests?.accuracy;
    if (accuracyTests && accuracyTests.overallAccuracy < 0.85) {
      risks.push({
        category: 'quality',
        level: 'high',
        description: 'Classification accuracy below optimal',
        mitigation: 'Manual review of misclassified businesses'
      });
    }
    
    // Cost risks
    const costProjection = this.projectCosts();
    if (costProjection.totalEstimatedCost > 100) {
      risks.push({
        category: 'cost',
        level: 'medium',
        description: 'Cost approaching budget limit',
        mitigation: 'Monitor costs closely during processing'
      });
    }
    
    return risks;
  }

  calculateMemoryRequirements() {
    const currentUsage = process.memoryUsage();
    return {
      currentHeapUsed: currentUsage.heapUsed,
      currentHeapTotal: currentUsage.heapTotal,
      estimatedForFullRun: currentUsage.heapUsed * 10 // Conservative estimate
    };
  }

  recommendOptimalConcurrency() {
    const batchTests = this.testResults.batchTests || {};
    // Simple recommendation based on test results
    // In production, this would be more sophisticated
    return {
      recommended: 2,
      reasoning: 'Balance between throughput and resource usage'
    };
  }

  generateProductionRecommendations(readiness) {
    const recommendations = [];
    
    if (readiness.overallScore < 0.8) {
      recommendations.push('Overall readiness below 80% - address critical issues before production deployment');
    }
    
    if (readiness.criticalIssues.length > 0) {
      recommendations.push('Resolve all critical issues before proceeding with full dataset processing');
    }
    
    if (readiness.scalabilityAssessment.estimatedTimeFor4521Businesses > 180) {
      recommendations.push('Consider increasing concurrency or batch size to reduce processing time');
    }
    
    if (!readiness.costProjection.withinBudget) {
      recommendations.push('Review cost projection - may exceed budget constraints');
    }
    
    recommendations.push(`Use batch size of ${readiness.scalabilityAssessment.optimalBatchSize} for optimal throughput`);
    recommendations.push('Monitor progress every 100 businesses and save checkpoints');
    recommendations.push('Perform manual quality review on 5% sample during processing');
    
    return recommendations;
  }

  async generateFinalReport() {
    console.log('\n📊 Generating Final Test Report...');
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: this.testResults.duration,
        config: this.config,
        environment: {
          node: process.version,
          platform: process.platform,
          memory: process.memoryUsage()
        }
      },
      summary: {
        overallSuccess: this.testResults.summary?.overallSuccess || false,
        criticalIssues: this.testResults.summary?.criticalIssues || 0,
        recommendations: this.testResults.recommendations || []
      },
      testResults: this.testResults,
      conclusions: this.generateConclusions()
    };
    
    // Save comprehensive report
    const reportPath = `${this.config.outputDir}/comprehensive-test-report.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    const summaryPath = `${this.config.outputDir}/test-summary.md`;
    const markdownSummary = this.generateMarkdownSummary(report);
    await fs.writeFile(summaryPath, markdownSummary);
    
    console.log(`📄 Comprehensive report saved to ${reportPath}`);
    console.log(`📝 Summary report saved to ${summaryPath}`);
    
    return report;
  }

  generateConclusions() {
    const conclusions = {
      readyForProduction: false,
      confidence: 'low',
      majorFindings: [],
      nextSteps: []
    };
    
    // Analyze test results to generate conclusions
    const perfTests = this.testResults.performanceTests;
    const accuracyTests = this.testResults.qualityTests?.accuracy;
    const qualityTests = this.testResults.qualityTests?.quality;
    
    let passedTests = 0;
    let totalTests = 0;
    
    if (perfTests) {
      totalTests++;
      if (perfTests.meetsTimeThreshold && perfTests.meetsSuccessThreshold) {
        passedTests++;
        conclusions.majorFindings.push('Performance tests passed - pipeline meets speed and reliability requirements');
      } else {
        conclusions.majorFindings.push('Performance tests failed - pipeline needs optimization');
      }
    }
    
    if (accuracyTests) {
      totalTests++;
      if (accuracyTests.meetsTreshold) {
        passedTests++;
        conclusions.majorFindings.push(`Classification accuracy acceptable at ${(accuracyTests.overallAccuracy * 100).toFixed(1)}%`);
      } else {
        conclusions.majorFindings.push(`Classification accuracy below threshold at ${(accuracyTests.overallAccuracy * 100).toFixed(1)}%`);
      }
    }
    
    if (qualityTests) {
      totalTests++;
      if (qualityTests.overallQuality >= 0.7) {
        passedTests++;
        conclusions.majorFindings.push('Data quality tests passed - enriched data meets standards');
      } else {
        conclusions.majorFindings.push('Data quality tests failed - enriched data needs improvement');
      }
    }
    
    // Determine readiness
    const successRate = passedTests / Math.max(totalTests, 1);
    conclusions.readyForProduction = successRate >= 0.8;
    conclusions.confidence = successRate >= 0.9 ? 'high' : successRate >= 0.7 ? 'medium' : 'low';
    
    // Next steps
    if (conclusions.readyForProduction) {
      conclusions.nextSteps.push('Proceed with production deployment on full dataset');
      conclusions.nextSteps.push('Monitor performance closely during initial batches');
      conclusions.nextSteps.push('Perform quality spot-checks during processing');
    } else {
      conclusions.nextSteps.push('Address identified issues before production deployment');
      conclusions.nextSteps.push('Rerun tests after implementing improvements');
      conclusions.nextSteps.push('Consider phased rollout starting with smaller subset');
    }
    
    return conclusions;
  }

  generateMarkdownSummary(report) {
    return `# Business Enrichment Pipeline Test Report

## Executive Summary

**Test Date:** ${report.metadata.timestamp}
**Duration:** ${Math.round(report.metadata.duration / 1000)} seconds
**Production Ready:** ${report.conclusions.readyForProduction ? '✅ YES' : '❌ NO'}
**Confidence:** ${report.conclusions.confidence.toUpperCase()}

## Key Findings

${report.conclusions.majorFindings.map(finding => `- ${finding}`).join('\n')}

## Test Results Summary

### Performance Tests
${report.testResults.performanceTests ? `
- **Average Processing Time:** ${(report.testResults.performanceTests.avgProcessingTime / 1000).toFixed(2)}s per business
- **Success Rate:** ${(report.testResults.performanceTests.successRate * 100).toFixed(1)}%
- **Time Threshold:** ${report.testResults.performanceTests.meetsTimeThreshold ? '✅ PASS' : '❌ FAIL'}
- **Success Threshold:** ${report.testResults.performanceTests.meetsSuccessThreshold ? '✅ PASS' : '❌ FAIL'}
` : 'No performance tests available'}

### Classification Accuracy Tests
${report.testResults.qualityTests?.accuracy ? `
- **Overall Accuracy:** ${(report.testResults.qualityTests.accuracy.overallAccuracy * 100).toFixed(1)}%
- **Correct Classifications:** ${report.testResults.qualityTests.accuracy.correctClassifications}/${report.testResults.qualityTests.accuracy.totalValidated}
- **Meets Threshold:** ${report.testResults.qualityTests.accuracy.meetsTreshold ? '✅ PASS' : '❌ FAIL'}
` : 'No accuracy tests available'}

### Quality Assessment Tests
${report.testResults.qualityTests?.quality ? `
- **Description Quality:** ${(report.testResults.qualityTests.quality.descriptionQuality * 100).toFixed(1)}%
- **Products Quality:** ${(report.testResults.qualityTests.quality.productsQuality * 100).toFixed(1)}%
- **Keywords Quality:** ${(report.testResults.qualityTests.quality.keywordsQuality * 100).toFixed(1)}%
- **Overall Quality:** ${(report.testResults.qualityTests.quality.overallQuality * 100).toFixed(1)}%
` : 'No quality tests available'}

## Recommendations

${report.testResults.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${report.conclusions.nextSteps.map(step => `1. ${step}`).join('\n')}

---
*Generated by LocalFirst Arizona Business Enrichment Test Suite*
`;
  }

  async run() {
    try {
      this.testResults.startTime = new Date();
      console.log('🧪 Starting Comprehensive Business Enrichment Pipeline Test Suite...');
      
      await this.initialize();
      
      // Load expected outcomes for validation
      const expectedOutcomes = await this.loadExpectedOutcomes();
      
      // Run all test suites
      console.log('\n' + '='.repeat(80));
      
      await this.runMethodComparisonTests();
      await this.runBatchSizeTests();
      await this.runAccuracyValidationTests(expectedOutcomes);
      await this.runQualityAssessmentTests();
      await this.runPerformanceTests();
      
      const productionReadiness = await this.generateProductionReadinessReport();
      this.testResults.productionReadiness = productionReadiness;
      
      this.testResults.endTime = new Date();
      this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
      
      const finalReport = await this.generateFinalReport();
      
      // Final summary
      console.log('\n' + '='.repeat(80));
      console.log('🎉 COMPREHENSIVE TEST SUITE COMPLETED');
      console.log('='.repeat(80));
      console.log(`⏱️  Total Duration: ${Math.round(this.testResults.duration / 1000)} seconds`);
      console.log(`🎯 Production Ready: ${finalReport.conclusions.readyForProduction ? '✅ YES' : '❌ NO'}`);
      console.log(`📊 Confidence Level: ${finalReport.conclusions.confidence.toUpperCase()}`);
      console.log('\n📁 Reports Generated:');
      console.log(`   • ${this.config.outputDir}/comprehensive-test-report.json`);
      console.log(`   • ${this.config.outputDir}/test-summary.md`);
      console.log(`   • ${this.config.outputDir}/production-readiness-report.json`);
      console.log(`   • ${this.config.outputDir}/accuracy-mismatch-report.json`);
      console.log('='.repeat(80));
      
      return finalReport;
      
    } catch (error) {
      console.error('💥 Test suite failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// CLI Interface
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sample-size':
        config.sampleSize = parseInt(args[++i]);
        break;
      case '--batch-sizes':
        config.batchSizes = args[++i].split(',').map(n => parseInt(n));
        break;
      case '--methods':
        config.testMethods = args[++i].split(',');
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }
  
  return config;
}

function showHelp() {
  console.log(`
LocalFirst Arizona Business Enrichment Pipeline - Comprehensive Test Suite

USAGE:
  node scripts/comprehensive-test-suite.js [OPTIONS]

OPTIONS:
  --sample-size <n>        Number of businesses to test (default: 100)
  --batch-sizes <sizes>    Comma-separated batch sizes to test (default: 5,10,25)
  --methods <methods>      Comma-separated methods to test (default: firecrawl,playwright,auto)
  --help                   Show this help

WHAT IT TESTS:
  • Method comparison (Firecrawl vs Playwright vs Auto)
  • Batch size performance optimization
  • Classification accuracy vs manual expectations
  • Content quality and consumer-friendliness
  • Processing speed and success rates
  • Cost projections and budget compliance
  • Production readiness assessment

OUTPUT FILES:
  • test-results/comprehensive-test-report.json
  • test-results/test-summary.md
  • test-results/production-readiness-report.json
  • test-results/accuracy-mismatch-report.json

REQUIREMENTS:
  • Test dataset must be created first (run create-test-dataset.js)
  • OpenAI API key configured for AI classification
  • Database populated with test businesses
`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = parseArgs();
  const testSuite = new ComprehensiveTestSuite(config);
  testSuite.run();
}

export { ComprehensiveTestSuite };