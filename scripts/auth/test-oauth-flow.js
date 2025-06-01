const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing OAuth flow...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  // Listen to console events and network requests
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'log' || type === 'error' || type === 'warn') {
      console.log(`🌐 Console [${type}]:`, msg.text());
    }
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (status >= 400) {
      console.log(`❌ HTTP ${status}: ${url}`);
    } else if (url.includes('oauth2') || url.includes('salesforce')) {
      console.log(`📨 OAuth Response ${status}: ${url}`);
    }
  });

  try {
    console.log('🌐 Navigating to signin page...');
    await page.goto('http://localhost:3000/auth/signin', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for the Salesforce OAuth button
    console.log('🔍 Looking for Salesforce sign-in button...');
    
    // Try different selectors for the button
    const buttonSelectors = [
      'button:contains("Continue with Salesforce")',
      'button[type="button"]',
      'button:contains("Salesforce")',
      '[role="button"]:contains("Salesforce")'
    ];

    let button = null;
    for (const selector of buttonSelectors) {
      try {
        // Use XPath for text-based selection
        if (selector.includes('contains')) {
          const xpath = selector.replace('button:contains("', '//button[contains(text(), "').replace('")', '")]');
          const elements = await page.$x(xpath);
          if (elements.length > 0) {
            button = elements[0];
            console.log(`✅ Found button with XPath: ${xpath}`);
            break;
          }
        } else {
          button = await page.$(selector);
          if (button) {
            console.log(`✅ Found button with selector: ${selector}`);
            break;
          }
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!button) {
      // Try to find any button and log what's available
      const allButtons = await page.$$eval('button', buttons => 
        buttons.map(btn => btn.textContent?.trim() || btn.innerHTML)
      );
      console.log('❌ Salesforce button not found. Available buttons:', allButtons);
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'no-button-found.png' });
      return;
    }

    console.log('🖱️ Clicking Salesforce OAuth button...');
    await button.click();

    // Wait for OAuth redirect
    console.log('⏳ Waiting for OAuth redirect...');
    
    try {
      // Wait for either successful redirect to Salesforce or an error
      await page.waitForFunction(
        () => window.location.href.includes('salesforce.com') || document.body.textContent.includes('error'),
        { timeout: 10000 }
      );

      const currentUrl = page.url();
      console.log('📍 Current URL:', currentUrl);

      if (currentUrl.includes('salesforce.com')) {
        console.log('✅ Successfully redirected to Salesforce!');
        console.log('🎯 OAuth flow appears to be working correctly');
        
        // Take screenshot of Salesforce login page
        await page.screenshot({ path: 'salesforce-oauth-page.png' });
        console.log('📸 Screenshot saved: salesforce-oauth-page.png');
        
      } else {
        console.log('❌ Did not redirect to Salesforce');
        await page.screenshot({ path: 'oauth-error.png' });
        
        // Check for error messages
        const pageText = await page.evaluate(() => document.body.textContent);
        if (pageText.includes('error')) {
          console.log('🚨 Error detected on page');
          console.log('📄 Page content:', pageText.substring(0, 500));
        }
      }

    } catch (waitError) {
      console.log('⏰ Timeout waiting for redirect');
      console.log('📍 Current URL:', page.url());
      
      // Check for any error messages or console errors
      const pageText = await page.evaluate(() => document.body.textContent);
      console.log('📄 Page content preview:', pageText.substring(0, 300));
      
      await page.screenshot({ path: 'oauth-timeout.png' });
    }

  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    await page.screenshot({ path: 'oauth-test-error.png' });
  }

  console.log('🏁 OAuth test completed. Browser will close in 15 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 15000);
})(); 