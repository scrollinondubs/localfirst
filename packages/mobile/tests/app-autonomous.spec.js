import { test, expect } from '@playwright/test';

test.describe('Local First Arizona - Autonomous Testing Suite', () => {
  let consoleLogs = [];
  let networkErrors = [];
  let jsErrors = [];

  test.beforeEach(async ({ page }) => {
    // Clear previous test data
    consoleLogs = [];
    networkErrors = [];
    jsErrors = [];

    // Capture console logs
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      consoleLogs.push(logEntry);
      
      // Print important logs immediately
      if (['error', 'warn'].includes(msg.type())) {
        console.log(`🔍 [${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    // Capture JavaScript errors
    page.on('pageerror', error => {
      const errorEntry = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      jsErrors.push(errorEntry);
      console.log('🚨 JavaScript Error:', error.message);
    });

    // Capture network errors
    page.on('response', response => {
      if (!response.ok()) {
        const networkError = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        };
        networkErrors.push(networkError);
        console.log(`🌐 Network Error: ${response.status()} ${response.url()}`);
      }
    });

    // Navigate to the app
    await page.goto('/');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log summary after each test
    console.log('\n📊 Test Summary:');
    console.log(`Console Logs: ${consoleLogs.length}`);
    console.log(`JavaScript Errors: ${jsErrors.length}`);
    console.log(`Network Errors: ${networkErrors.length}`);
    
    if (testInfo.status !== 'passed') {
      console.log('\n🔥 Test Failed - Detailed Error Log:');
      jsErrors.forEach((error, index) => {
        console.log(`Error ${index + 1}:`, error.message);
        if (error.stack) console.log('Stack:', error.stack.substring(0, 300));
      });
    }
  });

  test('App loads and renders main components', async ({ page }) => {
    console.log('🚀 Testing app load and main components...');

    // Wait for the app to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give React time to render

    // Check if main title appears
    const title = page.locator('text=Local First Arizona').first();
    await expect(title).toBeVisible({ timeout: 10000 });
    console.log('✅ Main title visible');

    // Check subtitle
    const subtitle = page.locator('text=Discover businesses near you').first();
    await expect(subtitle).toBeVisible();
    console.log('✅ Subtitle visible');

    // Check search input
    const searchInput = page.locator('input[placeholder="Search for businesses..."]');
    await expect(searchInput).toBeVisible();
    console.log('✅ Search input visible');

    // Check voice button
    const voiceButton = page.locator('[data-testid="voice-button"], button:has-text("Push to record")').first();
    if (await voiceButton.isVisible()) {
      console.log('✅ Voice button visible');
    } else {
      console.log('⚠️  Voice button not found - may be disabled on web');
    }

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/app-loaded.png' });
  });

  test('Location services integration', async ({ page }) => {
    console.log('🗺️  Testing location services...');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for location-related elements
    const locationBar = page.locator('[role="button"]:has-text("location"), text*="location"').first();
    
    if (await locationBar.isVisible()) {
      console.log('✅ Location bar found');
      
      // Click to trigger location modal or input
      await locationBar.click();
      await page.waitForTimeout(1000);
      
      // Look for manual location input modal
      const manualLocationModal = page.locator('text*="location", text*="manual"').first();
      if (await manualLocationModal.isVisible()) {
        console.log('✅ Manual location input available');
      }
    } else {
      console.log('⚠️  Location bar not immediately visible');
    }

    // Check for any location-related console logs
    const locationLogs = consoleLogs.filter(log => 
      log.text.toLowerCase().includes('location') || 
      log.text.toLowerCase().includes('permission')
    );
    
    console.log(`📍 Location-related logs: ${locationLogs.length}`);
    locationLogs.forEach(log => {
      console.log(`  - [${log.type}] ${log.text}`);
    });
  });

  test('Search functionality', async ({ page }) => {
    console.log('🔍 Testing search functionality...');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find search input
    const searchInput = page.locator('input[placeholder="Search for businesses..."]');
    await expect(searchInput).toBeVisible();

    // Type search query
    await searchInput.fill('shoe stores');
    console.log('✅ Search query entered');

    // Find and click search button
    const searchButton = page.locator('button:has([name="search"])').first();
    await searchButton.click();
    console.log('✅ Search button clicked');

    // Wait for loading state
    await page.waitForTimeout(2000);

    // Look for loading indicator
    const loadingText = page.locator('text*="Finding businesses"').first();
    if (await loadingText.isVisible()) {
      console.log('✅ Loading state shown');
      
      // Wait for results
      await page.waitForTimeout(3000);
    }

    // Look for search results
    const results = page.locator('[data-testid="search-result"], text*="Shoe"').first();
    if (await results.isVisible()) {
      console.log('✅ Search results displayed');
    } else {
      console.log('⚠️  Search results not found - checking for mock data');
      
      // Check console for search-related activity
      const searchLogs = consoleLogs.filter(log => 
        log.text.toLowerCase().includes('search') ||
        log.text.toLowerCase().includes('result') ||
        log.text.toLowerCase().includes('business')
      );
      
      console.log(`🔍 Search-related logs: ${searchLogs.length}`);
      searchLogs.forEach(log => {
        console.log(`  - [${log.type}] ${log.text}`);
      });
    }

    await page.screenshot({ path: 'test-results/search-results.png' });
  });

  test('Voice search simulation (web compatibility)', async ({ page }) => {
    console.log('🎤 Testing voice search functionality...');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for voice button
    const voiceButton = page.locator('button:has([name="mic"])').first();
    
    if (await voiceButton.isVisible()) {
      console.log('✅ Voice button found');
      
      // Check if button is disabled (expected on web)
      const isDisabled = await voiceButton.isDisabled();
      if (isDisabled) {
        console.log('ℹ️  Voice button is disabled (expected on web platform)');
      } else {
        console.log('✅ Voice button is enabled - attempting click');
        await voiceButton.click();
        await page.waitForTimeout(1000);
        
        // Look for voice-related UI changes
        const listeningText = page.locator('text*="Listening"').first();
        if (await listeningText.isVisible()) {
          console.log('✅ Voice listening state activated');
        }
      }
    } else {
      console.log('⚠️  Voice button not found');
    }

    // Check voice-related console logs
    const voiceLogs = consoleLogs.filter(log => 
      log.text.toLowerCase().includes('voice') ||
      log.text.toLowerCase().includes('mic') ||
      log.text.toLowerCase().includes('speech')
    );
    
    console.log(`🎤 Voice-related logs: ${voiceLogs.length}`);
    voiceLogs.forEach(log => {
      console.log(`  - [${log.type}] ${log.text}`);
    });
  });

  test('Navigation and authentication flow', async ({ page }) => {
    console.log('🔐 Testing navigation and auth flow...');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for login/register screens or main app
    const loginButton = page.locator('button:has-text("Login"), text*="Login"').first();
    const registerButton = page.locator('button:has-text("Register"), text*="Register"').first();
    const mainTitle = page.locator('text=Local First Arizona').first();

    if (await mainTitle.isVisible()) {
      console.log('✅ User appears to be authenticated - main app visible');
      
      // Look for tab navigation
      const tabs = page.locator('[role="tablist"], [role="tab"]').first();
      if (await tabs.isVisible()) {
        console.log('✅ Tab navigation visible');
      }
      
    } else if (await loginButton.isVisible() || await registerButton.isVisible()) {
      console.log('ℹ️  Auth screens detected');
      
      if (await registerButton.isVisible()) {
        console.log('✅ Register button available');
      }
      
      if (await loginButton.isVisible()) {
        console.log('✅ Login button available');
      }
    } else {
      console.log('⚠️  Unable to determine app state');
    }

    // Check auth-related console logs
    const authLogs = consoleLogs.filter(log => 
      log.text.toLowerCase().includes('auth') ||
      log.text.toLowerCase().includes('login') ||
      log.text.toLowerCase().includes('register') ||
      log.text.toLowerCase().includes('firebase')
    );
    
    console.log(`🔐 Auth-related logs: ${authLogs.length}`);
    authLogs.forEach(log => {
      console.log(`  - [${log.type}] ${log.text}`);
    });
  });

  test('Responsive design and mobile simulation', async ({ page }) => {
    console.log('📱 Testing responsive design...');

    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 414, height: 896, name: 'iPhone 11' },
      { width: 1024, height: 768, name: 'iPad' }
    ];

    for (const viewport of viewports) {
      console.log(`Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      // Check if main elements are still visible
      const title = page.locator('text=Local First Arizona').first();
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      
      if (await title.isVisible()) {
        console.log(`✅ Title visible on ${viewport.name}`);
      } else {
        console.log(`⚠️  Title not visible on ${viewport.name}`);
      }
      
      if (await searchInput.isVisible()) {
        console.log(`✅ Search input visible on ${viewport.name}`);
      } else {
        console.log(`⚠️  Search input not visible on ${viewport.name}`);
      }
      
      await page.screenshot({ path: `test-results/responsive-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png` });
    }
  });

  test('Error handling and edge cases', async ({ page }) => {
    console.log('🚨 Testing error handling...');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Test empty search
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    const searchButton = page.locator('button:has([name="search"])').first();
    
    if (await searchInput.isVisible() && await searchButton.isVisible()) {
      // Clear input and search with empty query
      await searchInput.fill('');
      await searchButton.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ Empty search test completed');
    }

    // Test rapid clicks on voice button
    const voiceButton = page.locator('button:has([name="mic"])').first();
    if (await voiceButton.isVisible() && !await voiceButton.isDisabled()) {
      for (let i = 0; i < 3; i++) {
        await voiceButton.click();
        await page.waitForTimeout(200);
      }
      console.log('✅ Rapid voice button clicks test completed');
    }

    // Check if any new errors were generated
    const errorCount = jsErrors.length;
    console.log(`📊 Total JavaScript errors during test: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('🔥 JavaScript Errors Found:');
      jsErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`);
      });
    }
  });

  test('Performance and load time analysis', async ({ page }) => {
    console.log('⚡ Testing performance...');
    
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const domLoadTime = Date.now() - startTime;
    
    await page.waitForTimeout(2000);
    const totalLoadTime = Date.now() - startTime;
    
    console.log(`📊 Performance Metrics:`);
    console.log(`  - DOM Load Time: ${domLoadTime}ms`);
    console.log(`  - Total Load Time: ${totalLoadTime}ms`);
    
    // Check for performance-related console warnings
    const performanceLogs = consoleLogs.filter(log => 
      log.text.toLowerCase().includes('performance') ||
      log.text.toLowerCase().includes('slow') ||
      log.text.toLowerCase().includes('timeout')
    );
    
    console.log(`⚡ Performance-related logs: ${performanceLogs.length}`);
    performanceLogs.forEach(log => {
      console.log(`  - [${log.type}] ${log.text}`);
    });
    
    // Basic performance assertion
    expect(totalLoadTime).toBeLessThan(10000); // Should load in under 10 seconds
  });
});