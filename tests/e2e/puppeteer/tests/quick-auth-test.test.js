const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Quick Authentication Speed Test', () => {
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
      slowMo: 50,      // Fast interactions
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  });

  afterAll(async () => {
    if (browser) {
      await new Promise(resolve => setTimeout(resolve, 3000));
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

  test('should demonstrate fast OAuth flow to Salesforce login', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('⚡ Testing FAST OAuth flow...');
    console.log(`📍 App URL: ${baseUrl}`);
    
    // Navigate to auth page
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    let currentUrl = page.url();
    console.log(`🌐 Auth page: ${currentUrl}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'fast-auth-page');
    
    // Find and click Salesforce button
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
    
    if (buttonClicked.success) {
      console.log(`✅ Clicked: "${buttonClicked.text}"`);
      
      // Wait for redirect to Salesforce
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      currentUrl = page.url();
      console.log(`🌐 Redirected to: ${currentUrl}`);
      
      if (currentUrl.includes('salesforce.com')) {
        console.log('✅ OAuth redirect working!');
        
        await PuppeteerHelpers.takeScreenshot(page, 'fast-salesforce-page');
        
        // Check for login form
        const hasLoginForm = await page.evaluate(() => {
          return {
            username: !!document.querySelector('#username'),
            password: !!document.querySelector('#password'),
            loginBtn: !!document.querySelector('#Login')
          };
        });
        
        console.log('🔍 Login form elements:', hasLoginForm);
        
        if (hasLoginForm.username && hasLoginForm.password) {
          console.log('⚡ Starting FAST credential entry...');
          
          const startTime = Date.now();
          
          const credentials = {
            username: process.env.TEST_SALESFORCE_TARGET_USERNAME, // Use target for login
            password: process.env.TEST_SALESFORCE_TARGET_PASSWORD
          };
          
          // Fast typing with minimal delay
          await page.type('#username', credentials.username, { delay: 10 });
          await page.type('#password', credentials.password, { delay: 10 });
          
          const typingTime = Date.now() - startTime;
          console.log(`⚡ Credentials entered in ${typingTime}ms`);
          
          await PuppeteerHelpers.takeScreenshot(page, 'fast-credentials-entered');
          
          // Click login button
          console.log('🚀 Clicking login button...');
          await page.click('#Login');
          
          // Wait to see what happens
          await new Promise(resolve => setTimeout(resolve, 8000));
          
          const finalUrl = page.url();
          console.log(`🌐 Final URL: ${finalUrl}`);
          
          await PuppeteerHelpers.takeScreenshot(page, 'fast-login-result');
          
          if (finalUrl.includes('localhost')) {
            console.log('🎉 SUCCESS: Redirected back to app!');
          } else if (finalUrl.includes('salesforce.com')) {
            console.log('⚠️ Still on Salesforce - OAuth callback issue');
            
            // Check page content for any error messages
            const pageContent = await page.evaluate(() => {
              return {
                title: document.title,
                hasError: document.body.textContent.toLowerCase().includes('error'),
                bodySnippet: document.body.textContent.substring(0, 200)
              };
            });
            
            console.log('📄 Salesforce page info:', pageContent);
          }
        } else {
          console.log('❌ Login form not found');
        }
      } else {
        console.log('❌ Not redirected to Salesforce');
      }
    } else {
      console.log('❌ Salesforce button not found');
    }
    
    console.log('⚡ Fast authentication test completed!');
  });
}, 45000); // 45 second timeout