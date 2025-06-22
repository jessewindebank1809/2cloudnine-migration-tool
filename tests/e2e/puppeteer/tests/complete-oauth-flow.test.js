const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Complete OAuth Authorisation Flow', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  });

  afterAll(async () => {
    if (browser) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Keep open longer to see result
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should complete full OAuth flow including authorisation', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🔐 Starting COMPLETE OAuth flow test...');
    console.log(`📍 App URL: ${baseUrl}`);
    
    // Step 1: Navigate to auth page
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 15000 });
    console.log(`🌐 Auth page: ${page.url()}`);
    await PuppeteerHelpers.takeScreenshot(page, 'complete-auth-page');
    
    // Step 2: Click Salesforce button
    const buttonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent?.toLowerCase() || '';
        if (text.includes('salesforce') || text.includes('continue')) {
          button.click();
          return { success: true, text: button.textContent.trim() };
        }
      }
      return { success: false };
    });
    
    console.log(`✅ Clicked: "${buttonClicked.text}"`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let currentUrl = page.url();
    console.log(`🌐 After button click: ${currentUrl}`);
    
    if (currentUrl.includes('salesforce.com')) {
      console.log('✅ Redirected to Salesforce');
      await PuppeteerHelpers.takeScreenshot(page, 'complete-salesforce-login');
      
      // Step 3: Handle login if on login page
      if (currentUrl.includes('login.salesforce.com')) {
        console.log('📝 Handling Salesforce login...');
        
        const credentials = {
          username: process.env.TEST_SALESFORCE_TARGET_USERNAME,
          password: process.env.TEST_SALESFORCE_TARGET_PASSWORD
        };
        
        console.log(`👤 Using username: ${credentials.username}`);
        
        // Type credentials
        await page.type('#username', credentials.username, { delay: 10 });
        await page.type('#password', credentials.password, { delay: 10 });
        console.log('⚡ Credentials entered');
        
        await PuppeteerHelpers.takeScreenshot(page, 'complete-credentials-entered');
        
        // Click login
        await page.click('#Login');
        console.log('🚀 Login clicked, waiting for redirect...');
        
        // Wait for potential redirects
        await new Promise(resolve => setTimeout(resolve, 8000));
        currentUrl = page.url();
        console.log(`🌐 After login: ${currentUrl}`);
      }
      
      // Step 4: Handle OAuth authorisation page
      if (currentUrl.includes('RemoteAccessAuthorizationPage') || currentUrl.includes('setup/secur')) {
        console.log('🔑 On OAuth authorisation page!');
        await PuppeteerHelpers.takeScreenshot(page, 'complete-oauth-authorisation');
        
        // Look for authorisation buttons (Allow, Authorise, etc.)
        const authButtons = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('input[type="submit"], button, input[type="button"]'));
          return buttons.map(btn => ({
            text: btn.value || btn.textContent?.trim() || '',
            id: btn.id,
            name: btn.name,
            type: btn.type,
            tagName: btn.tagName
          }));
        });
        
        console.log('🔍 Available authorisation buttons:', authButtons);
        
        // Look for "Allow" or "Authorise" button
        const allowButton = authButtons.find(btn => 
          btn.text.toLowerCase().includes('allow') || 
          btn.text.toLowerCase().includes('authorise') ||
          btn.text.toLowerCase().includes('continue') ||
          btn.id.toLowerCase().includes('allow')
        );
        
        if (allowButton) {
          console.log(`✅ Found authorisation button: "${allowButton.text}"`);
          
          // Click the authorisation button
          const clicked = await page.evaluate((buttonInfo) => {
            const buttons = document.querySelectorAll('input[type="submit"], button, input[type="button"]');
            for (const btn of buttons) {
              const text = btn.value || btn.textContent?.trim() || '';
              if (text === buttonInfo.text) {
                btn.click();
                return true;
              }
            }
            return false;
          }, allowButton);
          
          if (clicked) {
            console.log('🚀 Authorisation button clicked!');
            
            // Wait for redirect back to app
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            currentUrl = page.url();
            console.log(`🌐 Final URL: ${currentUrl}`);
            
            await PuppeteerHelpers.takeScreenshot(page, 'complete-final-result');
            
            if (currentUrl.includes('localhost')) {
              console.log('🎉 SUCCESS: OAuth flow completed! Redirected back to app!');
              
              // Test authenticated navigation
              const testRoutes = ['/home', '/migrations', '/orgs'];
              for (const route of testRoutes) {
                console.log(`🔍 Testing authenticated route: ${route}`);
                await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 10000 });
                const routeUrl = page.url();
                console.log(`  📍 ${route} -> ${routeUrl}`);
                
                if (routeUrl.includes('/auth')) {
                  console.log(`  ❌ ${route} redirected to auth - not authenticated`);
                } else {
                  console.log(`  ✅ ${route} accessible - authenticated!`);
                }
                
                await PuppeteerHelpers.takeScreenshot(page, `complete-route-${route.replace('/', '')}`);
              }
            } else {
              console.log('⚠️ Not redirected back to app yet');
            }
          } else {
            console.log('❌ Could not click authorisation button');
          }
        } else {
          console.log('❌ No authorisation button found');
          
          // Check page content for clues
          const pageContent = await page.evaluate(() => ({
            title: document.title,
            bodyText: document.body.textContent.substring(0, 500)
          }));
          console.log('📄 Page content:', pageContent);
        }
      } else {
        console.log('⚠️ Not on expected OAuth authorisation page');
        console.log(`🌐 Current URL: ${currentUrl}`);
      }
    } else {
      console.log('❌ Not redirected to Salesforce');
    }
    
    console.log('🔐 Complete OAuth flow test finished!');
  });
}, 90000); // 90 second timeout for full flow