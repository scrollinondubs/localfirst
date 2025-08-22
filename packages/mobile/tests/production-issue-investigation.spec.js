import { test, expect } from '@playwright/test';

test.describe('Production Issue Investigation', () => {
  const PRODUCTION_URL = 'https://3d25cd28.localfirst-mobile.pages.dev';
  const API_BASE_URL = 'https://localfirst-api-production.localfirst.workers.dev/api';

  test('Investigate registration failure and network issues', async ({ page }) => {
    console.log('🔍 Starting Production Issue Investigation...');
    console.log('📍 Target:', PRODUCTION_URL);
    console.log('🔗 Expected API:', API_BASE_URL);
    
    let allLogs = [];
    let errorLogs = [];
    let networkRequests = [];
    let networkResponses = [];
    let failedRequests = [];

    // Capture all console activity
    page.on('console', msg => {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`;
      allLogs.push(logEntry);
      
      if (msg.type() === 'error') {
        errorLogs.push(logEntry);
        console.log('🚨 Console Error:', logEntry);
      } else if (msg.type() === 'warn') {
        console.log('⚠️  Console Warning:', logEntry);
      } else {
        console.log('📝 Console Log:', logEntry);
      }
    });

    // Monitor network requests
    page.on('request', request => {
      const requestInfo = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        resourceType: request.resourceType()
      };
      networkRequests.push(requestInfo);
      
      if (request.url().includes('api') || request.url().includes('auth') || request.url().includes('register')) {
        console.log('🌐 API Request:', request.method(), request.url());
        console.log('📋 Headers:', JSON.stringify(request.headers(), null, 2));
      }
    });

    // Monitor network responses
    page.on('response', async response => {
      const responseInfo = {
        timestamp: new Date().toISOString(),
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers()
      };

      // Try to capture response body for API calls
      if (response.url().includes('api') || response.url().includes('auth') || response.url().includes('register')) {
        try {
          const body = await response.text();
          responseInfo.body = body;
          console.log('📨 API Response:', response.status(), response.url());
          console.log('📄 Response Body:', body);
        } catch (e) {
          console.log('⚠️  Could not read response body:', e.message);
        }
      }

      networkResponses.push(responseInfo);

      // Track failed requests
      if (response.status() >= 400) {
        const failedRequest = {
          ...responseInfo,
          request: networkRequests.find(req => req.url === response.url())
        };
        failedRequests.push(failedRequest);
        console.log('❌ Failed Request:', response.status(), response.url());
      }
    });

    // Monitor page errors
    page.on('pageerror', error => {
      console.log('💥 Page Error:', error.message);
      errorLogs.push(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to production app
    console.log('🔄 Loading production application...');
    try {
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.log('❌ Failed to load page:', error.message);
      throw error;
    }

    // Wait for app to initialize
    await page.waitForTimeout(5000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/production-app-loaded.png', fullPage: true });
    console.log('📸 Screenshot: production-app-loaded.png');

    // Check if HTTPS is properly configured
    const currentUrl = page.url();
    const isHttps = currentUrl.startsWith('https://');
    console.log(`🔒 HTTPS Status: ${isHttps ? '✅ Secure' : '❌ Not Secure'} (${currentUrl})`);

    // Look for registration form or login elements
    console.log('\n🔍 Looking for registration/login elements...');
    
    // Common selectors for registration forms
    const registrationSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      'button[type="submit"]',
      'button:has-text("Register")',
      'button:has-text("Sign Up")',
      'button:has-text("Create Account")',
      '[data-testid*="register"]',
      '[data-testid*="signup"]'
    ];

    let foundElements = [];
    for (const selector of registrationSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        foundElements.push({ selector, count: elements.length });
        console.log(`✅ Found ${elements.length} element(s): ${selector}`);
      }
    }

    if (foundElements.length === 0) {
      console.log('⚠️  No registration elements found with common selectors');
      
      // Try to find any form elements
      const forms = await page.locator('form').all();
      const inputs = await page.locator('input').all();
      const buttons = await page.locator('button').all();
      
      console.log(`📊 Found: ${forms.length} forms, ${inputs.length} inputs, ${buttons.length} buttons`);
      
      // Get page content to analyze
      const bodyText = await page.locator('body').textContent();
      console.log(`📄 Page content length: ${bodyText?.length || 0} characters`);
      
      if (bodyText) {
        const hasRegisterText = bodyText.toLowerCase().includes('register') || 
                               bodyText.toLowerCase().includes('sign up') ||
                               bodyText.toLowerCase().includes('create account');
        console.log(`📝 Contains registration text: ${hasRegisterText ? '✅' : '❌'}`);
      }
    }

    // Try to locate and test registration functionality
    console.log('\n🧪 Attempting registration test...');
    
    try {
      // Look for email input
      const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
      const emailExists = await emailInput.isVisible({ timeout: 3000 });
      
      if (emailExists) {
        console.log('✅ Email input found');
        await emailInput.fill('test@example.com');
        console.log('📝 Email entered: test@example.com');
        
        // Look for password input
        const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
        const passwordExists = await passwordInput.isVisible({ timeout: 3000 });
        
        if (passwordExists) {
          console.log('✅ Password input found');
          await passwordInput.fill('testpassword123');
          console.log('📝 Password entered');
          
          // Look for submit button
          const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up"), button:has-text("Create Account")').first();
          const submitExists = await submitButton.isVisible({ timeout: 3000 });
          
          if (submitExists) {
            console.log('✅ Submit button found');
            
            // Take screenshot before submitting
            await page.screenshot({ path: 'test-results/before-registration-submit.png', fullPage: true });
            console.log('📸 Screenshot: before-registration-submit.png');
            
            // Clear previous network tracking
            networkRequests = [];
            networkResponses = [];
            failedRequests = [];
            
            console.log('🚀 Clicking submit button...');
            await submitButton.click();
            
            // Wait for network activity
            await page.waitForTimeout(5000);
            
            // Take screenshot after submitting
            await page.screenshot({ path: 'test-results/after-registration-submit.png', fullPage: true });
            console.log('📸 Screenshot: after-registration-submit.png');
            
            // Check for registration success/failure messages
            const bodyTextAfter = await page.locator('body').textContent();
            const hasSuccessMessage = bodyTextAfter?.toLowerCase().includes('success') || 
                                    bodyTextAfter?.toLowerCase().includes('welcome') ||
                                    bodyTextAfter?.toLowerCase().includes('account created');
            const hasFailureMessage = bodyTextAfter?.toLowerCase().includes('failed') || 
                                    bodyTextAfter?.toLowerCase().includes('error') ||
                                    bodyTextAfter?.toLowerCase().includes('invalid');
            
            console.log(`✅ Success message detected: ${hasSuccessMessage ? '✅' : '❌'}`);
            console.log(`❌ Failure message detected: ${hasFailureMessage ? '✅' : '❌'}`);
            
            if (hasFailureMessage) {
              console.log('🔍 Analyzing failure message...');
              // Try to find specific error messages
              const errorElements = await page.locator(':has-text("failed"), :has-text("error"), :has-text("invalid")').all();
              for (let i = 0; i < errorElements.length; i++) {
                try {
                  const errorText = await errorElements[i].textContent();
                  console.log(`❌ Error ${i + 1}: ${errorText}`);
                } catch (e) {
                  console.log(`⚠️  Could not read error text ${i + 1}`);
                }
              }
            }
            
          } else {
            console.log('❌ No submit button found');
          }
        } else {
          console.log('❌ No password input found');
        }
      } else {
        console.log('❌ No email input found');
      }
    } catch (error) {
      console.log('❌ Registration test failed:', error.message);
    }

    // Analyze network requests made during registration
    console.log('\n🌐 Network Analysis:');
    console.log(`📊 Total requests: ${networkRequests.length}`);
    console.log(`❌ Failed requests: ${failedRequests.length}`);

    // API-related requests
    const apiRequests = networkRequests.filter(req => 
      req.url.includes('api') || 
      req.url.includes('auth') || 
      req.url.includes('register') ||
      req.url.includes(API_BASE_URL)
    );
    console.log(`🔗 API requests: ${apiRequests.length}`);

    if (apiRequests.length > 0) {
      console.log('\n🔍 API Request Details:');
      apiRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.method} ${req.url}`);
        console.log(`   Headers: ${JSON.stringify(req.headers, null, 2)}`);
      });
    }

    if (failedRequests.length > 0) {
      console.log('\n❌ Failed Request Details:');
      failedRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.status} ${req.statusText} - ${req.url}`);
        if (req.body) {
          console.log(`   Response: ${req.body}`);
        }
      });
    }

    // CORS Analysis
    const corsErrors = errorLogs.filter(log => 
      log.toLowerCase().includes('cors') || 
      log.toLowerCase().includes('access-control') ||
      log.toLowerCase().includes('cross-origin')
    );
    
    if (corsErrors.length > 0) {
      console.log('\n🚫 CORS Issues Detected:');
      corsErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n✅ Registration investigation complete!');
  });

  test('Investigate voice dictation HTTPS issue', async ({ page }) => {
    console.log('\n🎤 Starting Voice Dictation Investigation...');
    
    let errorLogs = [];
    let speechRecognitionAttempts = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const logEntry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
        errorLogs.push(logEntry);
        console.log('🚨 Voice Error:', logEntry);
      }
    });

    // Navigate to production app
    await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check HTTPS context
    const isSecureContext = await page.evaluate(() => {
      return {
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        speechRecognitionAvailable: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
      };
    });

    console.log('🔒 Security Context Analysis:');
    console.log(`   Secure Context: ${isSecureContext.isSecureContext ? '✅' : '❌'}`);
    console.log(`   Protocol: ${isSecureContext.protocol}`);
    console.log(`   Hostname: ${isSecureContext.hostname}`);
    console.log(`   Speech Recognition Available: ${isSecureContext.speechRecognitionAvailable ? '✅' : '❌'}`);

    // Look for voice/speech related elements
    console.log('\n🔍 Looking for voice/speech elements...');
    
    const voiceSelectors = [
      'button:has-text("Voice")',
      'button:has-text("Speak")',
      'button:has-text("Microphone")',
      '[data-testid*="voice"]',
      '[data-testid*="speech"]',
      '[data-testid*="mic"]',
      'button[aria-label*="voice" i]',
      'button[aria-label*="speech" i]',
      'button[aria-label*="mic" i]',
      '.voice-button',
      '.mic-button'
    ];

    let voiceElements = [];
    for (const selector of voiceSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        voiceElements.push({ selector, count: elements.length });
        console.log(`✅ Found voice element: ${selector} (${elements.length})`);
      }
    }

    if (voiceElements.length === 0) {
      console.log('⚠️  No obvious voice elements found');
      
      // Check page content for voice-related text
      const bodyText = await page.locator('body').textContent();
      const hasVoiceText = bodyText?.toLowerCase().includes('voice') || 
                          bodyText?.toLowerCase().includes('speech') ||
                          bodyText?.toLowerCase().includes('microphone');
      console.log(`📝 Contains voice-related text: ${hasVoiceText ? '✅' : '❌'}`);
    }

    // Try to trigger speech recognition programmatically
    console.log('\n🧪 Testing speech recognition programmatically...');
    
    try {
      const speechTest = await page.evaluate(() => {
        return new Promise((resolve) => {
          const results = {
            speechRecognitionConstructor: null,
            webkitSpeechRecognitionConstructor: null,
            error: null
          };

          try {
            // Test standard SpeechRecognition
            if ('SpeechRecognition' in window) {
              results.speechRecognitionConstructor = 'Available';
              const recognition = new window.SpeechRecognition();
              recognition.start();
              recognition.onerror = (event) => {
                results.error = `SpeechRecognition Error: ${event.error}`;
                resolve(results);
              };
              setTimeout(() => {
                recognition.stop();
                if (!results.error) {
                  results.speechRecognitionConstructor = 'Started successfully';
                }
                resolve(results);
              }, 1000);
            }
            // Test webkit prefixed version
            else if ('webkitSpeechRecognition' in window) {
              results.webkitSpeechRecognitionConstructor = 'Available';
              const recognition = new window.webkitSpeechRecognition();
              recognition.start();
              recognition.onerror = (event) => {
                results.error = `webkitSpeechRecognition Error: ${event.error}`;
                resolve(results);
              };
              setTimeout(() => {
                recognition.stop();
                if (!results.error) {
                  results.webkitSpeechRecognitionConstructor = 'Started successfully';
                }
                resolve(results);
              }, 1000);
            } else {
              results.error = 'Speech recognition not available';
              resolve(results);
            }
          } catch (error) {
            results.error = `Exception: ${error.message}`;
            resolve(results);
          }
        });
      });

      console.log('🎤 Speech Recognition Test Results:');
      console.log(`   SpeechRecognition: ${speechTest.speechRecognitionConstructor || 'Not available'}`);
      console.log(`   webkitSpeechRecognition: ${speechTest.webkitSpeechRecognitionConstructor || 'Not available'}`);
      if (speechTest.error) {
        console.log(`   ❌ Error: ${speechTest.error}`);
      }

    } catch (error) {
      console.log('❌ Speech recognition test failed:', error.message);
    }

    // Check for specific HTTPS/localhost errors in console
    const httpsErrors = errorLogs.filter(log => 
      log.toLowerCase().includes('https') ||
      log.toLowerCase().includes('localhost') ||
      log.toLowerCase().includes('secure context') ||
      log.toLowerCase().includes('speech recognition')
    );

    if (httpsErrors.length > 0) {
      console.log('\n🔒 HTTPS/Security Related Errors:');
      httpsErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Take screenshot of voice investigation
    await page.screenshot({ path: 'test-results/voice-dictation-investigation.png', fullPage: true });
    console.log('📸 Screenshot: voice-dictation-investigation.png');

    console.log('\n✅ Voice dictation investigation complete!');
  });

  test('Complete investigation summary', async ({ page }) => {
    console.log('\n📋 INVESTIGATION SUMMARY');
    console.log('=' .repeat(50));
    
    // This test will run after the others and compile findings
    // The actual summary will be in the test output and logs
    
    expect(true).toBe(true); // Placeholder assertion
  });
});