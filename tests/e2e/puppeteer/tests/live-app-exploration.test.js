const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Live Application Exploration', () => {
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
      slowMo: 100,
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

  test('should explore live application structure', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log(`🔍 Exploring application at: ${baseUrl}`);
    
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Basic page info
    const title = await page.title();
    const url = page.url();
    
    console.log(`📄 Page Title: ${title}`);
    console.log(`🌐 Current URL: ${url}`);
    
    // Take screenshot of current state
    await PuppeteerHelpers.takeScreenshot(page, 'live-app-initial');
    
    // Look for common elements
    const commonSelectors = [
      'body',
      'main',
      'nav',
      'header',
      'footer',
      '[data-testid]',
      'button',
      'a',
      'form',
      'input'
    ];
    
    console.log('🔍 Scanning for common elements...');
    
    for (const selector of commonSelectors) {
      const count = await PuppeteerHelpers.getElementCount(page, selector);
      if (count > 0) {
        console.log(`  ✅ ${selector}: ${count} elements found`);
      }
    }
    
    // Look for specific application elements
    const appSelectors = [
      '[data-testid*="auth"]',
      '[data-testid*="login"]',
      '[data-testid*="signin"]',
      '[data-testid*="migration"]',
      '[data-testid*="org"]',
      '[data-testid*="template"]',
      '[data-testid*="nav"]',
      'button:contains("Sign")',
      'a[href*="auth"]',
      'a[href*="login"]',
      'a[href*="signin"]'
    ];
    
    console.log('🔍 Scanning for application-specific elements...');
    
    for (const selector of appSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`  ✅ ${selector}: ${elements.length} elements found`);
        }
      } catch (error) {
        // Skip selectors that cause issues
      }
    }
    
    // Get page content snippet
    const bodyText = await PuppeteerHelpers.getText(page, 'body');
    if (bodyText) {
      const snippet = bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : '');
      console.log(`📖 Page content preview: ${snippet}`);
    }
    
    // Check for any obvious error messages
    const errorSelectors = [
      '.error',
      '[class*="error"]',
      '[data-testid*="error"]',
      '.alert',
      '[role="alert"]'
    ];
    
    for (const selector of errorSelectors) {
      const errorText = await PuppeteerHelpers.getText(page, selector);
      if (errorText) {
        console.log(`🚨 Error found: ${errorText}`);
      }
    }
    
    expect(title).toBeTruthy();
    expect(url).toContain('localhost');
  });

  test('should check for authentication elements', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Look for authentication-related text and elements
    const authTexts = [
      'sign in',
      'login',
      'authenticate',
      'salesforce',
      'oauth',
      'continue with'
    ];
    
    console.log('🔐 Looking for authentication elements...');
    
    const pageContent = await PuppeteerHelpers.getText(page, 'body');
    const lowerContent = pageContent ? pageContent.toLowerCase() : '';
    
    for (const text of authTexts) {
      if (lowerContent.includes(text)) {
        console.log(`  ✅ Found auth text: "${text}"`);
      }
    }
    
    // Look for buttons or links that might be auth-related
    const buttons = await page.$$('button, a, [role="button"]');
    
    console.log(`🔘 Found ${buttons.length} interactive elements`);
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      try {
        const text = await buttons[i].evaluate(el => el.textContent?.trim() || '');
        const href = await buttons[i].evaluate(el => el.getAttribute('href') || '');
        
        if (text || href) {
          console.log(`  📍 Element ${i + 1}: "${text}" ${href ? `(${href})` : ''}`);
        }
      } catch (error) {
        // Skip elements that can't be evaluated
      }
    }
    
    await PuppeteerHelpers.takeScreenshot(page, 'live-app-auth-scan');
  });

  test('should navigate and explore available routes', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Try common application routes
    const routes = [
      '/',
      '/auth',
      '/auth/signin',
      '/login',
      '/home',
      '/migrations',
      '/orgs',
      '/templates',
      '/analytics'
    ];
    
    console.log('🗺️ Exploring application routes...');
    
    for (const route of routes) {
      try {
        const fullUrl = `${baseUrl}${route}`;
        console.log(`🔍 Testing route: ${fullUrl}`);
        
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        const finalUrl = page.url();
        const title = await page.title();
        
        console.log(`  📄 ${route} -> ${finalUrl} (${title})`);
        
        // Quick check for obvious content
        const hasContent = await PuppeteerHelpers.isVisible(page, 'body', 1000);
        console.log(`  📋 Has content: ${hasContent}`);
        
      } catch (error) {
        console.log(`  ❌ ${route} -> Error: ${error.message.substring(0, 50)}`);
      }
    }
    
    await PuppeteerHelpers.takeScreenshot(page, 'live-app-routes-explored');
  });
});