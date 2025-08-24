#!/usr/bin/env node

/**
 * Quality Assessment Script for Business Enrichment Results
 * 
 * Performs comprehensive quality analysis of enriched business data:
 * - Description quality and readability assessment
 * - Classification accuracy review
 * - Content completeness validation
 * - Consumer-friendliness scoring
 * - Manual review workflow
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { businesses, enrichmentLogs } from '../src/db/schema.js';
import fs from 'fs/promises';
import readline from 'readline';

class QualityAssessmentTool {
  constructor(config = {}) {
    this.config = {
      sampleSize: config.sampleSize || 20, // 20% of enriched businesses for manual review
      outputDir: config.outputDir || './quality-assessment',
      assessmentFile: config.assessmentFile || 'quality-assessment-results.json',
      autoAssess: config.autoAssess !== false,
      manualReview: config.manualReview !== false,
      verbose: config.verbose !== false,
      qualityThresholds: {
        description: { minScore: 0.7, minLength: 100, maxLength: 1200 },
        keywords: { minCount: 3, maxCount: 15 },
        products: { minItems: 1 },
        confidence: { minScore: 0.6 }
      },
      ...config
    };

    this.db = null;
    this.assessmentResults = {
      timestamp: new Date().toISOString(),
      config: this.config,
      overallScores: {},
      businessAssessments: [],
      categoryAnalysis: {},
      recommendations: []
    };
  }

  async initialize() {
    console.log('🔍 Initializing Quality Assessment Tool...');
    
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
    
    console.log('✅ Quality assessment tool initialized');
  }

  async getEnrichedBusinesses() {
    console.log('📊 Fetching enriched businesses for assessment...');
    
    const enriched = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.enrichmentStatus, 'completed'));
    
    console.log(`Found ${enriched.length} enriched businesses`);
    
    // Select sample for manual review if needed
    let sampleBusinesses = enriched;
    if (this.config.sampleSize < enriched.length) {
      sampleBusinesses = this.selectRepresentativeSample(enriched, this.config.sampleSize);
      console.log(`Selected ${sampleBusinesses.length} businesses for detailed assessment`);
    }
    
    return { all: enriched, sample: sampleBusinesses };
  }

  selectRepresentativeSample(businesses, sampleSize) {
    // Ensure representative sample across categories
    const categories = [...new Set(businesses.map(b => b.primaryCategory).filter(c => c))];
    const samplePerCategory = Math.max(1, Math.floor(sampleSize / categories.length));
    
    let sample = [];
    
    for (const category of categories) {
      const categoryBusinesses = businesses.filter(b => b.primaryCategory === category);
      const categorySample = categoryBusinesses
        .sort(() => 0.5 - Math.random()) // Shuffle
        .slice(0, samplePerCategory);
      sample.push(...categorySample);
    }
    
    // Fill remaining slots with random selection
    const remaining = sampleSize - sample.length;
    if (remaining > 0) {
      const unusedBusinesses = businesses.filter(b => !sample.find(s => s.id === b.id));
      const additionalSample = unusedBusinesses
        .sort(() => 0.5 - Math.random())
        .slice(0, remaining);
      sample.push(...additionalSample);
    }
    
    return sample.slice(0, sampleSize);
  }

  async runAutomatedQualityAssessment(businesses) {
    console.log('\n🤖 Running Automated Quality Assessment...');
    
    let totalScores = {
      description: 0,
      keywords: 0,
      products: 0,
      overall: 0,
      confidence: 0
    };
    
    const categoryScores = {};
    const issuesSummary = {
      shortDescriptions: 0,
      longDescriptions: 0,
      genericDescriptions: 0,
      fewKeywords: 0,
      missingProducts: 0,
      lowConfidence: 0
    };
    
    for (const business of businesses) {
      const assessment = await this.assessBusinessQuality(business);
      
      // Track scores
      totalScores.description += assessment.descriptionScore;
      totalScores.keywords += assessment.keywordsScore;
      totalScores.products += assessment.productsScore;
      totalScores.confidence += assessment.confidenceScore;
      totalScores.overall += assessment.overallScore;
      
      // Track by category
      const category = business.primaryCategory || 'unknown';
      if (!categoryScores[category]) {
        categoryScores[category] = { scores: [], count: 0 };
      }
      categoryScores[category].scores.push(assessment.overallScore);
      categoryScores[category].count++;
      
      // Track issues
      assessment.issues.forEach(issue => {
        if (issue.includes('too short')) issuesSummary.shortDescriptions++;
        if (issue.includes('too long')) issuesSummary.longDescriptions++;
        if (issue.includes('generic')) issuesSummary.genericDescriptions++;
        if (issue.includes('few keywords')) issuesSummary.fewKeywords++;
        if (issue.includes('products')) issuesSummary.missingProducts++;
        if (issue.includes('confidence')) issuesSummary.lowConfidence++;
      });
      
      this.assessmentResults.businessAssessments.push(assessment);
    }
    
    // Calculate averages
    const count = businesses.length;
    this.assessmentResults.overallScores = {
      description: totalScores.description / count,
      keywords: totalScores.keywords / count,
      products: totalScores.products / count,
      confidence: totalScores.confidence / count,
      overall: totalScores.overall / count
    };
    
    // Category analysis
    this.assessmentResults.categoryAnalysis = Object.entries(categoryScores).map(([category, data]) => {
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        category,
        count: data.count,
        averageScore: avgScore,
        grade: this.scoreToGrade(avgScore)
      };
    }).sort((a, b) => b.averageScore - a.averageScore);
    
    this.assessmentResults.issuesSummary = issuesSummary;
    
    console.log('📊 Automated assessment completed:');
    console.log(`   Overall Quality Score: ${(this.assessmentResults.overallScores.overall * 100).toFixed(1)}%`);
    console.log(`   Description Quality: ${(this.assessmentResults.overallScores.description * 100).toFixed(1)}%`);
    console.log(`   Keywords Quality: ${(this.assessmentResults.overallScores.keywords * 100).toFixed(1)}%`);
    console.log(`   Products Quality: ${(this.assessmentResults.overallScores.products * 100).toFixed(1)}%`);
    
    return this.assessmentResults.overallScores;
  }

  async assessBusinessQuality(business) {
    const assessment = {
      businessId: business.id,
      businessName: business.name,
      category: business.primaryCategory,
      lfaMember: business.lfaMember,
      website: business.website,
      descriptionScore: 0,
      keywordsScore: 0,
      productsScore: 0,
      confidenceScore: 0,
      overallScore: 0,
      issues: [],
      recommendations: []
    };

    // Assess description quality
    const descAssessment = this.assessDescription(business.businessDescription, business.name);
    assessment.descriptionScore = descAssessment.score;
    assessment.issues.push(...descAssessment.issues);

    // Assess keywords quality
    const keywordsAssessment = this.assessKeywords(business.keywords, business.name);
    assessment.keywordsScore = keywordsAssessment.score;
    assessment.issues.push(...keywordsAssessment.issues);

    // Assess products/services
    const productsAssessment = this.assessProducts(business.productsServices);
    assessment.productsScore = productsAssessment.score;
    assessment.issues.push(...productsAssessment.issues);

    // Get confidence from logs
    const confidence = await this.getBusinessConfidence(business.id);
    assessment.confidenceScore = confidence;
    if (confidence < this.config.qualityThresholds.confidence.minScore) {
      assessment.issues.push(`Low confidence score: ${confidence.toFixed(2)}`);
    }

    // Calculate overall score
    assessment.overallScore = (
      assessment.descriptionScore * 0.4 +
      assessment.keywordsScore * 0.2 +
      assessment.productsScore * 0.2 +
      assessment.confidenceScore * 0.2
    );

    // Generate recommendations
    assessment.recommendations = this.generateBusinessRecommendations(assessment);

    return assessment;
  }

  assessDescription(description, businessName) {
    const issues = [];
    let score = 1.0;

    if (!description) {
      return { score: 0, issues: ['Missing business description'] };
    }

    // Length check
    if (description.length < this.config.qualityThresholds.description.minLength) {
      issues.push(`Description too short: ${description.length} characters`);
      score -= 0.3;
    }
    if (description.length > this.config.qualityThresholds.description.maxLength) {
      issues.push(`Description too long: ${description.length} characters`);
      score -= 0.1;
    }

    // Content quality checks
    if (!description.toLowerCase().includes('arizona')) {
      issues.push('Missing Arizona location context');
      score -= 0.2;
    }

    // Check for generic language
    const genericPhrases = [
      'quality service', 'professional service', 'serving the community',
      'dedicated to', 'committed to', 'we provide', 'we offer'
    ];
    const genericCount = genericPhrases.filter(phrase => 
      description.toLowerCase().includes(phrase.toLowerCase())
    ).length;

    if (genericCount > 3) {
      issues.push('Description contains too many generic phrases');
      score -= 0.2;
    }

    // Check business name repetition
    const nameOccurrences = (description.toLowerCase().match(new RegExp(businessName.toLowerCase(), 'g')) || []).length;
    if (nameOccurrences > 3) {
      issues.push('Business name mentioned too frequently');
      score -= 0.1;
    }

    // Readability check
    const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 2) {
      issues.push('Description needs more sentences for readability');
      score -= 0.1;
    }

    // Check for specific details
    const hasSpecifics = /\b(since \d{4}|over \d+ years|\$\d+|free|certified|licensed|award|specializ)/i.test(description);
    if (!hasSpecifics) {
      issues.push('Description lacks specific details or credentials');
      score -= 0.1;
    }

    return { score: Math.max(0, score), issues };
  }

  assessKeywords(keywords, businessName) {
    const issues = [];
    let score = 1.0;

    if (!keywords) {
      return { score: 0, issues: ['Missing keywords'] };
    }

    const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    const uniqueKeywords = [...new Set(keywordArray.map(k => k.toLowerCase()))];

    // Count check
    if (keywordArray.length < this.config.qualityThresholds.keywords.minCount) {
      issues.push(`Too few keywords: ${keywordArray.length}`);
      score -= 0.3;
    }
    if (keywordArray.length > this.config.qualityThresholds.keywords.maxCount) {
      issues.push(`Too many keywords: ${keywordArray.length}`);
      score -= 0.1;
    }

    // Uniqueness check
    if (uniqueKeywords.length < keywordArray.length) {
      issues.push('Contains duplicate keywords');
      score -= 0.2;
    }

    // Essential keywords check
    const keywordsLower = keywords.toLowerCase();
    if (!keywordsLower.includes('arizona')) {
      issues.push('Missing Arizona location keyword');
      score -= 0.2;
    }
    if (!keywordsLower.includes(businessName.toLowerCase())) {
      issues.push('Missing business name in keywords');
      score -= 0.1;
    }

    // Relevance check (basic)
    const relevantTerms = ['local', 'service', 'business', 'professional', 'quality'].filter(term => 
      keywordsLower.includes(term)
    );
    if (relevantTerms.length === 0) {
      issues.push('Keywords lack business-relevant terms');
      score -= 0.1;
    }

    return { score: Math.max(0, score), issues };
  }

  assessProducts(productsServices) {
    const issues = [];
    let score = 1.0;

    if (!productsServices) {
      return { score: 0, issues: ['Missing products/services data'] };
    }

    try {
      const products = JSON.parse(productsServices);
      let itemCount = 0;

      if (Array.isArray(products)) {
        itemCount = products.length;
      } else if (typeof products === 'object') {
        itemCount = Object.values(products).flat().length;
      }

      if (itemCount < this.config.qualityThresholds.products.minItems) {
        issues.push(`Too few products/services listed: ${itemCount}`);
        score -= 0.4;
      }

      // Check for specificity
      const hasSpecific = JSON.stringify(products).length > 100;
      if (!hasSpecific) {
        issues.push('Products/services lack detail');
        score -= 0.2;
      }

    } catch (error) {
      issues.push('Invalid JSON format for products/services');
      return { score: 0, issues };
    }

    return { score: Math.max(0, score), issues };
  }

  async getBusinessConfidence(businessId) {
    try {
      const logs = await this.db
        .select()
        .from(enrichmentLogs)
        .where(eq(enrichmentLogs.businessId, businessId));
      
      if (logs.length > 0) {
        return logs[0].confidenceScore || 0;
      }
    } catch (error) {
      console.warn(`Failed to get confidence for ${businessId}: ${error.message}`);
    }
    return 0;
  }

  generateBusinessRecommendations(assessment) {
    const recommendations = [];

    if (assessment.descriptionScore < 0.7) {
      recommendations.push('Improve description: add more specific details and local context');
    }

    if (assessment.keywordsScore < 0.7) {
      recommendations.push('Enhance keywords: ensure Arizona and business name are included');
    }

    if (assessment.productsScore < 0.7) {
      recommendations.push('Expand products/services: add more detailed offerings');
    }

    if (assessment.confidenceScore < 0.6) {
      recommendations.push('Low AI confidence: may need manual review and correction');
    }

    if (assessment.overallScore < 0.6) {
      recommendations.push('Priority for manual review and improvement');
    }

    return recommendations;
  }

  async runManualReviewProcess(sampleBusinesses) {
    if (!this.config.manualReview) {
      console.log('⏭️  Skipping manual review (disabled in config)');
      return [];
    }

    console.log(`\n👥 Starting Manual Review Process for ${sampleBusinesses.length} businesses...`);
    console.log('Press Ctrl+C to skip manual review and continue with automated results');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const manualReviews = [];

    try {
      for (let i = 0; i < Math.min(10, sampleBusinesses.length); i++) { // Limit to 10 for demo
        const business = sampleBusinesses[i];
        console.log(`\n--- Manual Review ${i + 1}/${Math.min(10, sampleBusinesses.length)} ---`);
        
        const review = await this.conductManualReview(business, rl);
        manualReviews.push(review);
      }
    } catch (error) {
      console.log('\n⏭️  Manual review interrupted, continuing with automated assessment...');
    } finally {
      rl.close();
    }

    return manualReviews;
  }

  async conductManualReview(business, rl) {
    console.log(`\nBusiness: ${business.name}`);
    console.log(`Category: ${business.primaryCategory}`);
    console.log(`Website: ${business.website}`);
    console.log(`Description: ${business.businessDescription?.substring(0, 200)}...`);

    const questions = [
      'Rate the description quality (1-5): ',
      'Is the category classification correct? (y/n): ',
      'Are the keywords relevant? (y/n): ',
      'Overall consumer-friendliness (1-5): ',
      'Any issues or comments: '
    ];

    const answers = {};
    
    try {
      for (const question of questions) {
        const answer = await this.askQuestion(rl, question);
        answers[question] = answer;
      }
    } catch (error) {
      throw error; // Re-throw to stop manual review
    }

    return {
      businessId: business.id,
      businessName: business.name,
      manualScores: {
        descriptionQuality: parseInt(answers[questions[0]]) || 3,
        categoryCorrect: answers[questions[1]]?.toLowerCase() === 'y',
        keywordsRelevant: answers[questions[2]]?.toLowerCase() === 'y',
        consumerFriendliness: parseInt(answers[questions[3]]) || 3
      },
      comments: answers[questions[4]] || ''
    };
  }

  askQuestion(rl, question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  scoreToGrade(score) {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B';
    if (score >= 0.6) return 'C';
    if (score >= 0.5) return 'D';
    return 'F';
  }

  generateQualityReport() {
    console.log('\n📋 Generating Quality Assessment Report...');

    const report = {
      ...this.assessmentResults,
      summary: {
        totalBusinessesAssessed: this.assessmentResults.businessAssessments.length,
        overallGrade: this.scoreToGrade(this.assessmentResults.overallScores.overall),
        passRate: this.assessmentResults.businessAssessments.filter(b => b.overallScore >= 0.7).length / this.assessmentResults.businessAssessments.length,
        topPerformingCategory: this.assessmentResults.categoryAnalysis[0]?.category,
        needsImprovementCount: this.assessmentResults.businessAssessments.filter(b => b.overallScore < 0.6).length
      },
      recommendations: this.generateOverallRecommendations()
    };

    return report;
  }

  generateOverallRecommendations() {
    const recommendations = [];
    const scores = this.assessmentResults.overallScores;
    const issues = this.assessmentResults.issuesSummary;

    // Overall quality recommendations
    if (scores.overall < 0.8) {
      recommendations.push('Overall quality below target - focus on improving description and keyword quality');
    }

    // Description improvements
    if (scores.description < 0.7) {
      recommendations.push('Description quality needs improvement - add more specific details and local context');
    }
    if (issues.shortDescriptions > 5) {
      recommendations.push(`${issues.shortDescriptions} businesses have descriptions that are too short`);
    }
    if (issues.genericDescriptions > 10) {
      recommendations.push('Many descriptions use generic language - encourage more specific, unique content');
    }

    // Keywords improvements
    if (scores.keywords < 0.8) {
      recommendations.push('Keyword quality needs improvement - ensure consistency and relevance');
    }

    // Products improvements
    if (scores.products < 0.7) {
      recommendations.push('Products/services data needs more detail and structure');
    }

    // Category-specific recommendations
    const lowPerformingCategories = this.assessmentResults.categoryAnalysis
      .filter(cat => cat.averageScore < 0.7)
      .slice(0, 3);
    
    lowPerformingCategories.forEach(category => {
      recommendations.push(`Focus on improving ${category.category} businesses (avg score: ${(category.averageScore * 100).toFixed(1)}%)`);
    });

    // Process recommendations
    const needsReviewCount = this.assessmentResults.businessAssessments.filter(b => b.overallScore < 0.6).length;
    if (needsReviewCount > 0) {
      recommendations.push(`${needsReviewCount} businesses need manual review and improvement before production`);
    }

    return recommendations;
  }

  async saveResults() {
    const report = this.generateQualityReport();
    
    // Save detailed JSON report
    const reportPath = `${this.config.outputDir}/${this.config.assessmentFile}`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    const summaryPath = `${this.config.outputDir}/quality-summary.md`;
    const markdown = this.generateMarkdownSummary(report);
    await fs.writeFile(summaryPath, markdown);
    
    // Generate CSV for spreadsheet analysis
    const csvPath = `${this.config.outputDir}/business-quality-scores.csv`;
    const csv = this.generateCSVReport(report);
    await fs.writeFile(csvPath, csv);
    
    console.log(`📊 Quality assessment results saved:`);
    console.log(`   • ${reportPath}`);
    console.log(`   • ${summaryPath}`);
    console.log(`   • ${csvPath}`);
    
    return report;
  }

  generateMarkdownSummary(report) {
    return `# Business Enrichment Quality Assessment Report

## Summary

**Assessment Date:** ${report.timestamp}
**Businesses Assessed:** ${report.summary.totalBusinessesAssessed}
**Overall Grade:** ${report.summary.overallGrade}
**Pass Rate:** ${(report.summary.passRate * 100).toFixed(1)}% (70%+ score)

## Quality Scores

| Metric | Score | Grade |
|--------|--------|-------|
| Overall Quality | ${(report.overallScores.overall * 100).toFixed(1)}% | ${this.scoreToGrade(report.overallScores.overall)} |
| Description Quality | ${(report.overallScores.description * 100).toFixed(1)}% | ${this.scoreToGrade(report.overallScores.description)} |
| Keywords Quality | ${(report.overallScores.keywords * 100).toFixed(1)}% | ${this.scoreToGrade(report.overallScores.keywords)} |
| Products Quality | ${(report.overallScores.products * 100).toFixed(1)}% | ${this.scoreToGrade(report.overallScores.products)} |
| AI Confidence | ${(report.overallScores.confidence * 100).toFixed(1)}% | ${this.scoreToGrade(report.overallScores.confidence)} |

## Category Performance

${report.categoryAnalysis.map(cat => 
`- **${cat.category}**: ${(cat.averageScore * 100).toFixed(1)}% (${cat.grade}) - ${cat.count} businesses`
).join('\n')}

## Key Issues

- Short descriptions: ${report.issuesSummary.shortDescriptions}
- Long descriptions: ${report.issuesSummary.longDescriptions}  
- Generic descriptions: ${report.issuesSummary.genericDescriptions}
- Few keywords: ${report.issuesSummary.fewKeywords}
- Missing products: ${report.issuesSummary.missingProducts}
- Low confidence: ${report.issuesSummary.lowConfidence}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Businesses Needing Review

${report.businessAssessments
  .filter(b => b.overallScore < 0.6)
  .slice(0, 10)
  .map(b => `- **${b.businessName}** (${(b.overallScore * 100).toFixed(1)}%) - ${b.issues.join(', ')}`)
  .join('\n')}

---
*Generated by LocalFirst Arizona Quality Assessment Tool*
`;
  }

  generateCSVReport(report) {
    const headers = [
      'Business ID', 'Business Name', 'Category', 'LFA Member', 
      'Description Score', 'Keywords Score', 'Products Score', 'Confidence Score', 'Overall Score',
      'Grade', 'Issues Count', 'Top Issues'
    ];

    const rows = [headers.join(',')];
    
    report.businessAssessments.forEach(assessment => {
      const row = [
        assessment.businessId,
        `"${assessment.businessName}"`,
        assessment.category || 'unknown',
        assessment.lfaMember ? 'Yes' : 'No',
        (assessment.descriptionScore * 100).toFixed(1),
        (assessment.keywordsScore * 100).toFixed(1),
        (assessment.productsScore * 100).toFixed(1),
        (assessment.confidenceScore * 100).toFixed(1),
        (assessment.overallScore * 100).toFixed(1),
        this.scoreToGrade(assessment.overallScore),
        assessment.issues.length,
        `"${assessment.issues.slice(0, 3).join('; ')}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  async run() {
    try {
      console.log('🔍 Starting Business Enrichment Quality Assessment...');
      
      await this.initialize();
      
      const { all: allBusinesses, sample: sampleBusinesses } = await this.getEnrichedBusinesses();
      
      if (allBusinesses.length === 0) {
        console.log('⚠️  No enriched businesses found for assessment');
        return;
      }
      
      // Run automated assessment on all businesses
      if (this.config.autoAssess) {
        await this.runAutomatedQualityAssessment(allBusinesses);
      }
      
      // Run manual review on sample
      if (this.config.manualReview && sampleBusinesses.length > 0) {
        const manualReviews = await this.runManualReviewProcess(sampleBusinesses);
        this.assessmentResults.manualReviews = manualReviews;
      }
      
      // Generate and save report
      const finalReport = await this.saveResults();
      
      // Display summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 QUALITY ASSESSMENT COMPLETED');
      console.log('='.repeat(60));
      console.log(`Overall Quality Score: ${(finalReport.overallScores.overall * 100).toFixed(1)}%`);
      console.log(`Grade: ${finalReport.summary.overallGrade}`);
      console.log(`Pass Rate: ${(finalReport.summary.passRate * 100).toFixed(1)}%`);
      console.log(`Needs Improvement: ${finalReport.summary.needsImprovementCount} businesses`);
      console.log('='.repeat(60));
      
      return finalReport;
      
    } catch (error) {
      console.error('💥 Quality assessment failed:', error.message);
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
      case '--no-manual':
        config.manualReview = false;
        break;
      case '--no-auto':
        config.autoAssess = false;
        break;
      case '--output-dir':
        config.outputDir = args[++i];
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
LocalFirst Arizona Business Enrichment - Quality Assessment Tool

USAGE:
  node scripts/quality-assessment.js [OPTIONS]

OPTIONS:
  --sample-size <n>     Number of businesses for manual review (default: 20)
  --no-manual          Skip manual review process
  --no-auto            Skip automated assessment
  --output-dir <dir>   Output directory for reports (default: ./quality-assessment)
  --help               Show this help

FEATURES:
  • Automated quality scoring for all enriched businesses
  • Manual review workflow for representative sample
  • Category-specific performance analysis
  • Consumer-friendliness assessment
  • Detailed recommendations for improvement

OUTPUT FILES:
  • quality-assessment-results.json (detailed results)
  • quality-summary.md (human-readable summary)
  • business-quality-scores.csv (spreadsheet analysis)
`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = parseArgs();
  const assessment = new QualityAssessmentTool(config);
  assessment.run();
}

export { QualityAssessmentTool };