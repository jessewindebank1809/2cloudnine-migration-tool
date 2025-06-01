const puppeteer = require('puppeteer');

const SALESFORCE_CREDENTIALS = {
  username: 'test-r0fxwq8cftxy@example.com',
  password: 'p]3cnaozcetRi',
  orgUrl: 'https://site-site-6377-dev-ed.scratch.my.salesforce.com'
};

// Direct URL to the Connected App
const CONNECTED_APP_URL = 'https://site-site-6377-dev-ed.scratch.my.salesforce.com/app/mgmt/forceconnectedapps/forceAppDetail.apexp?applicationId=06PAD000000c4NZ&applicationId=06PAD000000c4NZ&id=0CiAD0000006Kgn';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🚀 Inspecting specific Connected App...');
  console.log('📱 App URL:', CONNECTED_APP_URL);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();

  // Listen to console events
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') {
      console.log(`🌐 Browser Console [${type}]:`, msg.text());
    }
  });

  try {
    console.log('🌐 Navigating to Salesforce login...');
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Login
    await page.waitForSelector('#username', { timeout: 10000 });
    console.log('📝 Logging in...');
    
    await page.type('#username', SALESFORCE_CREDENTIALS.username);
    await page.type('#password', SALESFORCE_CREDENTIALS.password);
    await page.click('#Login');
    await wait(5000);
    console.log('✅ Login completed');

    // Navigate directly to the Connected App
    console.log('📱 Navigating to Connected App details...');
    await page.goto(CONNECTED_APP_URL, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    
    await wait(3000);
    await page.screenshot({ path: 'connected-app-found.png', fullPage: true });
    console.log('📸 Screenshot saved: connected-app-found.png');

    // Extract all information from the page
    console.log('📊 Extracting Connected App information...');
    
    const appInfo = await page.evaluate(() => {
      const content = document.body.innerText;
      const info = {
        appName: '',
        clientId: '',
        callbackUrls: [],
        userPolicy: '',
        ipPolicy: '',
        scopes: [],
        rawContent: content
      };
      
      // Extract app name from title or heading
      const titleElement = document.querySelector('h1, h2, .pageTitle, .detailInfo h3');
      if (titleElement) {
        info.appName = titleElement.textContent.trim();
      }
      
      // Look for Client ID / Consumer Key
      const clientIdMatch = content.match(/(?:Client ID|Consumer Key)[\s:]*([A-Za-z0-9._]+)/i);
      if (clientIdMatch) {
        info.clientId = clientIdMatch[1];
      }
      
      // Look for callback URLs
      const callbackMatches = content.match(/http[s]?:\/\/[^\s]+(?:callback|redirect)[^\s]*/gi);
      if (callbackMatches) {
        info.callbackUrls = [...new Set(callbackMatches)]; // Remove duplicates
      }
      
      // Check user authorization policy
      if (content.includes('Admin approved users are pre-authorized')) {
        info.userPolicy = 'Admin approved users are pre-authorized';
      } else if (content.includes('All users may self-authorize')) {
        info.userPolicy = 'All users may self-authorize';
      } else if (content.includes('admin approved')) {
        info.userPolicy = 'Requires admin approval';
      }
      
      // Check IP restrictions
      if (content.includes('Relaxed IP restrictions')) {
        info.ipPolicy = 'Relaxed IP restrictions';
      } else if (content.includes('Enforce IP restrictions')) {
        info.ipPolicy = 'Enforce IP restrictions';
      }
      
      // Look for OAuth scopes
      const scopeKeywords = ['api', 'refresh_token', 'openid', 'profile', 'email'];
      info.scopes = scopeKeywords.filter(scope => content.toLowerCase().includes(scope));
      
      return info;
    });

    console.log('\n📋 Connected App Details:');
    console.log('📱 App Name:', appInfo.appName || 'Not found');
    console.log('🔑 Client ID:', appInfo.clientId || 'Not found');
    console.log('👥 User Policy:', appInfo.userPolicy || 'Not found');
    console.log('🌐 IP Policy:', appInfo.ipPolicy || 'Not found');
    console.log('🔗 Callback URLs:', appInfo.callbackUrls.length > 0 ? appInfo.callbackUrls : 'Not found');
    console.log('🎯 OAuth Scopes:', appInfo.scopes.length > 0 ? appInfo.scopes : 'Not found');

    // Check for potential issues
    console.log('\n🔍 OAuth Error Analysis:');
    
    let hasIssues = false;
    
    // Check client ID match
    if (appInfo.clientId && appInfo.clientId !== '3MVG9rZSDEiGkwu_ztMAGYhlHBgQYfaAEBH8HipH2F1we_F4w7i8Wt9v9Txmz3ou7VblRKwJW26UAOcLCOIGG') {
      console.log('⚠️  CLIENT ID MISMATCH!');
      console.log('   Expected: 3MVG9rZSDEiGkwu_ztMAGYhlHBgQYfaAEBH8HipH2F1we_F4w7i8Wt9v9Txmz3ou7VblRKwJW26UAOcLCOIGG');
      console.log('   Found:', appInfo.clientId);
      hasIssues = true;
    }
    
    // Check user policy
    if (appInfo.userPolicy === 'Admin approved users are pre-authorized' || appInfo.userPolicy === 'Requires admin approval') {
      console.log('⚠️  USER AUTHORIZATION ISSUE!');
      console.log('   Connected App requires admin approval for users');
      console.log('💡 Solutions:');
      console.log('   1. Change to "All users may self-authorize"');
      console.log('   2. OR assign your user to the Connected App permission set');
      hasIssues = true;
    }
    
    // Check IP restrictions
    if (appInfo.ipPolicy === 'Enforce IP restrictions') {
      console.log('⚠️  IP RESTRICTION ISSUE!');
      console.log('   Connected App enforces IP restrictions');
      console.log('💡 Solution: Change to "Relaxed IP restrictions" for development');
      hasIssues = true;
    }
    
    // Check callback URLs
    const expectedCallbacks = [
      'http://localhost:3000/api/auth/callback/salesforce',
      'http://localhost:3000/api/auth/oauth2/callback/salesforce'
    ];
    
    const hasValidCallback = expectedCallbacks.some(expected => 
      appInfo.callbackUrls.some(actual => actual.includes(expected))
    );
    
    if (!hasValidCallback && appInfo.callbackUrls.length > 0) {
      console.log('⚠️  CALLBACK URL MISMATCH!');
      console.log('   Expected one of:', expectedCallbacks);
      console.log('   Found:', appInfo.callbackUrls);
      hasIssues = true;
    }
    
    if (!hasIssues) {
      console.log('✅ No obvious configuration issues found');
      console.log('   The OAuth error may be due to:');
      console.log('   - User not being assigned to required permission sets');
      console.log('   - Network/firewall issues');
      console.log('   - Temporary Salesforce service issues');
    }

    // Try to find Edit/Manage buttons to access configuration
    console.log('\n🔧 Looking for edit options...');
    
    const editButtons = await page.$$('input[value*="Edit"], a[title*="Edit"], button[title*="Edit"], a:contains("Edit Policies")');
    console.log(`Found ${editButtons.length} potential edit buttons`);
    
    if (editButtons.length > 0) {
      console.log('💡 You can manually click on edit buttons in the browser window to modify settings');
    }

    // Save detailed content for manual review
    await page.evaluate(() => {
      // Scroll to show all content
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await wait(1000);
    await page.screenshot({ path: 'connected-app-full-details.png', fullPage: true });
    console.log('📸 Full screenshot saved: connected-app-full-details.png');

    console.log('\n✅ Connected App inspection completed');
    console.log('📄 Check the screenshots for visual confirmation of settings');

  } catch (error) {
    console.log(`💥 Script failed: ${error.message}`);
    await page.screenshot({ path: 'inspection-error.png' });
  }

  console.log('\n🏁 Script completed. Browser will remain open for 30 seconds for manual inspection...');
  setTimeout(async () => {
    await browser.close();
  }, 30000);
})(); 