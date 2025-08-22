import { test, expect } from '@playwright/test';

test.describe('Real-time Debugging Dashboard', () => {
  test('Continuous app monitoring and debugging', async ({ page }) => {
    console.log('🚀 Starting Real-time Debugging Dashboard...');
    console.log('📍 App URL: http://localhost:3000');
    console.log('⏰ Starting continuous monitoring...\n');

    let sessionLogs = [];
    let errorCount = 0;
    let warningCount = 0;
    let networkIssues = 0;

    // Enhanced logging with real-time display
    page.on('console', msg => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = {
        time: timestamp,
        type: msg.type(),
        text: msg.text(),
        raw: msg
      };
      
      sessionLogs.push(logEntry);
      
      // Real-time console output with colors and formatting
      const typeEmoji = {
        'error': '🚨',
        'warn': '⚠️ ',
        'info': 'ℹ️ ',
        'log': '📝',
        'debug': '🔍'
      };
      
      const emoji = typeEmoji[msg.type()] || '📄';
      
      if (msg.type() === 'error') {
        errorCount++;
        console.log(`${emoji} [${timestamp}] ERROR: ${msg.text()}`);
      } else if (msg.type() === 'warn') {
        warningCount++;
        console.log(`${emoji} [${timestamp}] WARN: ${msg.text()}`);
      } else if (msg.type() === 'info' || msg.type() === 'log') {
        console.log(`${emoji} [${timestamp}] ${msg.text()}`);
      }
    });

    // Network monitoring
    page.on('response', response => {
      const timestamp = new Date().toLocaleTimeString();
      
      if (!response.ok()) {
        networkIssues++;
        console.log(`🌐 [${timestamp}] Network Error: ${response.status()} ${response.url()}`);
      } else if (response.url().includes('localhost:3000')) {
        console.log(`✅ [${timestamp}] Success: ${response.status()} ${response.url()}`);
      }
    });

    // JavaScript error monitoring
    page.on('pageerror', error => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`💥 [${timestamp}] JavaScript Error: ${error.message}`);
      if (error.stack) {
        console.log(`📚 Stack trace: ${error.stack.substring(0, 200)}...`);
      }
      errorCount++;
    });

    // Load the application
    console.log('🔄 Loading application...');
    await page.goto('http://localhost:3000');
    
    // Wait for initial load
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ DOM loaded');
    
    await page.waitForLoadState('networkidle');
    console.log('✅ Network idle');

    // Continuous monitoring loop
    const monitoringDuration = 60000; // 60 seconds
    const checkInterval = 5000; // Check every 5 seconds
    const iterations = monitoringDuration / checkInterval;

    for (let i = 0; i < iterations; i++) {
      const timestamp = new Date().toLocaleTimeString();
      
      console.log(`\n📊 [${timestamp}] Monitoring Check ${i + 1}/${iterations}`);
      console.log(`   📝 Total Logs: ${sessionLogs.length}`);
      console.log(`   🚨 Errors: ${errorCount}`);
      console.log(`   ⚠️  Warnings: ${warningCount}`);
      console.log(`   🌐 Network Issues: ${networkIssues}`);

      // Check app health by verifying key elements
      try {
        const title = page.locator('text=Local First Arizona').first();
        const isVisible = await title.isVisible();
        console.log(`   🏠 App Title Visible: ${isVisible ? '✅' : '❌'}`);

        const searchInput = page.locator('input[placeholder*="Search"]').first();
        const searchVisible = await searchInput.isVisible();
        console.log(`   🔍 Search Input Visible: ${searchVisible ? '✅' : '❌'}`);

        // Test search functionality
        if (searchVisible && i % 3 === 0) { // Test every 3rd iteration
          console.log(`   🧪 Running search functionality test...`);
          await searchInput.fill(`test query ${i}`);
          
          const searchButton = page.locator('button:has([name="search"])').first();
          if (await searchButton.isVisible()) {
            await searchButton.click();
            await page.waitForTimeout(1000);
            console.log(`   ✅ Search test completed`);
          }
        }

        // Check voice button status
        const voiceButton = page.locator('button:has([name="mic"])').first();
        if (await voiceButton.isVisible()) {
          const isDisabled = await voiceButton.isDisabled();
          console.log(`   🎤 Voice Button: ${isDisabled ? 'Disabled (Web)' : 'Enabled'}`);
        }

        // Location status check
        const locationLogs = sessionLogs.filter(log => 
          log.text.toLowerCase().includes('location')
        ).slice(-3); // Last 3 location logs
        
        if (locationLogs.length > 0) {
          console.log(`   📍 Recent Location Activity: ${locationLogs.length} logs`);
        }

      } catch (error) {
        console.log(`   ❌ Health check failed: ${error.message}`);
      }

      // Show recent important logs
      const recentErrors = sessionLogs.filter(log => 
        log.type === 'error' && 
        (Date.now() - new Date(`1970-01-01T${log.time}`).getTime()) < checkInterval + 1000
      );

      if (recentErrors.length > 0) {
        console.log(`   🔥 Recent Errors:`);
        recentErrors.forEach(log => {
          console.log(`      - ${log.text}`);
        });
      }

      // Wait for next check
      await page.waitForTimeout(checkInterval);
    }

    // Final summary
    console.log('\n🏁 Monitoring Session Complete');
    console.log('=====================================');
    console.log(`📊 Final Statistics:`);
    console.log(`   📝 Total Console Logs: ${sessionLogs.length}`);
    console.log(`   🚨 Total Errors: ${errorCount}`);
    console.log(`   ⚠️  Total Warnings: ${warningCount}`);
    console.log(`   🌐 Network Issues: ${networkIssues}`);

    // Show error summary if any
    if (errorCount > 0) {
      console.log(`\n🔥 Error Summary:`);
      const errors = sessionLogs.filter(log => log.type === 'error');
      const uniqueErrors = [...new Set(errors.map(log => log.text))];
      uniqueErrors.forEach((error, index) => {
        const count = errors.filter(log => log.text === error).length;
        console.log(`   ${index + 1}. ${error} (${count}x)`);
      });
    }

    // Show performance metrics
    const performanceLogs = sessionLogs.filter(log => 
      log.text.toLowerCase().includes('performance') ||
      log.text.toLowerCase().includes('slow') ||
      log.text.toLowerCase().includes('timeout')
    );
    
    if (performanceLogs.length > 0) {
      console.log(`\n⚡ Performance Issues Found: ${performanceLogs.length}`);
      performanceLogs.forEach(log => {
        console.log(`   - [${log.time}] ${log.text}`);
      });
    }

    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/debug-session-final.png',
      fullPage: true 
    });

    console.log('\n✅ Debug session complete. Screenshots saved to test-results/');
    
    // Assert overall health
    expect(errorCount).toBeLessThan(10); // Should not have excessive errors
  });

  test('Feature-specific debugging', async ({ page }) => {
    console.log('🎯 Starting Feature-specific Debugging...\n');

    const features = [
      { name: 'Voice Search', selector: 'button:has([name="mic"])', testAction: 'click' },
      { name: 'Text Search', selector: 'input[placeholder*="Search"]', testAction: 'type' },
      { name: 'Location Services', selector: 'text*="location"', testAction: 'click' },
      { name: 'Navigation', selector: '[role="tab"], [role="tablist"]', testAction: 'observe' }
    ];

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    for (const feature of features) {
      console.log(`\n🔍 Testing Feature: ${feature.name}`);
      console.log('================================');

      try {
        const element = page.locator(feature.selector).first();
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();

        console.log(`   👁️  Visible: ${isVisible ? '✅' : '❌'}`);
        console.log(`   🎛️  Enabled: ${isEnabled ? '✅' : '❌'}`);

        if (isVisible) {
          switch (feature.testAction) {
            case 'click':
              if (isEnabled) {
                await element.click();
                console.log(`   🖱️  Click Action: ✅ Executed`);
                await page.waitForTimeout(1000);
              } else {
                console.log(`   🖱️  Click Action: ⚠️  Element disabled`);
              }
              break;
            
            case 'type':
              await element.fill('debug test');
              console.log(`   ⌨️  Type Action: ✅ Text entered`);
              await page.waitForTimeout(500);
              break;
            
            case 'observe':
              const count = await element.count();
              console.log(`   👀 Observe Action: ✅ Found ${count} elements`);
              break;
          }
        }

        // Take feature-specific screenshot
        await page.screenshot({ 
          path: `test-results/feature-${feature.name.toLowerCase().replace(/\s+/g, '-')}.png`
        });

      } catch (error) {
        console.log(`   ❌ Feature test failed: ${error.message}`);
      }
    }

    console.log('\n✅ Feature-specific debugging complete');
  });
});