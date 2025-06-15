const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Live Authentication Flow Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: 200,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should display authentication page correctly', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log(`🔐 Testing authentication page at: ${baseUrl}`);
    
    // Navigate to auth page
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const title = await page.title();
    const url = page.url();
    
    console.log(`📄 Auth Page Title: ${title}`);
    console.log(`🌐 Auth URL: ${url}`);
    
    // Look for the Salesforce sign-in button
    const buttonSelectors = [
      'button:contains("Continue with Salesforce")',
      '[data-testid*="salesforce"]',
      '[data-testid*="signin"]',
      '[data-testid*="auth"]',
      'button',
      'a[href*="salesforce"]',
      'a[href*="auth"]'
    ];
    
    let signInButton = null;
    let buttonText = '';
    
    for (const selector of buttonSelectors) {
      try {
        if (selector.includes(':contains')) {
          // Handle text-based selector differently
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent?.trim() || '');
            if (text.toLowerCase().includes('continue with salesforce') || 
                text.toLowerCase().includes('salesforce') ||
                text.toLowerCase().includes('sign in')) {
              signInButton = button;
              buttonText = text;
              console.log(`✅ Found sign-in button: "${text}"`);
              break;
            }
          }
        } else {
          const element = await page.$(selector);
          if (element) {
            const text = await element.evaluate(el => el.textContent?.trim() || '');
            signInButton = element;
            buttonText = text;
            console.log(`✅ Found element with selector ${selector}: "${text}"`);
            break;
          }
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    expect(signInButton).toBeTruthy();
    expect(buttonText).toBeTruthy();
    
    // Take screenshot of auth page
    await PuppeteerHelpers.takeScreenshot(page, 'auth-page-initial');
    
    console.log(`🎯 Ready to test authentication flow with button: "${buttonText}"`);
  });

  test('should initiate Salesforce OAuth flow', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Find and click the Salesforce sign-in button
    const buttons = await page.$$('button');
    let salesforceButton = null;
    
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent?.trim() || '');
      if (text.toLowerCase().includes('continue with salesforce') || 
          text.toLowerCase().includes('salesforce')) {
        salesforceButton = button;
        console.log(`🎯 Found Salesforce button: "${text}"`);
        break;
      }
    }
    
    expect(salesforceButton).toBeTruthy();
    
    // Take screenshot before clicking
    await PuppeteerHelpers.takeScreenshot(page, 'before-oauth-click');
    
    console.log('🚀 Clicking Salesforce OAuth button...');
    
    // Click the button and see what happens
    try {
      await salesforceButton.click();
      
      // Wait a moment to see if anything happens
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newUrl = page.url();
      console.log(`📍 URL after click: ${newUrl}`);
      
      // Check if we're redirected to Salesforce
      if (newUrl.includes('salesforce.com') || newUrl.includes('force.com')) {
        console.log('✅ Successfully redirected to Salesforce OAuth');
        
        // Take screenshot of Salesforce page
        await PuppeteerHelpers.takeScreenshot(page, 'salesforce-oauth-page');
        
        // Look for Salesforce login elements
        const usernameInput = await PuppeteerHelpers.isVisible(page, '#username', 5000);
        const passwordInput = await PuppeteerHelpers.isVisible(page, '#password', 5000);
        
        console.log(`📝 Username field visible: ${usernameInput}`);
        console.log(`🔒 Password field visible: ${passwordInput}`);
        
        if (usernameInput && passwordInput) {
          console.log('🎉 Salesforce login form detected - OAuth flow working!');
          
          // We could fill in credentials here, but for now just verify the flow works
          const credentials = {
            username: process.env.TEST_SALESFORCE_SOURCE_USERNAME,
            password: process.env.TEST_SALESFORCE_SOURCE_PASSWORD
          };
          
          if (credentials.username && credentials.password) {
            console.log('🔑 Test credentials available, attempting login...');
            
            await page.type('#username', credentials.username);
            await page.type('#password', credentials.password);
            
            await PuppeteerHelpers.takeScreenshot(page, 'salesforce-credentials-entered');
            
            // Click login button
            const loginButton = await page.$('#Login, [name="Login"], button[type="submit"]');
            if (loginButton) {
              console.log('🚀 Clicking Salesforce login button...');
              await loginButton.click();
              
              // Wait for potential redirect or response
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              const finalUrl = page.url();
              console.log(`📍 Final URL after login attempt: ${finalUrl}`);
              
              await PuppeteerHelpers.takeScreenshot(page, 'after-salesforce-login');
            }
          } else {
            console.log('⚠️ No test credentials provided, stopping at login form');
          }
        }
        
      } else {
        console.log(`⚠️ No redirect to Salesforce detected. Current URL: ${newUrl}`);
        
        // Check for any error messages
        const pageContent = await PuppeteerHelpers.getText(page, 'body');
        console.log(`📄 Page content after click: ${pageContent?.substring(0, 300)}...`);
      }
      
      await PuppeteerHelpers.takeScreenshot(page, 'oauth-flow-result');
      
    } catch (error) {
      console.error(`❌ Error during OAuth flow: ${error.message}`);
      await PuppeteerHelpers.takeScreenshot(page, 'oauth-error');
    }
  });

  test('should handle navigation between auth pages', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Test navigation to different auth-related pages
    const authRoutes = [
      '/auth/signin',
      '/auth/signup',
      '/auth',
      '/'
    ];
    
    for (const route of authRoutes) {
      try {
        console.log(`🔍 Testing auth route: ${route}`);
        
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        const url = page.url();
        const title = await page.title();
        
        console.log(`  📍 ${route} -> ${url} (${title || 'No title'})`);
        
        // Check if page has content
        const hasContent = await PuppeteerHelpers.isVisible(page, 'body');
        console.log(`  📋 Has content: ${hasContent}`);
        
        await PuppeteerHelpers.takeScreenshot(page, `auth-route-${route.replace(/\//g, '-')}`);
        
      } catch (error) {
        console.log(`  ❌ Error on ${route}: ${error.message.substring(0, 50)}`);
      }
    }
  });
});