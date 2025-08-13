#!/usr/bin/env node

/**
 * Test script for Local First Arizona Chrome Extension
 * Validates the extension structure and key functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ExtensionTester {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = 0;
    this.total = 0;
  }

  test(description, condition) {
    this.total++;
    if (condition) {
      console.log(`✅ ${description}`);
      this.passed++;
    } else {
      console.log(`❌ ${description}`);
      this.errors.push(description);
    }
  }

  warn(description, condition) {
    if (!condition) {
      console.log(`⚠️  ${description}`);
      this.warnings.push(description);
    }
  }

  fileExists(filePath) {
    return fs.existsSync(path.join(__dirname, filePath));
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    } catch {
      return null;
    }
  }

  runTests() {
    console.log('Testing Local First Arizona Chrome Extension...');
    console.log('==============================================');

    // Test file structure
    this.testFileStructure();
    
    // Test manifest.json
    this.testManifest();
    
    // Test source files
    this.testSourceFiles();
    
    // Show results
    this.showResults();
  }

  testFileStructure() {
    console.log('\n📁 Testing File Structure...');
    
    this.test(
      'Extension package.json exists',
      this.fileExists('package.json')
    );
    
    this.test(
      'Manifest.json exists',
      this.fileExists('public/manifest.json')
    );
    
    this.test(
      'Background service worker exists',
      this.fileExists('src/background/service-worker.js')
    );
    
    this.test(
      'Shared constants exist',
      this.fileExists('src/shared/constants.js')
    );
    
    this.test(
      'API client exists',
      this.fileExists('src/shared/api-client.js')
    );
    
    this.test(
      'Analytics module exists',
      this.fileExists('src/shared/analytics.js')
    );
    
    this.test(
      'Storage utilities exist',
      this.fileExists('src/shared/storage.js')
    );
    
    // Check directories exist
    this.test(
      'Assets directory exists',
      this.fileExists('src/assets')
    );
    
    this.test(
      'Content scripts directory exists',
      this.fileExists('src/content-scripts')
    );
    
    this.test(
      'Popup directory exists',
      this.fileExists('src/popup')
    );
  }

  testManifest() {
    console.log('\n📋 Testing Manifest...');
    
    const manifestContent = this.readFile('public/manifest.json');
    
    this.test(
      'Manifest is valid JSON',
      (() => {
        try {
          JSON.parse(manifestContent);
          return true;
        } catch {
          return false;
        }
      })()
    );
    
    if (manifestContent) {
      try {
        const manifest = JSON.parse(manifestContent);
        
        this.test(
          'Manifest version is 3',
          manifest.manifest_version === 3
        );
        
        this.test(
          'Extension name is set',
          manifest.name === 'Local First Arizona'
        );
        
        this.test(
          'Background service worker is configured',
          manifest.background && manifest.background.service_worker
        );
        
        this.test(
          'Required permissions are set',
          manifest.permissions && 
          manifest.permissions.includes('storage') &&
          manifest.permissions.includes('activeTab')
        );
        
        this.test(
          'Host permissions include Google Maps',
          manifest.host_permissions && 
          manifest.host_permissions.some(perm => perm.includes('maps.google.com'))
        );
        
        this.test(
          'Content scripts are configured',
          manifest.content_scripts && manifest.content_scripts.length > 0
        );
        
      } catch (error) {
        this.errors.push('Failed to parse manifest.json');
      }
    }
  }

  testSourceFiles() {
    console.log('\n🔧 Testing Source Files...');
    
    // Test constants
    const constants = this.readFile('src/shared/constants.js');
    this.test(
      'Constants file contains CONFIG export',
      constants && constants.includes('export const CONFIG')
    );
    
    this.test(
      'Constants file contains API_BASE_URL',
      constants && constants.includes('API_BASE_URL')
    );
    
    // Test API client
    const apiClient = this.readFile('src/shared/api-client.js');
    this.test(
      'API client exports ApiClient class',
      apiClient && apiClient.includes('export class ApiClient')
    );
    
    this.test(
      'API client has getNearbyBusinesses method',
      apiClient && apiClient.includes('getNearbyBusinesses')
    );
    
    this.test(
      'API client has getChainPatterns method',
      apiClient && apiClient.includes('getChainPatterns')
    );
    
    // Test analytics
    const analytics = this.readFile('src/shared/analytics.js');
    this.test(
      'Analytics exports Analytics class',
      analytics && analytics.includes('export class Analytics')
    );
    
    this.test(
      'Analytics has track method',
      analytics && analytics.includes('track(')
    );
    
    // Test service worker
    const serviceWorker = this.readFile('src/background/service-worker.js');
    this.test(
      'Service worker contains ServiceWorker class',
      serviceWorker && serviceWorker.includes('class ServiceWorker')
    );
    
    this.test(
      'Service worker sets up event listeners',
      serviceWorker && serviceWorker.includes('setupEventListeners')
    );
    
    this.test(
      'Service worker handles data sync',
      serviceWorker && serviceWorker.includes('syncData')
    );
    
    // Test storage utilities
    const storage = this.readFile('src/shared/storage.js');
    this.test(
      'Storage exports Storage class',
      storage && storage.includes('export class Storage')
    );
    
    this.test(
      'Storage has getSettings method',
      storage && storage.includes('getSettings')
    );
    
    // Test business matcher
    const businessMatcher = this.readFile('src/shared/business-matcher.js');
    this.test(
      'Business matcher exports BusinessMatcher class',
      businessMatcher && businessMatcher.includes('export class BusinessMatcher')
    );
    
    this.test(
      'Business matcher has isChainBusiness method',
      businessMatcher && businessMatcher.includes('isChainBusiness')
    );
    
    this.test(
      'Business matcher has findLocalMatch method',
      businessMatcher && businessMatcher.includes('findLocalMatch')
    );
    
    // Test business detector
    const businessDetector = this.readFile('src/content-scripts/business-detector.js');
    this.test(
      'Business detector exports BusinessDetector class',
      businessDetector && businessDetector.includes('export class BusinessDetector')
    );
    
    this.test(
      'Business detector has scanForBusinesses method',
      businessDetector && businessDetector.includes('scanForBusinesses')
    );
    
    // Test UI injector
    const uiInjector = this.readFile('src/content-scripts/ui-injector.js');
    this.test(
      'UI injector exports UIInjector class',
      uiInjector && uiInjector.includes('export class UIInjector')
    );
    
    this.test(
      'UI injector has addLFABadge method',
      uiInjector && uiInjector.includes('addLFABadge')
    );
    
    this.test(
      'UI injector has applyChainFiltering method',
      uiInjector && uiInjector.includes('applyChainFiltering')
    );
    
    // Test maps modifier
    const mapsModifier = this.readFile('src/content-scripts/maps-modifier.js');
    this.test(
      'Maps modifier contains MapsModifier class',
      mapsModifier && mapsModifier.includes('class MapsModifier')
    );
    
    this.test(
      'Maps modifier has processCurrentPage method',
      mapsModifier && mapsModifier.includes('processCurrentPage')
    );
    
    this.test(
      'Maps modifier sets up mutation observer',
      mapsModifier && mapsModifier.includes('MutationObserver')
    );
    
    // Test CSS styles
    const cssStyles = this.readFile('src/assets/styles/content.css');
    this.test(
      'Content CSS file exists and contains LFA styles',
      cssStyles && cssStyles.includes('.lfa-badge')
    );
  }

  showResults() {
    console.log('\n📊 Test Results');
    console.log('===============');
    console.log(`✅ Passed: ${this.passed}/${this.total}`);
    
    if (this.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${this.warnings.length}`);
      this.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log(`❌ Failed: ${this.errors.length}`);
      this.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
      console.log('\n❌ Extension structure validation FAILED');
      process.exit(1);
    } else {
      console.log('\n🎉 Extension structure validation PASSED!');
      console.log('\nNext steps:');
      console.log('1. Add extension icons to src/assets/icons/');
      console.log('2. Run: npm install && npm run build');
      console.log('3. Load dist/ folder in Chrome Extensions page');
      console.log('4. Test with Google Maps');
    }
  }
}

// Run tests
const tester = new ExtensionTester();
tester.runTests();