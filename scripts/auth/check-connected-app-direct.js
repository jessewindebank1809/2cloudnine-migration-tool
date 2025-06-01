const puppeteer = require('puppeteer');

const SALESFORCE_CREDENTIALS = {
  username: 'test-r0fxwq8cftxy@example.com',
  password: 'p]3cnaozcetRi',
  orgUrl: 'https://site-site-6377-dev-ed.scratch.my.salesforce.com'
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🚀 Starting Connected App direct inspection...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();

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

    // Navigate directly to Manage Connected Apps
    console.log('📱 Navigating to Manage Connected Apps...');
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl + '/lightning/setup/ConnectedAppsOAuth/home', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    
    await wait(3000);
    await page.screenshot({ path: 'manage-connected-apps.png', fullPage: true });
    console.log('📸 Screenshot saved: manage-connected-apps.png');

    // Get page text to see what's available
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('📄 Page text preview:', pageText.substring(0, 1000));

    // Look for any Connected Apps
    const appLinks = await page.$$('a[title*="App"], a[title*="TC9"], a[title*="Migration"], a[href*="ConnectedApplication"]');
    
    if (appLinks.length > 0) {
      console.log(`🔍 Found ${appLinks.length} potential Connected App links`);
      
      for (let i = 0; i < Math.min(appLinks.length, 5); i++) {
        const linkText = await page.evaluate(el => el.textContent || el.title || el.href, appLinks[i]);
        console.log(`📱 Link ${i + 1}: ${linkText}`);
        
        // If this looks like our app, click it
        if (linkText.includes('TC9') || linkText.includes('Migration') || linkText.includes('2cloudnine')) {
          console.log(`🖱️ Clicking on potential app: ${linkText}`);
          await appLinks[i].click();
          await wait(3000);
          
          await page.screenshot({ path: `app-details-${i}.png`, fullPage: true });
          console.log(`📸 Screenshot saved: app-details-${i}.png`);
          
          // Check if this is the right app by looking for OAuth settings
          const hasOAuth = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('oauth') || text.includes('callback') || text.includes('client id');
          });
          
          if (hasOAuth) {
            console.log('✅ Found OAuth-related content, this might be our Connected App!');
            
            // Look for Edit or Manage buttons
            const editButtons = await page.$$('button, a');
            for (const button of editButtons) {
              const buttonText = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
              if (buttonText.includes('edit') || buttonText.includes('manage') || buttonText.includes('policies')) {
                console.log(`🔧 Found button: ${buttonText}`);
              }
            }
            
            break;
          }
        }
      }
    } else {
      console.log('❌ No Connected App links found');
      
      // Try alternative: look for any apps in a table or list
      const tableRows = await page.$$('tr, .slds-table__row, .listViewContent tr');
      console.log(`📊 Found ${tableRows.length} table rows to check`);
      
      for (let i = 0; i < Math.min(tableRows.length, 10); i++) {
        const rowText = await page.evaluate(el => el.textContent, tableRows[i]);
        if (rowText && (rowText.includes('TC9') || rowText.includes('Migration') || rowText.includes('2cloudnine'))) {
          console.log(`📱 Found potential app in row: ${rowText.substring(0, 100)}`);
        }
      }
    }

    // Also try the classic URL as backup
    console.log('🔄 Trying classic Connected Apps URL...');
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl + '/02u?setupid=ConnectedApplication', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    
    await wait(3000);
    await page.screenshot({ path: 'classic-connected-apps.png', fullPage: true });
    console.log('📸 Screenshot saved: classic-connected-apps.png');

    const classicPageText = await page.evaluate(() => document.body.innerText);
    console.log('📄 Classic page text preview:', classicPageText.substring(0, 500));

    // Look for our app in classic view
    if (classicPageText.includes('TC9') || classicPageText.includes('Migration') || classicPageText.includes('2cloudnine')) {
      console.log('✅ Found potential Connected App in classic view!');
      
      // Try to find and click the app link
      const classicAppLink = await page.$x('//a[contains(text(), "TC9") or contains(text(), "Migration") or contains(text(), "2cloudnine")]');
      if (classicAppLink.length > 0) {
        console.log('🖱️ Clicking on app in classic view...');
        await classicAppLink[0].click();
        await wait(3000);
        
        await page.screenshot({ path: 'classic-app-details.png', fullPage: true });
        console.log('📸 Screenshot saved: classic-app-details.png');
      }
    }

    console.log('✅ Connected App inspection completed');

  } catch (error) {
    console.log(`💥 Script failed: ${error.message}`);
    await page.screenshot({ path: 'error-screenshot.png' });
  }

  console.log('🏁 Script completed. Browser will close in 20 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 20000);
})(); 