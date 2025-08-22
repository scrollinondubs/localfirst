import { test, expect } from '@playwright/test';

test.describe('Simple Production Investigation', () => {
  const PRODUCTION_URL = 'https://3d25cd28.localfirst-mobile.pages.dev';

  test('Quick investigation of production issues', async ({ page }) => {
    console.log('🔍 Starting Production Investigation...');
    
    let consoleErrors = [];
    let networkRequests = [];
    let apiRequests = [];
    let failedRequests = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const error = `[ERROR] ${msg.text()}`;
        consoleErrors.push(error);
        console.log('🚨', error);
      }
    });

    // Monitor network requests
    page.on('request', request => {
      networkRequests.push({
        method: request.method(),
        url: request.url()
      });
      
      if (request.url().includes('api') || request.url().includes('auth') || request.url().includes('register')) {
        apiRequests.push(request);
        console.log('🌐 API Request:', request.method(), request.url());
      }
    });

    // Monitor failed responses
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          status: response.status(),
          url: response.url(),
          statusText: response.statusText()
        });
        console.log('❌ Failed:', response.status(), response.url());
      }
    });

    // Navigate to app
    console.log('🔄 Loading:', PRODUCTION_URL);
    await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check HTTPS status
    const isHttps = page.url().startsWith('https://');
    console.log(`🔒 HTTPS: ${isHttps ? '✅' : '❌'}`);

    // Wait for initial load
    await page.waitForTimeout(3000);

    // Check for forms and inputs
    const forms = await page.locator('form').count();
    const emailInputs = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').count();
    const passwordInputs = await page.locator('input[type="password"], input[name="password"]').count();
    const buttons = await page.locator('button').count();

    console.log(`📊 Elements found - Forms: ${forms}, Email inputs: ${emailInputs}, Password inputs: ${passwordInputs}, Buttons: ${buttons}`);

    // Try to find registration form
    if (emailInputs > 0 && passwordInputs > 0) {
      console.log('✅ Registration form elements found, attempting test...');
      
      try {
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
        
        await emailInput.fill('test@example.com');
        await passwordInput.fill('testpassword123');
        
        // Clear request tracking
        apiRequests = [];
        failedRequests = [];
        
        // Try to submit
        const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")').first();
        if (await submitButton.isVisible()) {
          console.log('🚀 Submitting registration...');
          await submitButton.click();
          
          // Wait for network activity
          await page.waitForTimeout(3000);
          
          // Check for error messages
          const bodyText = await page.textContent('body');
          const hasErrorMessage = bodyText.toLowerCase().includes('failed') || 
                                 bodyText.toLowerCase().includes('error') ||
                                 bodyText.toLowerCase().includes('invalid');
          
          console.log(`❌ Error message present: ${hasErrorMessage ? '✅' : '❌'}`);
          
          if (hasErrorMessage) {
            console.log('🔍 Looking for specific error text...');
            if (bodyText.includes('Registration failed')) {
              console.log('🎯 Found "Registration failed" error message');
            }
          }
        }
      } catch (error) {
        console.log('❌ Registration test failed:', error.message);
      }
    }

    // Test speech recognition availability
    console.log('\n🎤 Testing Speech Recognition...');
    const speechTest = await page.evaluate(() => {
      return {
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        speechRecognitionAvailable: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
        userAgent: navigator.userAgent
      };
    });

    console.log(`🔒 Secure context: ${speechTest.isSecureContext ? '✅' : '❌'}`);
    console.log(`📜 Protocol: ${speechTest.protocol}`);
    console.log(`🎤 Speech recognition available: ${speechTest.speechRecognitionAvailable ? '✅' : '❌'}`);

    // Try speech recognition programmatically
    try {
      const speechError = await page.evaluate(() => {
        return new Promise((resolve) => {
          if ('webkitSpeechRecognition' in window) {
            try {
              const recognition = new webkitSpeechRecognition();
              recognition.onerror = (event) => {
                resolve(`Speech Error: ${event.error}`);
              };
              recognition.start();
              setTimeout(() => {
                recognition.stop();
                resolve('Speech recognition started successfully');
              }, 1000);
            } catch (err) {
              resolve(`Exception: ${err.message}`);
            }
          } else {
            resolve('webkitSpeechRecognition not available');
          }
        });
      });
      console.log(`🎤 Speech test result: ${speechError}`);
    } catch (error) {
      console.log('❌ Speech test failed:', error.message);
    }

    // Summary
    console.log('\n📋 INVESTIGATION SUMMARY:');
    console.log(`🌐 Total network requests: ${networkRequests.length}`);
    console.log(`🔗 API requests: ${apiRequests.length}`);
    console.log(`❌ Failed requests: ${failedRequests.length}`);
    console.log(`🚨 Console errors: ${consoleErrors.length}`);

    if (apiRequests.length > 0) {
      console.log('\n🔗 API Requests:');
      apiRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method()} ${req.url()}`);
      });
    }

    if (failedRequests.length > 0) {
      console.log('\n❌ Failed Requests:');
      failedRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.status} ${req.statusText} - ${req.url}`);
      });
    }

    if (consoleErrors.length > 0) {
      console.log('\n🚨 Console Errors:');
      consoleErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/production-investigation.png', fullPage: true });
    console.log('📸 Screenshot saved: production-investigation.png');

    // Basic assertion to ensure test ran
    expect(true).toBe(true);
  });
});