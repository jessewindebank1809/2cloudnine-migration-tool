const puppeteer = require('puppeteer');

const SALESFORCE_CREDENTIALS = {
  username: 'test-r0fxwq8cftxy@example.com',
  password: 'p]3cnaozcetRi',
  orgUrl: 'https://site-site-6377-dev-ed.scratch.my.salesforce.com'
};

const CONNECTED_APP_URL = 'https://site-site-6377-dev-ed.scratch.my.salesforce.com/app/mgmt/forceconnectedapps/forceAppDetail.apexp?applicationId=06PAD000000c4NZ&applicationId=06PAD000000c4NZ&id=0CiAD0000006Kgn';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log('🔍 Extracting Client ID from Connected App...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  try {
    // Login
    await page.goto(SALESFORCE_CREDENTIALS.orgUrl);
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', SALESFORCE_CREDENTIALS.username);
    await page.type('#password', SALESFORCE_CREDENTIALS.password);
    await page.click('#Login');
    await wait(5000);

    // Navigate to Connected App
    await page.goto(CONNECTED_APP_URL);
    await wait(3000);

    // Extract Client ID more precisely
    const clientIdInfo = await page.evaluate(() => {
      const pageText = document.body.innerText;
      const pageHTML = document.body.innerHTML;
      
      // Multiple patterns to find Consumer Key/Client ID
      const patterns = [
        /Consumer Key[\s\n]*([A-Za-z0-9._]{15,})/i,
        /Client ID[\s\n]*([A-Za-z0-9._]{15,})/i,
        /3MVG[A-Za-z0-9._]{80,}/g,
        /Consumer Key.*?([A-Za-z0-9._]{80,})/i
      ];
      
      const results = [];
      
      patterns.forEach((pattern, index) => {
        const match = pageText.match(pattern);
        if (match) {
          results.push({
            pattern: index + 1,
            found: match[1] || match[0]
          });
        }
      });
      
      // Also check HTML for input values or hidden fields
      const inputElements = document.querySelectorAll('input, span, td');
      for (const element of inputElements) {
        const text = element.textContent || element.value || '';
        if (text.length > 50 && text.match(/^3MVG/)) {
          results.push({
            pattern: 'HTML element',
            found: text
          });
        }
      }
      
      return {
        results,
        pagePreview: pageText.substring(0, 1000)
      };
    });

    console.log('\n🔑 Client ID Search Results:');
    
    if (clientIdInfo.results.length > 0) {
      clientIdInfo.results.forEach((result, index) => {
        console.log(`${index + 1}. Pattern ${result.pattern}: ${result.found}`);
      });
      
      // Find the most likely candidate (longest 3MVG string)
      const candidates = clientIdInfo.results
        .map(r => r.found)
        .filter(id => id.startsWith('3MVG') && id.length > 50);
      
      if (candidates.length > 0) {
        const bestCandidate = candidates.reduce((a, b) => a.length > b.length ? a : b);
        console.log('\n✅ Most likely Client ID:', bestCandidate);
        console.log('\n📝 Update your .env.local:');
        console.log(`SALESFORCE_CLIENT_ID="${bestCandidate}"`);
        console.log(`NEXT_PUBLIC_SALESFORCE_CLIENT_ID="${bestCandidate}"`);
      }
    } else {
      console.log('❌ No Client ID found. Page preview:');
      console.log(clientIdInfo.pagePreview);
    }

  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }

  await browser.close();
})(); 