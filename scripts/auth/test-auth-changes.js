const puppeteer = require('puppeteer');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🔧 Testing Updated Auth Configuration...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  // Monitor network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('oauth2') || url.includes('salesforce') || url.includes('authorize')) {
      console.log(`📨 REQUEST: ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (url.includes('oauth2') || url.includes('salesforce') || url.includes('authorize')) {
      console.log(`📨 RESPONSE: ${status} ${url}`);
    }
  });

  try {
    console.log('🌐 Navigating to signin page...');
    await page.goto('http://localhost:3000/auth/signin', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('🔍 Looking for Salesforce button...');
    
    // Try to find the button using different methods
    let button = null;
    
    // Method 1: Try direct selector
    try {
      await page.waitForSelector('button', { timeout: 5000 });
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Salesforce')) {
          button = btn;
          console.log('✅ Found Salesforce button via text search');
          break;
        }
      }
    } catch (error) {
      console.log('Could not find button via selector method');
    }

    if (!button) {
      console.log('❌ Salesforce button not found');
      const allButtons = await page.$$eval('button', buttons => 
        buttons.map(btn => btn.textContent?.trim())
      );
      console.log('Available buttons:', allButtons);
      await page.screenshot({ path: 'no-salesforce-button.png' });
      return;
    }

    console.log('✅ Found Salesforce button, clicking...');
    await button.click();

    // Wait for OAuth initiation
    console.log('⏳ Waiting for OAuth flow...');
    await wait(3000);

    // Check if we're redirected to Salesforce
    const currentUrl = page.url();
    console.log('📍 Current URL after click:', currentUrl);

    if (currentUrl.includes('salesforce.com')) {
      console.log('✅ Successfully redirected to Salesforce!');
      
      // Parse the URL to check parameters
      const url = new URL(currentUrl);
      console.log('🔑 OAuth Parameters:');
      console.log('   client_id:', url.searchParams.get('client_id'));
      console.log('   redirect_uri:', url.searchParams.get('redirect_uri'));
      console.log('   response_type:', url.searchParams.get('response_type'));
      console.log('   scope:', url.searchParams.get('scope'));
      console.log('   state:', url.searchParams.get('state'));
      
      // Check if redirect_uri is correct
      const redirectUri = url.searchParams.get('redirect_uri');
      const expectedRedirectUri = 'http://localhost:3000/api/auth/oauth2/callback/salesforce';
      
      if (redirectUri === expectedRedirectUri) {
        console.log('✅ Redirect URI is correct!');
      } else {
        console.log('❌ Redirect URI mismatch:');
        console.log('   Expected:', expectedRedirectUri);
        console.log('   Actual:', redirectUri);
      }
      
      await page.screenshot({ path: 'salesforce-oauth-updated.png' });
      console.log('📸 Screenshot saved: salesforce-oauth-updated.png');
      
    } else {
      console.log('❌ Did not redirect to Salesforce');
      console.log('📍 Current URL:', currentUrl);
      
      const pageText = await page.evaluate(() => document.body.textContent);
      if (pageText.includes('error')) {
        console.log('🚨 Error detected on page:', pageText.substring(0, 200));
      }
      
      await page.screenshot({ path: 'oauth-updated-error.png' });
    }

  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    await page.screenshot({ path: 'oauth-updated-test-error.png' });
  }

  console.log('🏁 Test completed. Browser will close in 10 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 10000);
})(); 