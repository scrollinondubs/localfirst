#!/usr/bin/env node

/**
 * Create Test Dataset for Business Enrichment Pipeline
 * 
 * Generates 100 diverse test businesses representing different categories,
 * locations, and complexity levels for comprehensive testing.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { businesses } from '../src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

// Test business data with diverse characteristics
const TEST_BUSINESSES = [
  // Food & Dining (20 businesses)
  { name: "Sedona Red Rock Cafe", category: "restaurant", city: "Sedona", type: "simple", lfaMember: true, website: "https://sedonacafe.com" },
  { name: "Phoenix Thai Kitchen", category: "restaurant", city: "Phoenix", type: "complex", lfaMember: false, website: "https://phoenixthaikitchen.com" },
  { name: "Tucson Taco Truck", category: "restaurant", city: "Tucson", type: "mobile", lfaMember: true, website: "https://tucsontacotruck.net" },
  { name: "Flagstaff Brewery & Grill", category: "restaurant", city: "Flagstaff", type: "brewery", lfaMember: false, website: "https://flagstaffbrewery.beer" },
  { name: "Scottsdale Fine Dining", category: "restaurant", city: "Scottsdale", type: "upscale", lfaMember: true, website: "https://scottsdalerestaurant.com" },
  { name: "Mesa Family Bakery", category: "restaurant", city: "Mesa", type: "bakery", lfaMember: false, website: "https://mesafamilybakery.com" },
  { name: "Tempe Coffee House", category: "restaurant", city: "Tempe", type: "coffeeshop", lfaMember: true, website: "https://tempecoffee.local" },
  { name: "Glendale Pizza Palace", category: "restaurant", city: "Glendale", type: "pizza", lfaMember: false, website: "https://glendalepizzapalace.org" },
  { name: "Chandler Sushi Bar", category: "restaurant", city: "Chandler", type: "sushi", lfaMember: true, website: "https://chandlersushi.biz" },
  { name: "Peoria BBQ Joint", category: "restaurant", city: "Peoria", type: "bbq", lfaMember: false, website: "https://peoriabbq.info" },
  { name: "Ahwatukee Healthy Eats", category: "restaurant", city: "Ahwatukee", type: "health", lfaMember: true, website: "https://healthyeatsaz.com" },
  { name: "Surprise Burger Shack", category: "restaurant", city: "Surprise", type: "casual", lfaMember: false, website: "https://surpriseburgers.net" },
  { name: "Gilbert Gelato", category: "restaurant", city: "Gilbert", type: "dessert", lfaMember: true, website: "https://gilbertgelato.co" },
  { name: "Queen Creek Vineyard", category: "restaurant", city: "Queen Creek", type: "winery", lfaMember: false, website: "https://queencreekvineyard.wine" },
  { name: "Sun City Diner", category: "restaurant", city: "Sun City", type: "diner", lfaMember: true, website: "https://suncitydiner.az" },
  { name: "Paradise Valley Bistro", category: "restaurant", city: "Paradise Valley", type: "french", lfaMember: false, website: "https://pvbistro.restaurant" },
  { name: "Avondale Tacos", category: "restaurant", city: "Avondale", type: "mexican", lfaMember: true, website: "https://avondaletacos.mx" },
  { name: "Carefree Organic Kitchen", category: "restaurant", city: "Carefree", type: "organic", lfaMember: false, website: "https://carefreeorganic.farm" },
  { name: "Fountain Hills Food Truck", category: "restaurant", city: "Fountain Hills", type: "food_truck", lfaMember: true, website: "https://fhfoodtruck.mobile" },
  { name: "Cave Creek Steakhouse", category: "restaurant", city: "Cave Creek", type: "steakhouse", lfaMember: false, website: "https://cavecreeksteaks.beef" },

  // Professional Services (20 businesses)
  { name: "Phoenix Law Group", category: "professional_services", city: "Phoenix", type: "legal", lfaMember: true, website: "https://phoenixlawgroup.com" },
  { name: "Scottsdale CPA Firm", category: "professional_services", city: "Scottsdale", type: "accounting", lfaMember: false, website: "https://scottsdaleaccounting.biz" },
  { name: "Tempe Digital Marketing", category: "professional_services", city: "Tempe", type: "marketing", lfaMember: true, website: "https://tempedigital.agency" },
  { name: "Mesa Consulting Group", category: "professional_services", city: "Mesa", type: "consulting", lfaMember: false, website: "https://mesaconsulting.pro" },
  { name: "Chandler Architecture Studio", category: "professional_services", city: "Chandler", type: "architecture", lfaMember: true, website: "https://chandlerarch.design" },
  { name: "Glendale Real Estate", category: "professional_services", city: "Glendale", type: "real_estate", lfaMember: false, website: "https://glendaleproperties.homes" },
  { name: "Peoria Insurance Agency", category: "professional_services", city: "Peoria", type: "insurance", lfaMember: true, website: "https://peoriainsurance.protect" },
  { name: "Gilbert Financial Planning", category: "professional_services", city: "Gilbert", type: "financial", lfaMember: false, website: "https://gilbertfinancial.money" },
  { name: "Tucson Web Design", category: "professional_services", city: "Tucson", type: "web_design", lfaMember: true, website: "https://tucsonweb.dev" },
  { name: "Flagstaff Engineering", category: "professional_services", city: "Flagstaff", type: "engineering", lfaMember: false, website: "https://flagstaffeng.tech" },
  { name: "Sedona Photography", category: "professional_services", city: "Sedona", type: "photography", lfaMember: true, website: "https://sedonaphotos.art" },
  { name: "Queen Creek Tax Services", category: "professional_services", city: "Queen Creek", type: "tax", lfaMember: false, website: "https://queencreektax.irs" },
  { name: "Sun City Legal Aid", category: "professional_services", city: "Sun City", type: "legal_aid", lfaMember: true, website: "https://suncitylegal.help" },
  { name: "Paradise Valley Investment", category: "professional_services", city: "Paradise Valley", type: "investment", lfaMember: false, website: "https://pvinvestment.wealth" },
  { name: "Avondale HR Solutions", category: "professional_services", city: "Avondale", type: "hr", lfaMember: true, website: "https://avondalehr.people" },
  { name: "Carefree Business Coach", category: "professional_services", city: "Carefree", type: "coaching", lfaMember: false, website: "https://carefreecoach.success" },
  { name: "Fountain Hills PR Agency", category: "professional_services", city: "Fountain Hills", type: "pr", lfaMember: true, website: "https://fhpr.media" },
  { name: "Cave Creek Patent Law", category: "professional_services", city: "Cave Creek", type: "patent", lfaMember: false, website: "https://cavecreekpatents.ip" },
  { name: "Ahwatukee Graphic Design", category: "professional_services", city: "Ahwatukee", type: "design", lfaMember: true, website: "https://ahwatukeegraphics.visual" },
  { name: "Surprise IT Support", category: "professional_services", city: "Surprise", type: "it", lfaMember: false, website: "https://surpriseit.tech" },

  // Health & Wellness (15 businesses)
  { name: "Phoenix Medical Center", category: "health_wellness", city: "Phoenix", type: "medical", lfaMember: true, website: "https://phoenixmedical.health" },
  { name: "Scottsdale Dental Practice", category: "health_wellness", city: "Scottsdale", type: "dental", lfaMember: false, website: "https://scottsdaledental.smile" },
  { name: "Tempe Fitness Gym", category: "health_wellness", city: "Tempe", type: "fitness", lfaMember: true, website: "https://tempefitness.strong" },
  { name: "Mesa Physical Therapy", category: "health_wellness", city: "Mesa", type: "therapy", lfaMember: false, website: "https://mesapt.rehab" },
  { name: "Chandler Chiropractor", category: "health_wellness", city: "Chandler", type: "chiropractic", lfaMember: true, website: "https://chandlerchiro.spine" },
  { name: "Glendale Wellness Spa", category: "health_wellness", city: "Glendale", type: "spa", lfaMember: false, website: "https://glendalewellness.relax" },
  { name: "Peoria Mental Health", category: "health_wellness", city: "Peoria", type: "mental_health", lfaMember: true, website: "https://peoriamentalhealth.mind" },
  { name: "Gilbert Nutrition Center", category: "health_wellness", city: "Gilbert", type: "nutrition", lfaMember: false, website: "https://gilbertnutrition.healthy" },
  { name: "Tucson Yoga Studio", category: "health_wellness", city: "Tucson", type: "yoga", lfaMember: true, website: "https://tucsonyoga.om" },
  { name: "Flagstaff Urgent Care", category: "health_wellness", city: "Flagstaff", type: "urgent_care", lfaMember: false, website: "https://flagstaffurgent.now" },
  { name: "Sedona Holistic Health", category: "health_wellness", city: "Sedona", type: "holistic", lfaMember: true, website: "https://sedonaholistic.heal" },
  { name: "Queen Creek Pediatrics", category: "health_wellness", city: "Queen Creek", type: "pediatrics", lfaMember: false, website: "https://queencreekpeds.kids" },
  { name: "Sun City Senior Care", category: "health_wellness", city: "Sun City", type: "senior_care", lfaMember: true, website: "https://suncityseniors.care" },
  { name: "Paradise Valley Dermatology", category: "health_wellness", city: "Paradise Valley", type: "dermatology", lfaMember: false, website: "https://pvdermatology.skin" },
  { name: "Avondale Vision Center", category: "health_wellness", city: "Avondale", type: "vision", lfaMember: true, website: "https://avondalevision.see" },

  // Retail & Shopping (15 businesses)
  { name: "Phoenix Gift Shop", category: "retail", city: "Phoenix", type: "gifts", lfaMember: true, website: "https://phoenixgifts.shop" },
  { name: "Scottsdale Fashion Boutique", category: "retail", city: "Scottsdale", type: "fashion", lfaMember: false, website: "https://scottsdalefashion.style" },
  { name: "Tempe Book Store", category: "retail", city: "Tempe", type: "books", lfaMember: true, website: "https://tempebooks.read" },
  { name: "Mesa Outdoor Gear", category: "retail", city: "Mesa", type: "outdoor", lfaMember: false, website: "https://mesaoutdoor.adventure" },
  { name: "Chandler Electronics", category: "retail", city: "Chandler", type: "electronics", lfaMember: true, website: "https://chandlerelectronics.tech" },
  { name: "Glendale Furniture Store", category: "retail", city: "Glendale", type: "furniture", lfaMember: false, website: "https://glendalefurniture.home" },
  { name: "Peoria Pet Supplies", category: "retail", city: "Peoria", type: "pets", lfaMember: true, website: "https://peoriapets.woof" },
  { name: "Gilbert Garden Center", category: "retail", city: "Gilbert", type: "garden", lfaMember: false, website: "https://gilbertgarden.grow" },
  { name: "Tucson Antique Mall", category: "retail", city: "Tucson", type: "antiques", lfaMember: true, website: "https://tucsonantiques.vintage" },
  { name: "Flagstaff Outdoor Store", category: "retail", city: "Flagstaff", type: "outdoor", lfaMember: false, website: "https://flagstaffoutdoor.mountain" },
  { name: "Sedona Crystal Shop", category: "retail", city: "Sedona", type: "crystals", lfaMember: true, website: "https://sedonacrystals.energy" },
  { name: "Queen Creek Craft Store", category: "retail", city: "Queen Creek", type: "crafts", lfaMember: false, website: "https://queencreekcrafts.make" },
  { name: "Sun City Pharmacy", category: "retail", city: "Sun City", type: "pharmacy", lfaMember: true, website: "https://suncitypharmacy.rx" },
  { name: "Paradise Valley Jewelry", category: "retail", city: "Paradise Valley", type: "jewelry", lfaMember: false, website: "https://pvjewelry.sparkle" },
  { name: "Avondale Thrift Store", category: "retail", city: "Avondale", type: "thrift", lfaMember: true, website: "https://avondalethrift.secondhand" },

  // Home Services (15 businesses)
  { name: "Phoenix Plumbing Pro", category: "home_services", city: "Phoenix", type: "plumbing", lfaMember: true, website: "https://phoenixplumbing.fix" },
  { name: "Scottsdale HVAC Expert", category: "home_services", city: "Scottsdale", type: "hvac", lfaMember: false, website: "https://scottsdalehvac.cool" },
  { name: "Tempe Electrical Services", category: "home_services", city: "Tempe", type: "electrical", lfaMember: true, website: "https://tempeelectric.power" },
  { name: "Mesa Landscaping", category: "home_services", city: "Mesa", type: "landscaping", lfaMember: false, website: "https://mesalandscape.green" },
  { name: "Chandler House Cleaning", category: "home_services", city: "Chandler", type: "cleaning", lfaMember: true, website: "https://chandlercleaning.spotless" },
  { name: "Glendale Roofing", category: "home_services", city: "Glendale", type: "roofing", lfaMember: false, website: "https://glendaleroof.protect" },
  { name: "Peoria Painting", category: "home_services", city: "Peoria", type: "painting", lfaMember: true, website: "https://peoriapainting.color" },
  { name: "Gilbert Pest Control", category: "home_services", city: "Gilbert", type: "pest", lfaMember: false, website: "https://gilbertpest.bug" },
  { name: "Tucson Pool Service", category: "home_services", city: "Tucson", type: "pool", lfaMember: true, website: "https://tucsonpool.swim" },
  { name: "Flagstaff Handyman", category: "home_services", city: "Flagstaff", type: "handyman", lfaMember: false, website: "https://flagstaffhandyman.fixit" },
  { name: "Sedona Window Washing", category: "home_services", city: "Sedona", type: "windows", lfaMember: true, website: "https://sedonawindows.clear" },
  { name: "Queen Creek Tree Service", category: "home_services", city: "Queen Creek", type: "tree", lfaMember: false, website: "https://queencreektrees.trim" },
  { name: "Sun City Security Systems", category: "home_services", city: "Sun City", type: "security", lfaMember: true, website: "https://suncitysecurity.safe" },
  { name: "Paradise Valley Solar", category: "home_services", city: "Paradise Valley", type: "solar", lfaMember: false, website: "https://pvsolar.energy" },
  { name: "Avondale Construction", category: "home_services", city: "Avondale", type: "construction", lfaMember: true, website: "https://avondaleconstruction.build" },

  // Automotive (10 businesses)
  { name: "Phoenix Auto Repair", category: "automotive", city: "Phoenix", type: "repair", lfaMember: true, website: "https://phoenixauto.repair" },
  { name: "Scottsdale BMW Service", category: "automotive", city: "Scottsdale", type: "luxury", lfaMember: false, website: "https://scottsdalebmw.luxury" },
  { name: "Tempe Quick Lube", category: "automotive", city: "Tempe", type: "quicklube", lfaMember: true, website: "https://tempequicklube.fast" },
  { name: "Mesa Tire Shop", category: "automotive", city: "Mesa", type: "tires", lfaMember: false, website: "https://mesatires.roll" },
  { name: "Chandler Car Wash", category: "automotive", city: "Chandler", type: "carwash", lfaMember: true, website: "https://chandlercarwash.clean" },
  { name: "Glendale Auto Body", category: "automotive", city: "Glendale", type: "bodyshop", lfaMember: false, website: "https://glendaleautobody.restore" },
  { name: "Peoria Transmission", category: "automotive", city: "Peoria", type: "transmission", lfaMember: true, website: "https://peoriatransmission.shift" },
  { name: "Gilbert Muffler Shop", category: "automotive", city: "Gilbert", type: "muffler", lfaMember: false, website: "https://gilbertmuffler.quiet" },
  { name: "Tucson Classic Cars", category: "automotive", city: "Tucson", type: "classic", lfaMember: true, website: "https://tucsonclassics.vintage" },
  { name: "Flagstaff 4x4 Service", category: "automotive", city: "Flagstaff", type: "4x4", lfaMember: false, website: "https://flagstaff4x4.offroad" },

  // Other Categories (5 businesses with potential classification challenges)
  { name: "Unique Arizona Business", category: "other", city: "Phoenix", type: "unusual", lfaMember: true, website: "https://uniqueaz.weird" },
  { name: "Multi-Service Company", category: "other", city: "Tucson", type: "multi", lfaMember: false, website: "https://multiservice.everything" },
  { name: "Innovation Hub", category: "other", city: "Tempe", type: "innovation", lfaMember: true, website: "https://innovationhub.future" },
  { name: "Community Center", category: "other", city: "Mesa", type: "community", lfaMember: false, website: "https://communitycenter.together" },
  { name: "Startup Incubator", category: "other", city: "Scottsdale", type: "startup", lfaMember: true, website: "https://startupincubator.launch" }
];

// Arizona cities with coordinates for realistic addresses
const ARIZONA_CITIES = {
  'Phoenix': { lat: 33.4484, lng: -112.0740, zip: '85001' },
  'Scottsdale': { lat: 33.4942, lng: -111.9261, zip: '85251' },
  'Tempe': { lat: 33.4255, lng: -111.9400, zip: '85281' },
  'Mesa': { lat: 33.4152, lng: -111.8315, zip: '85201' },
  'Chandler': { lat: 33.3062, lng: -111.8413, zip: '85224' },
  'Glendale': { lat: 33.5387, lng: -112.1860, zip: '85301' },
  'Peoria': { lat: 33.5806, lng: -112.2374, zip: '85345' },
  'Gilbert': { lat: 33.3528, lng: -111.7890, zip: '85234' },
  'Tucson': { lat: 32.2226, lng: -110.9747, zip: '85701' },
  'Flagstaff': { lat: 35.1983, lng: -111.6513, zip: '86001' },
  'Sedona': { lat: 34.8697, lng: -111.7610, zip: '86336' },
  'Queen Creek': { lat: 33.2487, lng: -111.6343, zip: '85142' },
  'Sun City': { lat: 33.5975, lng: -112.2716, zip: '85351' },
  'Paradise Valley': { lat: 33.5531, lng: -111.9474, zip: '85253' },
  'Avondale': { lat: 33.4356, lng: -112.3496, zip: '85323' },
  'Carefree': { lat: 33.8247, lng: -111.9171, zip: '85377' },
  'Fountain Hills': { lat: 33.6119, lng: -111.7196, zip: '85268' },
  'Cave Creek': { lat: 33.8339, lng: -111.9543, zip: '85327' },
  'Ahwatukee': { lat: 33.3498, lng: -112.0298, zip: '85044' },
  'Surprise': { lat: 33.6292, lng: -112.3679, zip: '85374' }
};

// Phone number generation
function generatePhoneNumber(city) {
  const areaCodes = {
    'Phoenix': '602', 'Scottsdale': '480', 'Tempe': '480', 'Mesa': '480',
    'Chandler': '480', 'Glendale': '623', 'Peoria': '623', 'Gilbert': '480',
    'Tucson': '520', 'Flagstaff': '928', 'Sedona': '928', 'Queen Creek': '480',
    'Sun City': '623', 'Paradise Valley': '480', 'Avondale': '623',
    'Carefree': '480', 'Fountain Hills': '480', 'Cave Creek': '480',
    'Ahwatukee': '480', 'Surprise': '623'
  };
  
  const areaCode = areaCodes[city] || '602';
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  
  return `(${areaCode}) ${exchange}-${number}`;
}

// Address generation
function generateAddress(city) {
  const streetNumbers = [Math.floor(Math.random() * 9999) + 1];
  const streetNames = [
    'Main St', 'First Ave', 'Central Ave', 'Mill Ave', 'University Dr',
    'Camelback Rd', 'Indian School Rd', 'Thomas Rd', 'McDowell Rd',
    'Van Buren St', 'Washington St', 'Jefferson St', 'Adams St',
    'Roosevelt St', 'Broadway Rd', 'Southern Ave', 'Baseline Rd',
    'Ray Rd', 'Chandler Blvd', 'Warner Rd', 'Elliott Rd', 'Guadalupe Rd'
  ];
  
  const streetNumber = Math.floor(Math.random() * 9999) + 1;
  const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
  const cityData = ARIZONA_CITIES[city];
  
  return `${streetNumber} ${streetName}, ${city}, AZ ${cityData.zip}`;
}

class TestDatasetCreator {
  constructor() {
    this.db = null;
    this.stats = {
      created: 0,
      skipped: 0,
      errors: 0
    };
  }

  async initialize() {
    console.log('🚀 Initializing Test Dataset Creator...');
    
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    this.db = drizzle(client, { schema: { businesses } });
    console.log('✅ Database connection established');
  }

  async clearExistingTestData() {
    console.log('🧹 Clearing existing test businesses...');
    
    // Clear any existing test data (businesses with test websites)
    const testBusinesses = await this.db
      .select()
      .from(businesses)
      .where();
    
    console.log(`Found ${testBusinesses.length} existing businesses in database`);
  }

  async createTestBusinesses() {
    console.log(`\n📊 Creating ${TEST_BUSINESSES.length} test businesses...`);
    
    const expectedOutcomes = [];
    
    for (const businessData of TEST_BUSINESSES) {
      try {
        const cityData = ARIZONA_CITIES[businessData.city];
        if (!cityData) {
          console.error(`❌ Unknown city: ${businessData.city}`);
          this.stats.errors++;
          continue;
        }

        const business = {
          id: uuidv4(),
          name: businessData.name,
          address: generateAddress(businessData.city),
          latitude: cityData.lat + (Math.random() - 0.5) * 0.01, // Small random offset
          longitude: cityData.lng + (Math.random() - 0.5) * 0.01,
          phone: generatePhoneNumber(businessData.city),
          website: businessData.website,
          category: businessData.category,
          lfaMember: businessData.lfaMember,
          memberSince: businessData.lfaMember ? '2024-01-01' : null,
          verified: businessData.lfaMember,
          status: 'active',
          enrichmentStatus: 'pending', // Reset for testing
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Insert into database
        await this.db.insert(businesses).values(business);
        
        // Track expected outcome for validation
        expectedOutcomes.push({
          id: business.id,
          name: business.name,
          website: business.website,
          currentCategory: business.category,
          expectedPrimaryCategory: this.getExpectedCategory(businessData),
          city: businessData.city,
          businessType: businessData.type,
          lfaMember: businessData.lfaMember,
          complexity: this.getComplexityLevel(businessData),
          testingNotes: this.getTestingNotes(businessData)
        });
        
        this.stats.created++;
        console.log(`✅ Created: ${business.name} (${businessData.city})`);
        
      } catch (error) {
        console.error(`❌ Failed to create ${businessData.name}: ${error.message}`);
        this.stats.errors++;
      }
    }

    // Save expected outcomes for validation
    await this.saveExpectedOutcomes(expectedOutcomes);
    
    return expectedOutcomes;
  }

  getExpectedCategory(businessData) {
    const categoryMapping = {
      'restaurant': 'food_dining',
      'professional_services': 'professional_services', 
      'health_wellness': 'health_wellness',
      'retail': 'retail_shopping',
      'home_services': 'home_services',
      'automotive': 'automotive',
      'other': 'other'
    };
    
    return categoryMapping[businessData.category] || 'other';
  }

  getComplexityLevel(businessData) {
    const complexityFactors = {
      simple: 1,
      complex: 3,
      mobile: 2,
      upscale: 2,
      unusual: 4,
      multi: 4,
      innovation: 3
    };
    
    return complexityFactors[businessData.type] || 2;
  }

  getTestingNotes(businessData) {
    const notes = [];
    
    if (businessData.type === 'mobile' || businessData.type === 'food_truck') {
      notes.push('Mobile business - may have limited website content');
    }
    
    if (businessData.type === 'unusual' || businessData.type === 'multi') {
      notes.push('Complex business model - test edge case classification');
    }
    
    if (businessData.type === 'luxury' || businessData.type === 'upscale') {
      notes.push('High-end business - expect sophisticated website');
    }
    
    if (businessData.website.includes('slow') || businessData.website.includes('broken')) {
      notes.push('Problematic website for error handling testing');
    }
    
    if (businessData.lfaMember) {
      notes.push('LFA Member - test Firecrawl method');
    } else {
      notes.push('Non-LFA - test Playwright method');
    }
    
    return notes.join('; ');
  }

  async saveExpectedOutcomes(outcomes) {
    try {
      const csvContent = this.generateCSV(outcomes);
      await fs.writeFile('./test-dataset-expected-outcomes.csv', csvContent);
      
      const jsonContent = JSON.stringify({
        metadata: {
          createdAt: new Date().toISOString(),
          totalBusinesses: outcomes.length,
          categoryBreakdown: this.getCategoryBreakdown(outcomes),
          complexityBreakdown: this.getComplexityBreakdown(outcomes),
          locationBreakdown: this.getLocationBreakdown(outcomes),
          lfaBreakdown: this.getLFABreakdown(outcomes)
        },
        expectedOutcomes: outcomes
      }, null, 2);
      
      await fs.writeFile('./test-dataset-expected-outcomes.json', jsonContent);
      
      console.log('📄 Expected outcomes saved to CSV and JSON files');
      
    } catch (error) {
      console.error('⚠️  Failed to save expected outcomes:', error.message);
    }
  }

  generateCSV(outcomes) {
    const headers = [
      'id', 'name', 'website', 'currentCategory', 'expectedPrimaryCategory',
      'city', 'businessType', 'lfaMember', 'complexity', 'testingNotes'
    ];
    
    const csvRows = [headers.join(',')];
    
    outcomes.forEach(outcome => {
      const row = headers.map(header => {
        let value = outcome[header];
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      });
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  getCategoryBreakdown(outcomes) {
    const breakdown = {};
    outcomes.forEach(outcome => {
      const category = outcome.expectedPrimaryCategory;
      breakdown[category] = (breakdown[category] || 0) + 1;
    });
    return breakdown;
  }

  getComplexityBreakdown(outcomes) {
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0 };
    outcomes.forEach(outcome => {
      breakdown[outcome.complexity]++;
    });
    return breakdown;
  }

  getLocationBreakdown(outcomes) {
    const breakdown = {};
    outcomes.forEach(outcome => {
      const city = outcome.city;
      breakdown[city] = (breakdown[city] || 0) + 1;
    });
    return breakdown;
  }

  getLFABreakdown(outcomes) {
    const lfa = outcomes.filter(o => o.lfaMember).length;
    const nonLfa = outcomes.filter(o => !o.lfaMember).length;
    return { lfa, nonLfa };
  }

  generateSummaryReport(outcomes) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST DATASET CREATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`✅ Successfully Created: ${this.stats.created} businesses`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    console.log(`📋 Total Test Businesses: ${outcomes.length}`);
    
    console.log('\n📈 Category Distribution:');
    const categoryBreakdown = this.getCategoryBreakdown(outcomes);
    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} businesses`);
    });
    
    console.log('\n🏢 LFA Membership Distribution:');
    const lfaBreakdown = this.getLFABreakdown(outcomes);
    console.log(`   LFA Members: ${lfaBreakdown.lfa} (Firecrawl testing)`);
    console.log(`   Non-LFA: ${lfaBreakdown.nonLfa} (Playwright testing)`);
    
    console.log('\n🌵 Geographic Distribution:');
    const locationBreakdown = this.getLocationBreakdown(outcomes);
    Object.entries(locationBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([city, count]) => {
        console.log(`   ${city}: ${count} businesses`);
      });
    
    console.log('\n⚡ Complexity Distribution:');
    const complexityBreakdown = this.getComplexityBreakdown(outcomes);
    console.log(`   Simple (1): ${complexityBreakdown[1]} businesses`);
    console.log(`   Medium (2): ${complexityBreakdown[2]} businesses`);
    console.log(`   Complex (3): ${complexityBreakdown[3]} businesses`);
    console.log(`   Very Complex (4): ${complexityBreakdown[4]} businesses`);
    
    console.log('\n📁 Output Files:');
    console.log('   • test-dataset-expected-outcomes.csv');
    console.log('   • test-dataset-expected-outcomes.json');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Run comprehensive-test-suite.js to test the pipeline');
    console.log('   2. Review test-enrichment-results.json for validation');
    console.log('   3. Compare actual vs expected outcomes');
    console.log('   4. Generate quality assessment report');
    
    console.log('='.repeat(60));
  }

  async run() {
    try {
      await this.initialize();
      await this.clearExistingTestData();
      const outcomes = await this.createTestBusinesses();
      this.generateSummaryReport(outcomes);
      
      console.log('\n✨ Test dataset creation completed successfully!');
      return outcomes;
      
    } catch (error) {
      console.error('💥 Test dataset creation failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const creator = new TestDatasetCreator();
  creator.run();
}

export { TestDatasetCreator, TEST_BUSINESSES };