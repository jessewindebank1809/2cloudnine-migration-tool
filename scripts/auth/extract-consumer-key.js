const puppeteer = require('puppeteer');

const SALESFORCE_CREDENTIALS = {
  username: 'test-r0fxwq8cftxy@example.com',
  password: 'p]3cnaozcetRi',
  orgUrl: 'https://site-site-6377-dev-ed.scratch.my.salesforce.com'
};

// The actual Connected App ID from our SF CLI query
const CORRECT_APP_ID = '0H4AD000000qhP30AI';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🔍 Extracting Consumer Key from the correct Connected App...');
  console.log('📱 App ID:', CORRECT_APP_ID);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  try {
    // Login
    console.log('🔐 Logging in to Salesforce...');
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl);
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', SALESFORCE_CREDENTIALS.username);
    await page.type('#password', SALESFORCE_CREDENTIALS.password);
    await page.click('#Login');
    await wait(5000);

    // Navigate to the correct Connected App using the ID from SF CLI
    const appUrl = `${SALESFORCE_CREDENTIALS.orgUrl}/app/mgmt/forceconnectedapps/forceAppDetail.apexp?applicationId=${CORRECT_APP_ID}`;
    console.log('📱 Navigating to Connected App:', appUrl);
    
    await page.goto(appUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(3000);

    // Extract all text content to find the Consumer Key
    const appData = await page.evaluate(() => {
      const content = document.body.innerText;
      const html = document.body.innerHTML;
      
      // Multiple patterns to find Consumer Key
      const patterns = [
        /Consumer Key[\s\n:]*([A-Za-z0-9._]{50,})/i,
        /Client ID[\s\n:]*([A-Za-z0-9._]{50,})/i,
        /(3MVG[A-Za-z0-9._]{80,})/g,
        /Consumer Key.*?([A-Za-z0-9._]{80,})/i
      ];
      
      const results = [];
      
      patterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches) {
          results.push({
            pattern: `Pattern ${index + 1}`,
            found: matches[1] || matches[0]
          });
        }
      });
      
      // Also check for any 3MVG strings in the HTML
      const mvgMatches = html.match(/3MVG[A-Za-z0-9._]{80,}/g);
      if (mvgMatches) {
        mvgMatches.forEach(match => {
          results.push({
            pattern: 'HTML content',
            found: match
          });
        });
      }
      
      return {
        results,
        contentPreview: content.substring(0, 1000)
      };
    });

    console.log('\n🔑 Consumer Key Search Results:');
    
    // Remove duplicates
    const uniqueKeys = [...new Set(appData.results.map(r => r.found))];
    
    if (uniqueKeys.length > 0) {
      uniqueKeys.forEach((key, index) => {
        console.log(`${index + 1}. ${key}`);
      });
      
      // Find the most likely Consumer Key (longest 3MVG string)
      const candidates = uniqueKeys.filter(key => key.startsWith('3MVG') && key.length > 50);
      
      if (candidates.length > 0) {
        const actualConsumerKey = candidates.reduce((a, b) => a.length > b.length ? a : b);
        
        console.log('\n✅ Actual Consumer Key:', actualConsumerKey);
        
        // Compare with environment variable
        const envClientId = process.env.SALESFORCE_CLIENT_ID || 'NOT_SET';
        console.log('📄 Environment Variable:', envClientId);
        
        if (actualConsumerKey === envClientId) {
          console.log('✅ CLIENT ID MATCHES - This is not the issue');
        } else {
          console.log('❌ CLIENT ID MISMATCH - This is likely the problem!');
          console.log('\n💡 Solution: Update your .env.local file:');
          console.log(`SALESFORCE_CLIENT_ID="${actualConsumerKey}"`);
          console.log(`NEXT_PUBLIC_SALESFORCE_CLIENT_ID="${actualConsumerKey}"`);
        }
      } else {
        console.log('❌ No valid Consumer Key found');
      }
    } else {
      console.log('❌ No Consumer Key found on page');
      console.log('📄 Page content preview:', appData.contentPreview);
    }

    // Take screenshot for manual verification
    await page.screenshot({ path: 'consumer-key-page.png', fullPage: true });
    console.log('\n📸 Screenshot saved: consumer-key-page.png');

  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
    await page.screenshot({ path: 'consumer-key-error.png' });
  }

  console.log('\n🏁 Consumer Key extraction completed.');
  console.log('Browser will close in 15 seconds...');
  setTimeout(async () => {
    await browser.close();
  }, 15000);
})(); 