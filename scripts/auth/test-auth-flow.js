const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting signin page test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  // Listen to console events
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'log' || type === 'error' || type === 'warn') {
      console.log(`🌐 Browser Console [${type}]:`, msg.text());
    }
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
  });

  // Listen to network requests/responses
  page.on('request', request => {
    console.log(`📡 Request: ${request.method()} ${request.url()}`);
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (status >= 400) {
      console.log(`❌ Response: ${status} ${url}`);
    } else {
      console.log(`📨 Response: ${status} ${url}`);
    }
  });

  try {
    console.log('🌐 Navigating to signin page...');
    await page.goto('http://localhost:3000/auth/signin', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take a screenshot
    await page.screenshot({ path: 'signin-styled-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as signin-styled-screenshot.png');

    // Get page content
    const content = await page.content();
    console.log('📄 Page HTML length:', content.length);
    
    // Check if there's any visible text
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('📝 Visible text length:', bodyText.length);
    console.log('📝 Visible text preview:', bodyText.substring(0, 500));

    // Check for Salesforce logo
    const hasSalesforceLogo = await page.evaluate(() => 
      document.querySelector('svg[viewBox="0 0 100 100"]') !== null
    );
    console.log('🎯 Has Salesforce logo:', hasSalesforceLogo);

    // Check for Salesforce colors
    const hasSalesforceColors = await page.evaluate(() => {
      const button = document.querySelector('button');
      if (!button) return false;
      const styles = window.getComputedStyle(button);
      return styles.background.includes('rgb(0, 112, 210)') || 
             button.className.includes('[#0070D2]') ||
             button.className.includes('from-[#0070D2]');
    });
    console.log('🎨 Has Salesforce blue colors:', hasSalesforceColors);

    console.log('✅ Signin page test completed');

  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
  }

  console.log('🏁 Test completed. Browser will close in 10 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 10000);
})();