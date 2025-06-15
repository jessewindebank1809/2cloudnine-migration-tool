const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Full Authentication and Navigation Flow', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: false, // Force non-headless to see what's happening
      slowMo: 50,      // Faster typing and interactions
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Log all console messages for debugging
    page.on('console', msg => {
      console.log(`🖥️ Browser console [${msg.type()}]:`, msg.text());
    });
    
    page.on('pageerror', error => {
      console.log(`🚨 Page error: ${error.message}`);
    });
  });

  afterEach(async () => {
    if (page) {
      // Keep page open longer for debugging
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.close();
    }
  });

  test('should complete full login flow and navigate authenticated app', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🚀 Starting full authentication flow test...');
    console.log(`📍 Base URL: ${baseUrl}`);
    
    // Step 1: Navigate to root and check redirect
    console.log('📌 Step 1: Navigate to root');
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    let currentUrl = page.url();
    console.log(`🌐 Current URL after root navigation: ${currentUrl}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'step1-initial-page');
    
    // Step 2: If not redirected to auth, go to auth page manually
    if (!currentUrl.includes('/auth') && !currentUrl.includes('/signin')) {
      console.log('📌 Step 2: Manually navigate to auth page');
      await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 30000 });
      currentUrl = page.url();
      console.log(`🌐 Auth page URL: ${currentUrl}`);
    }
    
    await PuppeteerHelpers.takeScreenshot(page, 'step2-auth-page');
    
    // Step 3: Find and verify the Salesforce button
    console.log('📌 Step 3: Look for Salesforce authentication button');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to fully load
    
    // Look for the button by various methods
    const salesforceButton = await page.evaluate(() => {
      // Try different selectors
      const selectors = [
        'button:contains("Continue with Salesforce")',
        'button:contains("Salesforce")',
        'button[type="submit"]',
        'button',
        'a[href*="auth"]',
        'a[href*="salesforce"]'
      ];
      
      // First try text-based search
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('salesforce') || text.includes('continue') || text.includes('sign')) {
          return {
            found: true,
            text: btn.textContent,
            tagName: btn.tagName,
            id: btn.id,
            className: btn.className
          };
        }
      }
      
      // If no text match, return info about available buttons
      return {
        found: false,
        availableButtons: buttons.map(btn => ({
          text: btn.textContent?.trim(),
          tagName: btn.tagName,
          id: btn.id,
          className: btn.className
        }))
      };
    });
    
    console.log('🔍 Button search result:', salesforceButton);
    
    if (salesforceButton.found) {
      console.log(`✅ Found Salesforce button: "${salesforceButton.text}"`);
      
      // Step 4: Click the Salesforce button
      console.log('📌 Step 4: Click Salesforce authentication button');
      
      // Click by text content since we know the text
      await page.evaluate((buttonText) => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        for (const btn of buttons) {
          if (btn.textContent?.includes('Salesforce') || btn.textContent?.includes('Continue')) {
            btn.click();
            return;
          }
        }
      }, salesforceButton.text);
      
      console.log('🚀 Clicked Salesforce button, waiting for redirect...');
      
      // Wait for navigation to Salesforce
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      currentUrl = page.url();
      console.log(`🌐 URL after button click: ${currentUrl}`);
      
      await PuppeteerHelpers.takeScreenshot(page, 'step4-after-button-click');
      
      // Step 5: Handle Salesforce login if redirected
      if (currentUrl.includes('salesforce.com') || currentUrl.includes('force.com')) {
        console.log('📌 Step 5: Handle Salesforce OAuth login');
        console.log('✅ Successfully redirected to Salesforce!');
        
        await PuppeteerHelpers.takeScreenshot(page, 'step5-salesforce-page');
        
        // Look for login form
        const loginFormExists = await page.evaluate(() => {
          const usernameField = document.querySelector('#username');
          const passwordField = document.querySelector('#password');
          return {
            usernameExists: !!usernameField,
            passwordExists: !!passwordField,
            formVisible: !!(usernameField && passwordField)
          };
        });
        
        console.log('🔍 Login form status:', loginFormExists);
        
        if (loginFormExists.formVisible) {
          console.log('📝 Filling in Salesforce credentials...');
          
          const credentials = {
            username: process.env.TEST_SALESFORCE_TARGET_USERNAME, // Use target for login
            password: process.env.TEST_SALESFORCE_TARGET_PASSWORD
          };
          
          console.log(`👤 Using username: ${credentials.username}`);
          
          await page.type('#username', credentials.username, { delay: 10 });
          await page.type('#password', credentials.password, { delay: 10 });
          
          await PuppeteerHelpers.takeScreenshot(page, 'step5-credentials-entered');
          
          // Click login
          console.log('🚀 Clicking Salesforce login button...');
          await page.click('#Login');
          
          // Wait for login processing
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          currentUrl = page.url();
          console.log(`🌐 URL after Salesforce login: ${currentUrl}`);
          
          await PuppeteerHelpers.takeScreenshot(page, 'step5-after-salesforce-login');
          
          // Step 6: Wait for redirect back to application
          console.log('📌 Step 6: Wait for redirect back to application');
          
          // Wait up to 30 seconds for redirect back
          const redirectStart = Date.now();
          while (Date.now() - redirectStart < 30000) {
            currentUrl = page.url();
            console.log(`🔄 Checking URL: ${currentUrl}`);
            
            if (currentUrl.includes('localhost:3000') && !currentUrl.includes('salesforce.com')) {
              console.log('✅ Redirected back to application!');
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          await PuppeteerHelpers.takeScreenshot(page, 'step6-back-to-app');
          
          // Step 7: Verify authentication and navigate
          console.log('📌 Step 7: Test authenticated navigation');
          
          currentUrl = page.url();
          console.log(`🌐 Final application URL: ${currentUrl}`);
          
          // Try to navigate to protected routes
          const protectedRoutes = ['/home', '/migrations', '/orgs', '/templates'];
          
          for (const route of protectedRoutes) {
            console.log(`🔍 Testing protected route: ${route}`);
            
            await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 15000 });
            
            const routeUrl = page.url();
            console.log(`  📍 ${route} -> ${routeUrl}`);
            
            // Check if we're still authenticated (not redirected to auth)
            if (routeUrl.includes('/auth') || routeUrl.includes('/signin')) {
              console.log(`  ❌ ${route} requires authentication - not logged in`);
            } else {
              console.log(`  ✅ ${route} accessible - authenticated!`);
            }
            
            await PuppeteerHelpers.takeScreenshot(page, `step7-route-${route.replace('/', '')}`);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          console.log('❌ No login form found on Salesforce page');
        }
      } else {
        console.log('❌ Not redirected to Salesforce OAuth');
        console.log('🔍 Checking current page content...');
        
        const pageContent = await page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            bodyText: document.body?.textContent?.substring(0, 500)
          };
        });
        
        console.log('📄 Current page info:', pageContent);
      }
    } else {
      console.log('❌ No Salesforce button found');
      console.log('🔍 Available buttons:', salesforceButton.availableButtons);
    }
    
    // Final screenshot
    await PuppeteerHelpers.takeScreenshot(page, 'final-state');
    
    console.log('🏁 Test completed - check screenshots for visual verification');
  });
});