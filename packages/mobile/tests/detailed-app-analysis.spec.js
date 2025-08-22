import { test, expect } from '@playwright/test';

test.describe('Detailed App Analysis', () => {
  const PRODUCTION_URL = 'https://3d25cd28.localfirst-mobile.pages.dev';

  test('Analyze app structure and look for registration functionality', async ({ page }) => {
    console.log('🔍 Detailed App Structure Analysis...');
    
    let consoleMessages = [];
    let networkRequests = [];

    // Capture all console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      console.log(`🗣️  [${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Track network requests to our API
    page.on('request', request => {
      if (request.url().includes('localfirst-api') || 
          request.url().includes('auth') || 
          request.url().includes('register') ||
          request.url().includes('workers.dev')) {
        networkRequests.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers()
        });
        console.log('🔗 LocalFirst API Request:', request.method(), request.url());
      }
    });

    // Navigate and wait longer for the app to fully load
    console.log('🔄 Loading app...');
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait even more time for React to render
    await page.waitForTimeout(5000);

    // Get full page text content to understand what's shown
    const bodyText = await page.textContent('body');
    console.log(`📄 Total page text length: ${bodyText.length} characters`);
    
    // Look for key app sections
    const hasLocalFirst = bodyText.includes('Local First') || bodyText.includes('LocalFirst');
    const hasArizona = bodyText.includes('Arizona');
    const hasSearch = bodyText.includes('Search') || bodyText.includes('search');
    const hasLogin = bodyText.includes('Login') || bodyText.includes('login') || bodyText.includes('Sign In');
    const hasRegister = bodyText.includes('Register') || bodyText.includes('register') || bodyText.includes('Sign Up') || bodyText.includes('Create Account');
    const hasMap = bodyText.includes('Map') || bodyText.includes('map');

    console.log(`🏠 Contains "Local First": ${hasLocalFirst ? '✅' : '❌'}`);
    console.log(`🌵 Contains "Arizona": ${hasArizona ? '✅' : '❌'}`);
    console.log(`🔍 Contains "Search": ${hasSearch ? '✅' : '❌'}`);
    console.log(`🔑 Contains "Login": ${hasLogin ? '✅' : '❌'}`);
    console.log(`📝 Contains "Register": ${hasRegister ? '✅' : '❌'}`);
    console.log(`🗺️  Contains "Map": ${hasMap ? '✅' : '❌'}`);

    // Sample first 500 characters of visible text
    const visibleText = bodyText.substring(0, 500);
    console.log('👁️  First 500 characters of visible text:');
    console.log(`"${visibleText}"`);

    // Check for specific React/navigation patterns
    const reactElements = await page.locator('[data-reactroot], #root, .App').count();
    console.log(`⚛️  React root elements: ${reactElements}`);

    // Look for navigation elements that might lead to registration
    const navElements = await page.locator('nav, .navigation, [role="navigation"]').count();
    const linkElements = await page.locator('a').count();
    const buttonElements = await page.locator('button').count();

    console.log(`🧭 Navigation elements: ${navElements}`);
    console.log(`🔗 Link elements: ${linkElements}`);
    console.log(`🎯 Button elements: ${buttonElements}`);

    // Try to find and interact with navigation elements
    console.log('\n🎯 Analyzing interactive elements...');
    
    const buttons = await page.locator('button').all();
    const links = await page.locator('a').all();
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      try {
        const button = buttons[i];
        const buttonText = await button.textContent();
        const isVisible = await button.isVisible();
        console.log(`  🎛️  Button ${i + 1}: "${buttonText?.trim()}" (visible: ${isVisible})`);
        
        if (buttonText && (buttonText.toLowerCase().includes('register') || 
                          buttonText.toLowerCase().includes('sign up') ||
                          buttonText.toLowerCase().includes('create account') ||
                          buttonText.toLowerCase().includes('login'))) {
          console.log(`    🎯 Found authentication-related button!`);
        }
      } catch (e) {
        console.log(`  ⚠️  Could not analyze button ${i + 1}: ${e.message}`);
      }
    }

    for (let i = 0; i < Math.min(links.length, 10); i++) {
      try {
        const link = links[i];
        const linkText = await link.textContent();
        const href = await link.getAttribute('href');
        const isVisible = await link.isVisible();
        console.log(`  🔗 Link ${i + 1}: "${linkText?.trim()}" -> "${href}" (visible: ${isVisible})`);
        
        if (linkText && (linkText.toLowerCase().includes('register') || 
                        linkText.toLowerCase().includes('sign up') ||
                        linkText.toLowerCase().includes('create account') ||
                        linkText.toLowerCase().includes('login'))) {
          console.log(`    🎯 Found authentication-related link!`);
        }
      } catch (e) {
        console.log(`  ⚠️  Could not analyze link ${i + 1}: ${e.message}`);
      }
    }

    // Check for modal/popup patterns that might contain registration
    const modalElements = await page.locator('[role="dialog"], .modal, [data-testid*="modal"]').count();
    console.log(`📦 Modal elements: ${modalElements}`);

    // Look for input fields that might be hidden or in different containers
    const allInputs = await page.locator('input').all();
    console.log(`\n📝 Found ${allInputs.length} input elements:`);
    
    for (let i = 0; i < allInputs.length; i++) {
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const isVisible = await input.isVisible();
        const isEnabled = await input.isEnabled();
        
        console.log(`  📄 Input ${i + 1}: type="${type}", name="${name}", placeholder="${placeholder}", visible=${isVisible}, enabled=${isEnabled}`);
      } catch (e) {
        console.log(`  ⚠️  Could not analyze input ${i + 1}: ${e.message}`);
      }
    }

    // Try clicking various elements to see if registration form appears
    console.log('\n🖱️  Attempting to trigger registration interface...');
    
    // Try clicking buttons that might open registration
    const potentialRegisterButtons = await page.locator('button, a').all();
    
    for (let i = 0; i < Math.min(potentialRegisterButtons.length, 5); i++) {
      try {
        const element = potentialRegisterButtons[i];
        const text = await element.textContent();
        const isVisible = await element.isVisible();
        
        if (isVisible && text && (
          text.toLowerCase().includes('register') ||
          text.toLowerCase().includes('sign') ||
          text.toLowerCase().includes('login') ||
          text.toLowerCase().includes('auth') ||
          text.toLowerCase().includes('account')
        )) {
          console.log(`  🖱️  Clicking: "${text.trim()}"`);
          await element.click();
          await page.waitForTimeout(2000);
          
          // Check if any new elements appeared
          const newForms = await page.locator('form').count();
          const newInputs = await page.locator('input[type="email"], input[type="password"], input[name="email"], input[name="password"]').count();
          
          console.log(`    📊 After click - Forms: ${newForms}, Auth inputs: ${newInputs}`);
          
          if (newInputs > 0) {
            console.log('    🎉 Registration form appeared!');
            break;
          }
        }
      } catch (e) {
        console.log(`    ⚠️  Failed to click element ${i + 1}: ${e.message}`);
      }
    }

    // Final check for any API calls to our backend
    console.log('\n🌐 LocalFirst API Activity:');
    console.log(`  📊 Total LocalFirst API requests: ${networkRequests.length}`);
    
    if (networkRequests.length === 0) {
      console.log('  ❌ No requests made to LocalFirst API endpoints');
      console.log('  🔍 This suggests the app is not attempting to communicate with the backend');
    } else {
      networkRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      });
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/detailed-app-analysis.png', fullPage: true });
    console.log('📸 Screenshot saved: detailed-app-analysis.png');

    console.log('\n📋 ANALYSIS COMPLETE');
    console.log(`📊 Total console messages: ${consoleMessages.length}`);
    
    // Basic assertion
    expect(true).toBe(true);
  });

  test('Try to trigger registration by navigating to auth routes', async ({ page }) => {
    console.log('🧭 Testing direct navigation to auth routes...');
    
    const authRoutes = [
      '/login',
      '/register',
      '/signup',
      '/auth',
      '/authentication',
      '/#/login',
      '/#/register',
      '/#/signup'
    ];

    for (const route of authRoutes) {
      const fullUrl = PRODUCTION_URL + route;
      console.log(`🔍 Testing route: ${fullUrl}`);
      
      try {
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(2000);
        
        const forms = await page.locator('form').count();
        const emailInputs = await page.locator('input[type="email"], input[name="email"]').count();
        const passwordInputs = await page.locator('input[type="password"], input[name="password"]').count();
        
        console.log(`  📊 Found - Forms: ${forms}, Email inputs: ${emailInputs}, Password inputs: ${passwordInputs}`);
        
        if (forms > 0 || emailInputs > 0 || passwordInputs > 0) {
          console.log(`  ✅ Authentication form found at ${route}!`);
          
          // Try to test registration here
          if (emailInputs > 0 && passwordInputs > 0) {
            console.log('  🧪 Testing registration...');
            
            await page.locator('input[type="email"], input[name="email"]').first().fill('test@example.com');
            await page.locator('input[type="password"], input[name="password"]').first().fill('testpassword123');
            
            const submitButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
              await page.waitForTimeout(3000);
              
              const bodyText = await page.textContent('body');
              const hasError = bodyText.toLowerCase().includes('error') || bodyText.toLowerCase().includes('failed');
              console.log(`  ❌ Error after registration: ${hasError ? '✅' : '❌'}`);
              
              if (hasError && bodyText.includes('Registration failed')) {
                console.log('  🎯 Found "Registration failed" error message!');
              }
            }
          }
          
          await page.screenshot({ path: `test-results/auth-route-${route.replace(/[\/\#]/g, '-')}.png`, fullPage: true });
          break;
        }
      } catch (error) {
        console.log(`  ❌ Failed to load ${route}: ${error.message}`);
      }
    }

    console.log('✅ Auth route testing complete');
    expect(true).toBe(true);
  });
});