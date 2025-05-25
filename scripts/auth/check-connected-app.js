const puppeteer = require('puppeteer');

const SALESFORCE_CREDENTIALS = {
  username: 'test-r0fxwq8cftxy@example.com',
  password: 'p]3cnaozcetRi',
  orgUrl: 'https://site-site-6377-dev-ed.scratch.my.salesforce.com'
};

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🚀 Starting Connected App inspection...');
  
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
    if (type === 'log' || type === 'error' || type === 'warn') {
      console.log(`🌐 Browser Console [${type}]:`, msg.text());
    }
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
  });

  try {
    console.log('🌐 Navigating to Salesforce login...');
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for login form
    await page.waitForSelector('#username', { timeout: 10000 });
    console.log('📝 Found login form, entering credentials...');

    // Fill in credentials
    await page.type('#username', SALESFORCE_CREDENTIALS.username);
    await page.type('#password', SALESFORCE_CREDENTIALS.password);

    // Click login
    console.log('🔐 Logging in...');
    await page.click('#Login');

    // Wait for successful login and navigation
    console.log('⏳ Waiting for login to complete...');
    await wait(5000);

    // Check if we're logged in by looking for Salesforce UI elements
    const isLoggedIn = await page.$('.setupGear, .slds-icon-waffle, [title="App Launcher"], .forceHeaderButton');
    if (isLoggedIn) {
      console.log('✅ Successfully logged in!');
    } else {
      console.log('⚠️ Login status unclear, continuing...');
      await page.screenshot({ path: 'login-result.png' });
    }

    // Navigate to App Manager directly
    console.log('📱 Navigating directly to App Manager...');
    
    // Try Lightning Experience URL
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl + '/lightning/setup/ConnectedApplication/home', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    
    await wait(3000);

    // Take screenshot of App Manager
    await page.screenshot({ path: 'app-manager.png', fullPage: true });
    console.log('📸 Screenshot saved: app-manager.png');

    // Look for Connected Apps in the page
    console.log('🔍 Looking for Connected Apps...');
    
    // Extract all visible text to find apps
    const pageText = await page.evaluate(() => document.body.innerText);
    
    // Look for our Connected App (check if any of these appear in the page text)
    const possibleAppNames = [
      'TC9 Migration Tool',
      '2cloudnine Migration Tool', 
      'TC9_Migration_Tool',
      'Migration Tool'
    ];

    let foundAppName = null;
    for (const appName of possibleAppNames) {
      if (pageText.includes(appName)) {
        foundAppName = appName;
        console.log(`📱 Found Connected App in page text: ${appName}`);
        break;
      }
    }

    if (foundAppName) {
      // Try to click on the app name
      try {
        const appLink = await page.$x(`//a[contains(text(), "${foundAppName}")]`);
        if (appLink.length > 0) {
          console.log(`🖱️ Clicking on ${foundAppName}...`);
          await appLink[0].click();
          await wait(3000);
          
          await page.screenshot({ path: 'connected-app-details.png', fullPage: true });
          console.log('📸 Screenshot saved: connected-app-details.png');
          
          // Look for Manage button
          const manageLink = await page.$x('//a[contains(text(), "Manage") or contains(text(), "View")]');
          if (manageLink.length > 0) {
            console.log('🔧 Found Manage/View button, clicking...');
            await manageLink[0].click();
            await wait(3000);
            
            await page.screenshot({ path: 'connected-app-manage.png', fullPage: true });
            console.log('📸 Screenshot saved: connected-app-manage.png');
            
            // Look for Edit Policies
            const editPoliciesLink = await page.$x('//a[contains(text(), "Edit Policies")]');
            if (editPoliciesLink.length > 0) {
              console.log('📝 Found Edit Policies, clicking...');
              await editPoliciesLink[0].click();
              await wait(3000);
              
              await page.screenshot({ path: 'connected-app-policies.png', fullPage: true });
              console.log('📸 Screenshot saved: connected-app-policies.png');
              
              // Extract OAuth policy settings
              console.log('📊 Extracting OAuth policy information...');
              const policies = await page.evaluate(() => {
                const content = document.body.innerText;
                const settings = {};
                
                // Check user settings
                if (content.includes('Admin approved users are pre-authorized')) {
                  settings.userPolicy = 'Admin approved users are pre-authorized';
                } else if (content.includes('All users may self-authorize')) {
                  settings.userPolicy = 'All users may self-authorize';
                }
                
                // Check IP settings  
                if (content.includes('Relaxed IP restrictions')) {
                  settings.ipPolicy = 'Relaxed IP restrictions';
                } else if (content.includes('Enforce IP restrictions')) {
                  settings.ipPolicy = 'Enforce IP restrictions';
                }
                
                // Look for callback URLs
                const callbackMatches = content.match(/http[s]?:\/\/[^\s]+callback[^\s]*/gi);
                if (callbackMatches) {
                  settings.callbackUrls = callbackMatches;
                }
                
                return settings;
              });
              
              console.log('📋 OAuth Policy Settings:');
              console.log('👥 User Policy:', policies.userPolicy || 'Not found');
              console.log('🌐 IP Policy:', policies.ipPolicy || 'Not found');
              console.log('🔗 Callback URLs:', policies.callbackUrls || 'Not found');
              
              // Check if this could be causing the OAuth error
              if (policies.userPolicy === 'Admin approved users are pre-authorized') {
                console.log('⚠️  POTENTIAL ISSUE: Connected App requires admin approval');
                console.log('💡 Solution: Either change to "All users may self-authorize" or assign user to permission set');
              }
              
              if (policies.ipPolicy === 'Enforce IP restrictions') {
                console.log('⚠️  POTENTIAL ISSUE: IP restrictions are enforced');
                console.log('💡 Solution: Change to "Relaxed IP restrictions" for development');
              }
              
            } else {
              console.log('❌ Could not find Edit Policies button');
            }
          } else {
            console.log('❌ Could not find Manage/View button');
          }
        }
      } catch (error) {
        console.log('⚠️ Error clicking app link:', error.message);
      }
    } else {
      console.log('❌ No Connected App found with expected names');
      console.log('📄 Page contains text:', pageText.substring(0, 500) + '...');
      
      // Try to find any connected apps at all
      const allAppsText = pageText.match(/[\w\s]+App[\w\s]*/g);
      if (allAppsText) {
        console.log('📋 Found apps-related text:', allAppsText.slice(0, 10));
      }
    }

    console.log('✅ Connected App inspection completed');

  } catch (error) {
    console.log(`💥 Script failed: ${error.message}`);
    await page.screenshot({ path: 'error-screenshot.png' });
  }

  console.log('🏁 Script completed. Browser will close in 15 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 15000);
})(); 