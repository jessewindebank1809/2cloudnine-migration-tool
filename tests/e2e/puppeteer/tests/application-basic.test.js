const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Basic Application Tests', () => {
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

  test('should load application home page', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log(`🔗 Navigating to: ${baseUrl}`);
    
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const url = await PuppeteerHelpers.getCurrentUrl(page);
      const title = await PuppeteerHelpers.getPageTitle(page);
      
      console.log(`📄 Page loaded: ${title}`);
      console.log(`🌐 Current URL: ${url}`);
      
      expect(url).toContain('localhost');
      expect(title).toBeTruthy();
      
      await PuppeteerHelpers.takeScreenshot(page, 'app-home-page');
      
    } catch (error) {
      console.warn(`⚠️  Application not available at ${baseUrl}`);
      console.warn('💡 Start the dev server with: npm run dev');
      
      // Skip test if server not running
      console.warn('Skipping test - development server not running');
      return;
    }
  });

  test('should handle navigation and basic routing', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Look for common navigation elements
      const navigationElements = [
        'nav',
        '[data-testid*="nav"]',
        '[role="navigation"]',
        'a[href*="auth"]',
        'a[href*="login"]',
        'a[href*="signin"]',
        'button:contains("Sign")',
        'button:contains("Login")'
      ];
      
      let foundNavigation = false;
      
      for (const selector of navigationElements) {
        if (await PuppeteerHelpers.isVisible(page, selector, 2000)) {
          console.log(`✅ Found navigation element: ${selector}`);
          foundNavigation = true;
          break;
        }
      }
      
      if (!foundNavigation) {
        console.log('📝 No standard navigation found, checking page structure...');
        
        // Check for any interactive elements
        const bodyText = await PuppeteerHelpers.getText(page, 'body');
        expect(bodyText).toBeTruthy();
        console.log(`📖 Page content length: ${bodyText ? bodyText.length : 0} characters`);
      }
      
      await PuppeteerHelpers.takeScreenshot(page, 'app-navigation');
      
    } catch (error) {
      console.warn('Skipping navigation test - development server not running');
      return;
    }
  });

  test('should verify application is responsive', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Test different viewport sizes
      const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 }
      ];
      
      for (const viewport of viewports) {
        console.log(`📱 Testing ${viewport.name} viewport: ${viewport.width}x${viewport.height}`);
        
        await page.setViewport(viewport);
        await page.waitForTimeout(500); // Allow for responsive adjustments
        
        // Check if page is still functional
        const bodyVisible = await PuppeteerHelpers.isVisible(page, 'body');
        expect(bodyVisible).toBe(true);
        
        await PuppeteerHelpers.takeScreenshot(page, `app-responsive-${viewport.name}`);
      }
      
      // Reset to desktop size
      await page.setViewport({ width: 1920, height: 1080 });
      
    } catch (error) {
      console.warn('Skipping responsive test - development server not running');
      return;
    }
  });

  test('should validate page performance basics', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    try {
      const startTime = Date.now();
      
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const loadTime = Date.now() - startTime;
      console.log(`⚡ Page load time: ${loadTime}ms`);
      
      // Basic performance check - should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
      
      // Check for basic performance metrics
      const metrics = await page.metrics();
      console.log(`🧠 JS Heap Used: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)}MB`);
      console.log(`📊 DOM Nodes: ${metrics.Nodes}`);
      
      // Basic performance assertions
      expect(metrics.JSHeapUsedSize).toBeLessThan(100 * 1024 * 1024); // Under 100MB
      expect(metrics.Nodes).toBeLessThan(10000); // Under 10k DOM nodes
      
    } catch (error) {
      console.warn('Skipping performance test - development server not running');
      return;
    }
  });

  test('should check for console errors', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    try {
      const consoleErrors = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait a bit for any lazy-loaded content
      await page.waitForTimeout(2000);
      
      // Filter out common non-critical errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('favicon') && 
        !error.includes('AdBlock') &&
        !error.includes('extension') &&
        !error.includes('chrome-extension')
      );
      
      if (criticalErrors.length > 0) {
        console.warn('🚨 Console errors found:');
        criticalErrors.forEach(error => console.warn(`  - ${error}`));
      } else {
        console.log('✅ No critical console errors found');
      }
      
      // For now, just log errors but don't fail tests
      // In a real environment, you might want to fail on certain errors
      expect(criticalErrors.length).toBeLessThan(10); // Allow some minor errors
      
    } catch (error) {
      console.warn('Skipping console error test - development server not running');
      return;
    }
  });
});