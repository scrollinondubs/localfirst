import { test, expect } from '@playwright/test';

test.describe('Quick Validation - Autonomous Testing', () => {
  test('Basic app health check with real-time logging', async ({ page }) => {
    console.log('🚀 Starting Quick Validation Test...');
    console.log('📍 Target: http://localhost:3000');
    
    let allLogs = [];
    let errorLogs = [];
    
    // Capture all console activity
    page.on('console', msg => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`;
      allLogs.push(logEntry);
      
      if (msg.type() === 'error') {
        errorLogs.push(logEntry);
        console.log('🚨', logEntry);
      } else if (msg.type() === 'warn') {
        console.log('⚠️ ', logEntry);
      } else {
        console.log('📝', logEntry);
      }
    });

    // Navigate to app
    console.log('🔄 Loading application...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ DOM loaded successfully');

    // Give time for React to render
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/quick-validation-loaded.png' });
    console.log('📸 Screenshot taken: quick-validation-loaded.png');

    // Check what's actually on the page
    console.log('\n🔍 Analyzing page content...');
    
    const bodyText = await page.locator('body').textContent();
    console.log(`📄 Page contains ${bodyText?.length || 0} characters of text`);
    
    // Look for any text that might indicate the app loaded
    const hasLocalFirst = bodyText?.includes('Local First');
    const hasArizona = bodyText?.includes('Arizona');
    const hasSearch = bodyText?.includes('Search') || bodyText?.includes('search');
    
    console.log(`🏠 Contains "Local First": ${hasLocalFirst ? '✅' : '❌'}`);
    console.log(`🌵 Contains "Arizona": ${hasArizona ? '✅' : '❌'}`);
    console.log(`🔍 Contains "Search": ${hasSearch ? '✅' : '❌'}`);

    // Check for common React/Expo elements
    const reactRoot = page.locator('#root, [data-reactroot]').first();
    const isReactMounted = await reactRoot.isVisible();
    console.log(`⚛️  React app mounted: ${isReactMounted ? '✅' : '❌'}`);

    // Look for any input elements
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`📝 Found ${inputCount} input elements`);

    // Look for any buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`🎛️  Found ${buttonCount} button elements`);

    // Check for loading states or error messages
    const hasLoading = bodyText?.toLowerCase().includes('loading');
    const hasError = bodyText?.toLowerCase().includes('error');
    
    console.log(`⏳ Shows loading state: ${hasLoading ? '✅' : '❌'}`);
    console.log(`💥 Shows error messages: ${hasError ? '✅' : '❌'}`);

    // Wait a bit more and check again
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/quick-validation-after-wait.png' });
    console.log('📸 Screenshot taken: quick-validation-after-wait.png');

    // Final summary
    console.log('\n📊 Test Summary:');
    console.log(`📝 Total console logs: ${allLogs.length}`);
    console.log(`🚨 Error logs: ${errorLogs.length}`);
    
    if (errorLogs.length > 0) {
      console.log('\n🔥 Error Details:');
      errorLogs.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Show recent logs for debugging
    console.log('\n📋 Recent Console Activity:');
    allLogs.slice(-10).forEach(log => console.log(`  ${log}`));

    console.log('\n✅ Quick validation complete!');
    
    // Basic assertion - at least React should be mounted
    expect(isReactMounted).toBe(true);
  });

  test('Interactive testing - simulate user actions', async ({ page }) => {
    console.log('🎮 Starting Interactive Testing...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Try to find and interact with any clickable elements
    const clickableElements = page.locator('button, [role="button"], input, a');
    const count = await clickableElements.count();
    
    console.log(`🎯 Found ${count} potentially interactive elements`);

    for (let i = 0; i < Math.min(count, 5); i++) {
      try {
        const element = clickableElements.nth(i);
        const tagName = await element.evaluate(el => el.tagName);
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();
        
        console.log(`Element ${i + 1}: ${tagName} - Visible: ${isVisible}, Enabled: ${isEnabled}`);
        
        if (isVisible && isEnabled) {
          if (tagName === 'INPUT') {
            await element.fill('test input');
            console.log(`  ✅ Successfully typed in ${tagName}`);
          } else {
            await element.click();
            console.log(`  ✅ Successfully clicked ${tagName}`);
            await page.waitForTimeout(1000);
          }
        }
      } catch (error) {
        console.log(`  ❌ Failed to interact with element ${i + 1}: ${error.message}`);
      }
    }

    await page.screenshot({ path: 'test-results/interactive-testing.png' });
    console.log('📸 Interactive testing screenshot saved');
  });
});