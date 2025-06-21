const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Post-Authentication Application Flow', () => {
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

  test('should explore main application routes when authenticated', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🚀 Testing main application routes...');
    
    // Test the main application routes that should be available
    const appRoutes = [
      { path: '/home', name: 'Home Dashboard' },
      { path: '/migrations', name: 'Migrations' },
      { path: '/orgs', name: 'Organizations' },
      { path: '/templates', name: 'Templates' },
      { path: '/analytics', name: 'Analytics' },
      { path: '/migrations/new', name: 'New Migration' },
      { path: '/migrations/scheduled', name: 'Scheduled Migrations' }
    ];
    
    for (const route of appRoutes) {
      try {
        console.log(`🔍 Testing ${route.name}: ${route.path}`);
        
        await page.goto(`${baseUrl}${route.path}`, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        
        const url = page.url();
        const title = await page.title();
        
        console.log(`  📍 ${route.path} -> ${url}`);
        console.log(`  📄 Title: ${title || 'No title'}`);
        
        // Check if we're redirected to auth (indicating auth required)
        if (url.includes('/auth') || url.includes('/signin')) {
          console.log(`  🔐 Route requires authentication`);
        } else {
          console.log(`  ✅ Route accessible without auth or already authenticated`);
          
          // Take screenshot of the page
          await PuppeteerHelpers.takeScreenshot(page, `route-${route.path.replace(/\//g, '-')}`);
          
          // Look for common application elements
          const elements = {
            navigation: await PuppeteerHelpers.isVisible(page, 'nav, [data-testid*="nav"]', 2000),
            buttons: await PuppeteerHelpers.getElementCount(page, 'button'),
            links: await PuppeteerHelpers.getElementCount(page, 'a'),
            forms: await PuppeteerHelpers.getElementCount(page, 'form'),
            inputs: await PuppeteerHelpers.getElementCount(page, 'input')
          };
          
          console.log(`  📊 Elements found:`, elements);
          
          // Look for specific migration tool elements
          const migrationElements = [
            '[data-testid*="migration"]',
            '[data-testid*="org"]',
            '[data-testid*="template"]',
            '[data-testid*="project"]',
            'button:contains("Create")',
            'button:contains("New")',
            'button:contains("Execute")',
            'button:contains("Connect")'
          ];
          
          for (const selector of migrationElements) {
            try {
              const count = await PuppeteerHelpers.getElementCount(page, selector);
              if (count > 0) {
                console.log(`    🎯 Found ${count} elements matching: ${selector}`);
              }
            } catch (error) {
              // Skip selectors that cause issues
            }
          }
        }
        
      } catch (error) {
        console.log(`  ❌ Error accessing ${route.path}: ${error.message.substring(0, 100)}`);
      }
    }
  });

  test('should test organisation management functionality', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🏢 Testing organisation management...');
    
    await page.goto(`${baseUrl}/orgs`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const url = page.url();
    console.log(`📍 Orgs page URL: ${url}`);
    
    if (!url.includes('/auth')) {
      // Page is accessible, explore the functionality
      await PuppeteerHelpers.takeScreenshot(page, 'orgs-page-main');
      
      // Look for org-related elements
      const orgElements = [
        'button:contains("Connect")',
        'button:contains("Add")',
        '[data-testid*="org"]',
        '[data-testid*="connect"]',
        '.org-list',
        '.organisation'
      ];
      
      console.log('🔍 Looking for organisation elements...');
      
      for (const selector of orgElements) {
        try {
          const count = await PuppeteerHelpers.getElementCount(page, selector);
          if (count > 0) {
            console.log(`  ✅ Found ${count} elements: ${selector}`);
          }
        } catch (error) {
          // Skip problematic selectors
        }
      }
      
      // Look for any tables or lists that might contain org data
      const tables = await PuppeteerHelpers.getElementCount(page, 'table, [role="table"]');
      const lists = await PuppeteerHelpers.getElementCount(page, 'ul, ol, [role="list"]');
      
      console.log(`📊 Data display elements - Tables: ${tables}, Lists: ${lists}`);
      
      // Check page content for org-related text
      const pageContent = await PuppeteerHelpers.getText(page, 'body');
      if (pageContent) {
        const orgKeywords = ['organisation', 'salesforce', 'connect', 'source', 'target'];
        const foundKeywords = orgKeywords.filter(keyword => 
          pageContent.toLowerCase().includes(keyword)
        );
        
        if (foundKeywords.length > 0) {
          console.log(`🎯 Found org-related content: ${foundKeywords.join(', ')}`);
        }
      }
    }
  });

  test('should test migration workflow functionality', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🔄 Testing migration workflows...');
    
    const migrationRoutes = ['/migrations', '/migrations/new'];
    
    for (const route of migrationRoutes) {
      try {
        console.log(`🔍 Testing migration route: ${route}`);
        
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        const url = page.url();
        console.log(`  📍 ${route} -> ${url}`);
        
        if (!url.includes('/auth')) {
          await PuppeteerHelpers.takeScreenshot(page, `migration-route-${route.replace(/\//g, '-')}`);
          
          // Look for migration-specific elements
          const migrationElements = [
            'button:contains("Create")',
            'button:contains("New")',
            'button:contains("Execute")',
            'button:contains("Start")',
            '[data-testid*="migration"]',
            '[data-testid*="project"]',
            'form',
            'input[type="text"]',
            'select'
          ];
          
          console.log(`  🔍 Scanning for migration elements on ${route}...`);
          
          for (const selector of migrationElements) {
            try {
              const count = await PuppeteerHelpers.getElementCount(page, selector);
              if (count > 0) {
                console.log(`    ✅ ${selector}: ${count} found`);
              }
            } catch (error) {
              // Skip problematic selectors
            }
          }
          
          // Check for progress indicators or status displays
          const statusElements = [
            '.progress',
            '[data-testid*="progress"]',
            '[data-testid*="status"]',
            '.status',
            '.badge'
          ];
          
          for (const selector of statusElements) {
            const count = await PuppeteerHelpers.getElementCount(page, selector);
            if (count > 0) {
              console.log(`    📊 Status element ${selector}: ${count} found`);
            }
          }
        }
        
      } catch (error) {
        console.log(`  ❌ Error on ${route}: ${error.message.substring(0, 50)}`);
      }
    }
  });

  test('should test template functionality', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('📋 Testing template functionality...');
    
    await page.goto(`${baseUrl}/templates`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const url = page.url();
    console.log(`📍 Templates page: ${url}`);
    
    if (!url.includes('/auth')) {
      await PuppeteerHelpers.takeScreenshot(page, 'templates-page-main');
      
      // Look for template-related elements
      const templateElements = [
        '[data-testid*="template"]',
        '.template',
        'button:contains("Select")',
        'button:contains("Use")',
        'button:contains("Apply")',
        '.template-card',
        '.template-list'
      ];
      
      console.log('🔍 Looking for template elements...');
      
      for (const selector of templateElements) {
        try {
          const count = await PuppeteerHelpers.getElementCount(page, selector);
          if (count > 0) {
            console.log(`  ✅ Found ${count} template elements: ${selector}`);
          }
        } catch (error) {
          // Skip problematic selectors
        }
      }
      
      // Check for template content
      const pageContent = await PuppeteerHelpers.getText(page, 'body');
      if (pageContent) {
        const templateKeywords = ['template', 'payroll', 'product', 'migration', 'preset'];
        const foundKeywords = templateKeywords.filter(keyword => 
          pageContent.toLowerCase().includes(keyword)
        );
        
        if (foundKeywords.length > 0) {
          console.log(`🎯 Found template-related content: ${foundKeywords.join(', ')}`);
        }
      }
    }
  });

  test('should test analytics dashboard', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('📊 Testing analytics dashboard...');
    
    await page.goto(`${baseUrl}/analytics`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const url = page.url();
    console.log(`📍 Analytics page: ${url}`);
    
    if (!url.includes('/auth')) {
      await PuppeteerHelpers.takeScreenshot(page, 'analytics-page-main');
      
      // Look for analytics elements
      const analyticsElements = [
        'canvas', // Charts
        'svg',    // Charts  
        '[data-testid*="chart"]',
        '[data-testid*="analytics"]',
        '[data-testid*="metric"]',
        '.chart',
        '.metric',
        '.statistic',
        '.dashboard'
      ];
      
      console.log('🔍 Looking for analytics elements...');
      
      for (const selector of analyticsElements) {
        const count = await PuppeteerHelpers.getElementCount(page, selector);
        if (count > 0) {
          console.log(`  📈 Found ${count} analytics elements: ${selector}`);
        }
      }
      
      // Look for filters and controls
      const controlElements = [
        'select',
        'input[type="date"]',
        'button:contains("Filter")',
        'button:contains("Export")',
        '[data-testid*="filter"]'
      ];
      
      for (const selector of controlElements) {
        try {
          const count = await PuppeteerHelpers.getElementCount(page, selector);
          if (count > 0) {
            console.log(`  🎛️ Found ${count} control elements: ${selector}`);
          }
        } catch (error) {
          // Skip problematic selectors
        }
      }
    }
  });
});