const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Starting ProfileInterviewScreen Dossier Button Test');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for observation
  });
  
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 } // Mobile viewport
  });
  
  const page = await context.newPage();
  
  // Collect all console messages for analysis
  const consoleMessages = [];
  page.on('console', msg => {
    const message = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    console.log(message);
    consoleMessages.push(message);
  });
  
  // Listen for alerts/dialogs
  page.on('dialog', async dialog => {
    console.log(`🔔 Dialog appeared: ${dialog.type()} - "${dialog.message()}"`);
    await dialog.accept(); // Accept all dialogs
  });
  
  try {
    console.log('📱 Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
    
    console.log('📷 Taking initial screenshot...');
    await page.screenshot({ path: 'test-initial.png', fullPage: true });
    
    console.log('🔍 Looking for Profile tab...');
    // Try multiple selectors for Profile tab
    const profileSelectors = [
      'text=Profile',
      '[data-testid="profile-tab"]',
      ':has-text("Profile")',
      'div:has-text("Profile")'
    ];
    
    let profileTabClicked = false;
    for (const selector of profileSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`✅ Found Profile tab with selector: ${selector}`);
        await page.click(selector);
        console.log('✅ Clicked Profile tab');
        profileTabClicked = true;
        break;
      } catch (e) {
        console.log(`❌ Selector "${selector}" not found`);
      }
    }
    
    if (!profileTabClicked) {
      console.log('❌ Could not find Profile tab, checking current page state...');
      await page.screenshot({ path: 'test-profile-search-failed.png', fullPage: true });
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-after-profile-click.png', fullPage: true });
    
    // Check if we need to create account or sign in
    console.log('🔐 Checking authentication status...');
    const hasCreateAccount = await page.locator('text=Create Account').isVisible();
    const hasSignIn = await page.locator('text=Sign In').isVisible();
    
    if (hasCreateAccount || hasSignIn) {
      console.log('📝 Account creation/signin required');
      
      // Try to click "Create Account" first
      if (hasCreateAccount) {
        console.log('🆕 Clicking Create Account...');
        await page.click('text=Create Account');
        await page.waitForTimeout(2000);
        
        // Fill in a test account (this is just for testing)
        console.log('📝 Filling account details...');
        try {
          await page.fill('input[placeholder*="email"], input[type="email"]', 'test@example.com');
          await page.fill('input[placeholder*="password"], input[type="password"]', 'testpassword123');
          await page.fill('input[placeholder*="name"]', 'Test User');
          
          // Look for submit/create button
          await page.click('text=Create, text=Sign Up, [type="submit"]');
          await page.waitForTimeout(3000);
        } catch (e) {
          console.log(`❌ Account creation form interaction failed: ${e.message}`);
        }
      }
    }
    
    await page.screenshot({ path: 'test-after-auth.png', fullPage: true });
    
    // Look for "Complete Profile Interview" link/button
    console.log('🎤 Looking for Complete Profile Interview...');
    const interviewSelectors = [
      'text=Complete Profile Interview',
      'text=Profile Interview',
      ':has-text("Interview")',
      'text=Start Interview'
    ];
    
    let interviewFound = false;
    for (const selector of interviewSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`✅ Found interview link with selector: ${selector}`);
        await page.click(selector);
        console.log('✅ Clicked Profile Interview link');
        interviewFound = true;
        break;
      } catch (e) {
        console.log(`❌ Interview selector "${selector}" not found`);
      }
    }
    
    if (!interviewFound) {
      console.log('❌ Could not find Profile Interview link');
      await page.screenshot({ path: 'test-no-interview-found.png', fullPage: true });
    } else {
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-interview-screen.png', fullPage: true });
      
      console.log('💬 Starting to send 3+ user messages...');
      
      // Send 4 test messages to trigger the dossier button
      const testMessages = [
        "Hi, I'm interested in local restaurants.",
        "I love Italian food and craft beer.",
        "I usually prefer casual dining over fine dining.",
        "I'm looking for places with outdoor seating."
      ];
      
      for (let i = 0; i < testMessages.length; i++) {
        console.log(`📤 Sending message ${i + 1}: "${testMessages[i]}"`);
        
        // Find text input field
        const inputSelectors = [
          'input[placeholder*="response"]',
          'input[placeholder*="Type"]',
          'textarea[placeholder*="response"]',
          'textarea[placeholder*="Type"]',
          '[role="textbox"]',
          'input[type="text"]'
        ];
        
        let messageWaSent = false;
        for (const selector of inputSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
            await page.fill(selector, testMessages[i]);
            
            // Look for send button
            const sendSelectors = ['text=Send', 'button:has-text("Send")', '[type="submit"]'];
            for (const sendSelector of sendSelectors) {
              try {
                await page.click(sendSelector);
                console.log(`✅ Message ${i + 1} sent successfully`);
                messageWaSent = true;
                break;
              } catch (e) {
                console.log(`❌ Send button "${sendSelector}" not found`);
              }
            }
            
            if (messageWaSent) break;
          } catch (e) {
            console.log(`❌ Input selector "${selector}" not found`);
          }
        }
        
        if (!messageWaSent) {
          console.log(`❌ Could not send message ${i + 1}`);
        }
        
        // Wait for AI response
        await page.waitForTimeout(3000);
        
        // Check for dossier button after each message
        const dossierVisible = await page.locator('text=Generate Personal Dossier').isVisible();
        console.log(`🔍 After message ${i + 1}: Dossier button visible = ${dossierVisible}`);
        
        if (dossierVisible) {
          console.log(`🎯 SUCCESS! Dossier button appeared after ${i + 1} messages`);
          break;
        }
      }
      
      await page.screenshot({ path: 'test-after-messages.png', fullPage: true });
      
      // Look for and test the dossier button
      console.log('🔍 Looking for Generate Personal Dossier button...');
      const dossierButton = page.locator('text=Generate Personal Dossier');
      const isDossierVisible = await dossierButton.isVisible();
      
      console.log(`📝 Dossier button visible: ${isDossierVisible}`);
      
      if (isDossierVisible) {
        console.log('🎯 TESTING: Clicking Generate Personal Dossier button...');
        await dossierButton.click();
        
        // Wait for any response/dialog
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-after-dossier-click.png', fullPage: true });
      } else {
        console.log('❌ Dossier button not visible - checking user message count...');
        
        // Count visible user messages
        const userMessages = await page.locator('.userMessage, [class*="user"], [class*="User"]').count();
        console.log(`📊 User messages found: ${userMessages}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
  }
  
  // Analysis of console messages
  console.log('\n📊 CONSOLE ANALYSIS:');
  const debugMessages = consoleMessages.filter(msg => msg.includes('DEBUG'));
  console.log(`🐛 DEBUG messages found: ${debugMessages.length}`);
  debugMessages.forEach(msg => console.log(`  ${msg}`));
  
  const dossierMessages = consoleMessages.filter(msg => 
    msg.includes('dossier') || msg.includes('Dossier') || msg.includes('BUTTON')
  );
  console.log(`📝 Dossier-related messages: ${dossierMessages.length}`);
  dossierMessages.forEach(msg => console.log(`  ${msg}`));
  
  await browser.close();
  console.log('🏁 Test completed!');
})();