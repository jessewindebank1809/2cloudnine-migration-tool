const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing "Connect New Organisation" OAuth Flow...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  // Monitor console and network for debugging
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'log' || type === 'error' || type === 'warn') {
      console.log(`🌐 Console [${type}]:`, msg.text());
    }
  });

  page.on('request', request => {
    const url = request.url();
    if (url.includes('oauth2') || url.includes('salesforce') || url.includes('organisations')) {
      console.log(`📨 REQUEST: ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (url.includes('oauth2') || url.includes('salesforce') || url.includes('organisations')) {
      console.log(`📨 RESPONSE: ${status} ${url}`);
    }
    if (status >= 400) {
      console.log(`❌ HTTP ${status}: ${url}`);
    }
  });

  try {
    console.log('📍 Navigating to organisations page...');
    await page.goto('http://localhost:3001/orgs', { waitUntil: 'domcontentloaded' });
    
    console.log('🔍 Looking for "Connect Organisation" button...');
    await page.waitForSelector('button:has-text("Connect Organisation")', { timeout: 10000 });
    
    console.log('🖱️ Clicking "Connect Organisation" button...');
    await page.click('button:has-text("Connect Organisation")');
    
    console.log('📝 Filling in organisation details...');
    await page.waitForSelector('input[id="name"]', { timeout: 5000 });
    await page.fill('input[id="name"]', 'Test Production Org');
    
    // Select Production option (should be default)
    await page.check('input[value="PRODUCTION"]');
    
    console.log('🔐 Clicking "Authorise" button...');
    await page.waitForSelector('button:has-text("Authorise")', { timeout: 5000 });
    await page.click('button:has-text("Authorise")');
    
    console.log('⏳ Waiting for OAuth redirect...');
    
    // Wait for either a redirect to Salesforce or an error
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('salesforce.com')) {
      console.log('✅ SUCCESS: Redirected to Salesforce OAuth!');
      
      // Parse OAuth parameters
      const url = new URL(currentUrl);
      console.log('🔑 OAuth Parameters:');
      console.log('   client_id:', url.searchParams.get('client_id'));
      console.log('   redirect_uri:', url.searchParams.get('redirect_uri'));
      console.log('   response_type:', url.searchParams.get('response_type'));
      console.log('   scope:', url.searchParams.get('scope'));
      
      const redirectUri = url.searchParams.get('redirect_uri');
      const expectedRedirectUri = 'http://localhost:3001/api/auth/callback/salesforce';
      
      if (redirectUri === expectedRedirectUri) {
        console.log('✅ Redirect URI is correct!');
      } else {
        console.log('❌ Redirect URI mismatch:');
        console.log('   Expected:', expectedRedirectUri);
        console.log('   Actual:', redirectUri);
        console.log('⚠️  You need to update your Connected App callback URL');
      }
      
    } else if (currentUrl.includes('error')) {
      console.log('❌ OAuth error detected in URL');
      const url = new URL(currentUrl);
      const error = url.searchParams.get('error');
      console.log('Error:', error);
      
    } else {
      console.log('⚠️  No redirect occurred. Checking for errors on page...');
      
      // Check for error messages on the page
      const errorElements = await page.$$('[role="alert"], .error, .text-red-500, .text-destructive');
      if (errorElements.length > 0) {
        for (const element of errorElements) {
          const text = await element.textContent();
          console.log('🚨 Error message:', text);
        }
      }
      
      // Check network tab for failed requests
      console.log('💡 Check the browser console and network tab for more details');
    }

    await page.screenshot({ path: 'connect-org-oauth-test.png' });
    console.log('📸 Screenshot saved: connect-org-oauth-test.png');

  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    await page.screenshot({ path: 'connect-org-oauth-error.png' });
  }

  console.log('🏁 Test completed. Browser will close in 15 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 15000);
})(); 