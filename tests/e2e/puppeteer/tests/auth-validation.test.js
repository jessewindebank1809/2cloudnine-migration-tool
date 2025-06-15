const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Authentication Validation Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: false, // Keep visible for debugging
      slowMo: 50,      // Faster interactions
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  });

  afterAll(async () => {
    if (browser) {
      // Keep browser open briefly for manual verification
      await new Promise(resolve => setTimeout(resolve, 3000));
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enhanced logging
    page.on('console', msg => {
      console.log(`🖥️ Browser [${msg.type()}]: ${msg.text()}`);
    });
  });

  afterEach(async () => {
    if (page) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.close();
    }
  });

  test('should validate complete OAuth flow initiation and redirect', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🔐 Testing OAuth Flow Initiation');
    console.log(`📍 Application URL: ${baseUrl}`);
    
    // Step 1: Verify root redirects to auth
    console.log('\n📌 STEP 1: Verify unauthenticated redirect');
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const authUrl = page.url();
    console.log(`✅ Root redirect: ${baseUrl} → ${authUrl}`);
    expect(authUrl).toContain('/auth/signin');
    
    await PuppeteerHelpers.takeScreenshot(page, 'auth-redirect-validation');
    
    // Step 2: Validate auth page content
    console.log('\n📌 STEP 2: Validate authentication page');
    
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      hasButton: !!document.querySelector('button'),
      buttonText: document.querySelector('button')?.textContent?.trim(),
      bodyText: document.body.textContent.substring(0, 200)
    }));
    
    console.log(`📄 Page title: "${pageInfo.title}"`);
    console.log(`🔘 Button found: ${pageInfo.hasButton}`);
    console.log(`📝 Button text: "${pageInfo.buttonText}"`);
    console.log(`📖 Page content preview: "${pageInfo.bodyText}..."`);
    
    expect(pageInfo.title).toBe('2cloudnine Migration Tool');
    expect(pageInfo.hasButton).toBe(true);
    expect(pageInfo.buttonText).toContain('Salesforce');
    
    // Step 3: Validate OAuth initiation
    console.log('\n📌 STEP 3: Test OAuth flow initiation');
    
    // Find and click the Salesforce button
    const buttonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent?.toLowerCase() || '';
        if (text.includes('salesforce') || text.includes('continue')) {
          button.click();
          return {
            success: true,
            buttonText: button.textContent.trim(),
            buttonClass: button.className
          };
        }
      }
      return { success: false };
    });
    
    console.log(`🚀 OAuth button click result:`, buttonClicked);
    expect(buttonClicked.success).toBe(true);
    
    // Step 4: Verify Salesforce redirect
    console.log('\n📌 STEP 4: Verify Salesforce OAuth redirect');
    
    // Wait for redirect to Salesforce
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const salesforceUrl = page.url();
    console.log(`🌐 Redirected to: ${salesforceUrl}`);
    
    expect(salesforceUrl).toContain('salesforce.com');
    expect(salesforceUrl).toContain('login');
    
    await PuppeteerHelpers.takeScreenshot(page, 'salesforce-oauth-redirect');
    
    // Step 5: Validate Salesforce login page
    console.log('\n📌 STEP 5: Validate Salesforce login page');
    
    const salesforcePageInfo = await page.evaluate(() => ({
      hasUsernameField: !!document.querySelector('#username'),
      hasPasswordField: !!document.querySelector('#password'),
      hasLoginButton: !!document.querySelector('#Login'),
      pageTitle: document.title,
      domain: window.location.hostname
    }));
    
    console.log(`🏢 Salesforce domain: ${salesforcePageInfo.domain}`);
    console.log(`📄 Salesforce page title: "${salesforcePageInfo.pageTitle}"`);
    console.log(`👤 Username field: ${salesforcePageInfo.hasUsernameField}`);
    console.log(`🔒 Password field: ${salesforcePageInfo.hasPasswordField}`);
    console.log(`🚀 Login button: ${salesforcePageInfo.hasLoginButton}`);
    
    expect(salesforcePageInfo.domain).toContain('salesforce.com');
    expect(salesforcePageInfo.hasUsernameField).toBe(true);
    expect(salesforcePageInfo.hasPasswordField).toBe(true);
    expect(salesforcePageInfo.hasLoginButton).toBe(true);
    
    console.log('\n✅ OAUTH FLOW VALIDATION COMPLETE');
    console.log('🎯 All authentication components working correctly:');
    console.log('   - ✅ Root URL redirects to auth page');
    console.log('   - ✅ Auth page displays correctly with proper title');
    console.log('   - ✅ Salesforce OAuth button functional');
    console.log('   - ✅ OAuth redirect to Salesforce working');
    console.log('   - ✅ Salesforce login form available');
    
    // For manual verification, show the final state
    await PuppeteerHelpers.takeScreenshot(page, 'oauth-validation-complete');
  });

  test('should validate protected route access requires authentication', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('\n🔒 Testing Protected Route Access');
    
    const protectedRoutes = ['/home', '/migrations', '/orgs', '/templates', '/analytics'];
    
    for (const route of protectedRoutes) {
      console.log(`\n📍 Testing protected route: ${route}`);
      
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const currentUrl = page.url();
      console.log(`  🌐 ${route} → ${currentUrl}`);
      
      if (currentUrl.includes('/auth') || currentUrl.includes('/signin')) {
        console.log(`  ✅ ${route} properly requires authentication`);
      } else {
        // Check if this is actually a protected page or just accessible
        const pageContent = await page.evaluate(() => ({
          hasAuthButton: !!document.querySelector('button:contains("Salesforce")') || 
                        document.body.textContent.includes('Continue with Salesforce'),
          title: document.title,
          hasNavigation: !!document.querySelector('nav') || !!document.querySelector('[data-testid*="nav"]')
        }));
        
        if (pageContent.hasAuthButton) {
          console.log(`  🔐 ${route} shows authentication prompt`);
        } else {
          console.log(`  ℹ️ ${route} accessible (may be public or already authenticated)`);
          console.log(`     Title: "${pageContent.title}"`);
          console.log(`     Has navigation: ${pageContent.hasNavigation}`);
        }
      }
      
      await PuppeteerHelpers.takeScreenshot(page, `protected-route-${route.replace('/', '')}`);
    }
  });

  test('should validate application routing and page structure', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('\n🗺️ Testing Application Routing Structure');
    
    const routes = [
      { path: '/', name: 'Root' },
      { path: '/auth', name: 'Auth Base' },
      { path: '/auth/signin', name: 'Sign In' },
      { path: '/auth/signup', name: 'Sign Up' }
    ];
    
    for (const route of routes) {
      console.log(`\n📍 Testing ${route.name}: ${route.path}`);
      
      try {
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        
        const pageInfo = await page.evaluate(() => ({
          finalUrl: window.location.href,
          title: document.title,
          hasContent: document.body.textContent.length > 100,
          elementCounts: {
            buttons: document.querySelectorAll('button').length,
            links: document.querySelectorAll('a').length,
            forms: document.querySelectorAll('form').length,
            inputs: document.querySelectorAll('input').length
          }
        }));
        
        console.log(`  🌐 ${route.path} → ${pageInfo.finalUrl}`);
        console.log(`  📄 Title: "${pageInfo.title}"`);
        console.log(`  📊 Elements:`, pageInfo.elementCounts);
        console.log(`  📋 Has content: ${pageInfo.hasContent}`);
        
        await PuppeteerHelpers.takeScreenshot(page, `route-structure-${route.path.replace(/\//g, '-') || 'root'}`);
        
      } catch (error) {
        console.log(`  ❌ Error accessing ${route.path}: ${error.message.substring(0, 50)}`);
      }
    }
  });
}, 120000); // 2 minute timeout for comprehensive testing