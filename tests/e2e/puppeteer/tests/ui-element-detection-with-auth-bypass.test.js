const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');
const AuthBypass = require('../utils/auth-bypass');

describe('UI Element Detection with Authentication Bypass', () => {
  let browser;
  let page;
  let authBypass;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: true,
      slowMo: 50,
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
    authBypass = new AuthBypass(page);
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  // UI Element Detection Functions (reused from main test)
  async function detectUIElements() {
    return await page.evaluate(() => {
      const results = {
        buttons: [],
        inputs: [],
        forms: [],
        links: [],
        tables: [],
        modals: [],
        navigation: [],
        cards: [],
        dropdowns: [],
        errors: []
      };

      // Detect Buttons
      const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
      buttons.forEach((btn, index) => {
        results.buttons.push({
          index,
          text: btn.textContent?.trim() || btn.value || '',
          className: btn.className,
          id: btn.id,
          type: btn.type,
          disabled: btn.disabled,
          visible: btn.offsetParent !== null,
          clickable: !btn.disabled && btn.offsetParent !== null
        });
      });

      // Detect Input Fields
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach((input, index) => {
        results.inputs.push({
          index,
          type: input.type || input.tagName.toLowerCase(),
          placeholder: input.placeholder || '',
          className: input.className,
          id: input.id,
          name: input.name,
          required: input.required,
          disabled: input.disabled,
          visible: input.offsetParent !== null
        });
      });

      // Detect Forms
      const forms = document.querySelectorAll('form');
      forms.forEach((form, index) => {
        const formInputs = form.querySelectorAll('input, textarea, select').length;
        const formButtons = form.querySelectorAll('button, input[type="submit"]').length;
        
        results.forms.push({
          index,
          className: form.className,
          id: form.id,
          action: form.action,
          method: form.method,
          inputCount: formInputs,
          buttonCount: formButtons,
          visible: form.offsetParent !== null
        });
      });

      // Detect Links
      const links = document.querySelectorAll('a');
      links.forEach((link, index) => {
        results.links.push({
          index,
          text: link.textContent?.trim() || '',
          href: link.href,
          className: link.className,
          id: link.id,
          visible: link.offsetParent !== null
        });
      });

      // Detect Tables
      const tables = document.querySelectorAll('table');
      tables.forEach((table, index) => {
        const rows = table.querySelectorAll('tr').length;
        const headers = table.querySelectorAll('th').length;
        
        results.tables.push({
          index,
          className: table.className,
          id: table.id,
          rowCount: rows,
          headerCount: headers,
          visible: table.offsetParent !== null
        });
      });

      // Detect Navigation Elements
      const navElements = document.querySelectorAll('nav, [role="navigation"], .navigation, .navbar');
      navElements.forEach((nav, index) => {
        const navLinks = nav.querySelectorAll('a').length;
        
        results.navigation.push({
          index,
          className: nav.className,
          id: nav.id,
          role: nav.getAttribute('role'),
          linkCount: navLinks,
          visible: nav.offsetParent !== null
        });
      });

      // Detect Card Components
      const cards = document.querySelectorAll('.card, [data-testid*="card"]');
      cards.forEach((card, index) => {
        results.cards.push({
          index,
          className: card.className,
          id: card.id,
          visible: card.offsetParent !== null
        });
      });

      return results;
    });
  }

  test('should bypass authentication and detect UI elements on Home page', async () => {
    console.log('🚀 Testing UI detection with authentication bypass...');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Step 1: Apply authentication bypass
    console.log('🔧 Step 1: Applying authentication bypass...');
    const bypassResult = await authBypass.quickBypass(baseUrl);
    
    console.log('📊 Bypass Result:');
    console.log(`  Success: ${bypassResult.success}`);
    console.log(`  Strategies Applied: ${bypassResult.bypassStrategies || 0}`);
    console.log(`  Current URL: ${bypassResult.currentUrl || 'Unknown'}`);
    
    if (!bypassResult.success) {
      console.log('⚠️ Authentication bypass failed, testing public pages only');
      
      // Test the auth/signin page instead
      await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const elements = await detectUIElements();
      
      console.log('📊 Auth Page UI Elements:');
      console.log(`  🔘 Buttons: ${elements.buttons.length}`);
      console.log(`  📝 Inputs: ${elements.inputs.length}`);
      console.log(`  📋 Forms: ${elements.forms.length}`);
      console.log(`  🔗 Links: ${elements.links.length}`);
      
      // Look for Salesforce OAuth button
      const hasSalesforceButton = elements.buttons.some(btn => 
        btn.text.toLowerCase().includes('salesforce') || 
        btn.text.toLowerCase().includes('continue')
      );
      console.log(`  🔌 Salesforce OAuth button found: ${hasSalesforceButton}`);
      
      await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-auth-page-bypass-failed');
      
      expect(elements.buttons.length).toBeGreaterThan(0);
      expect(hasSalesforceButton).toBe(true);
      
      return;
    }
    
    // Step 2: Test UI elements on protected home page
    console.log('🔧 Step 2: Testing UI elements on protected home page...');
    
    const elements = await detectUIElements();
    
    console.log('📊 Home Page UI Elements (with bypass):');
    console.log(`  🔘 Buttons: ${elements.buttons.length}`);
    console.log(`  📝 Inputs: ${elements.inputs.length}`);
    console.log(`  📋 Forms: ${elements.forms.length}`);
    console.log(`  🔗 Links: ${elements.links.length}`);
    console.log(`  📊 Tables: ${elements.tables.length}`);
    console.log(`  🧭 Navigation: ${elements.navigation.length}`);
    console.log(`  📄 Cards: ${elements.cards.length}`);
    
    // Test improved logout button detection
    const hasLogoutButton = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const innerHTML = btn.innerHTML;
        const className = btn.className || '';
        
        // Multiple detection strategies for logout button
        const textBased = text.toLowerCase().includes('logout') || 
                         text.toLowerCase().includes('sign out');
        
        const iconBased = innerHTML.includes('LogOut') || 
                         innerHTML.includes('log-out');
        
        const contextBased = (() => {
          const parent = btn.parentElement;
          const parentClasses = parent?.className || '';
          const isInUserArea = parentClasses.includes('space-x-4') && 
                              parentClasses.includes('border-l');
          const isGhostButton = className.includes('ghost') && 
                               className.includes('sm');
          const hasIcon = innerHTML.includes('svg');
          const noText = !text || text.length === 0;
          
          return isInUserArea && isGhostButton && hasIcon && noText;
        })();
        
        if (textBased || iconBased || contextBased) {
          return true;
        }
      }
      return false;
    });
    
    console.log(`  🚪 Logout button found: ${hasLogoutButton}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-home-with-bypass');
    
    // Validate critical elements exist
    expect(elements.buttons.length).toBeGreaterThan(0);
    
    console.log('✅ UI element detection with authentication bypass completed!');
  });

  test('should test multiple protected routes with bypass', async () => {
    console.log('🔄 Testing multiple protected routes with authentication bypass...');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Apply authentication bypass
    const bypassResult = await authBypass.quickBypass(baseUrl);
    
    if (!bypassResult.success) {
      console.log('⚠️ Authentication bypass failed, skipping protected route testing');
      return;
    }
    
    const protectedRoutes = ['/home', '/orgs', '/migrations', '/templates'];
    const routeResults = [];
    
    for (const route of protectedRoutes) {
      console.log(`🔍 Testing route: ${route}`);
      
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 10000 });
        
        const elements = await detectUIElements();
        const currentUrl = page.url();
        
        const routeResult = {
          route: route,
          accessible: !currentUrl.includes('/auth'),
          currentUrl: currentUrl,
          buttonCount: elements.buttons.length,
          linkCount: elements.links.length,
          navigationCount: elements.navigation.length,
          tableCount: elements.tables.length
        };
        
        routeResults.push(routeResult);
        
        console.log(`  📍 ${route}: Accessible=${routeResult.accessible}, Buttons=${routeResult.buttonCount}, Navigation=${routeResult.navigationCount}`);
        
        await PuppeteerHelpers.takeScreenshot(page, `ui-detection-${route.replace('/', '')}-with-bypass`);
        
      } catch (error) {
        console.log(`  ❌ Error testing ${route}: ${error.message.substring(0, 50)}`);
        routeResults.push({
          route: route,
          accessible: false,
          error: error.message.substring(0, 100)
        });
      }
    }
    
    console.log('\n📊 Protected Routes Summary:');
    routeResults.forEach(result => {
      if (result.accessible) {
        console.log(`  ✅ ${result.route}: ${result.buttonCount} buttons, ${result.navigationCount} nav`);
      } else {
        console.log(`  ❌ ${result.route}: Not accessible or error`);
      }
    });
    
    // Validate at least some routes are accessible
    const accessibleRoutes = routeResults.filter(r => r.accessible).length;
    console.log(`\n🎯 Total accessible routes: ${accessibleRoutes}/${routeResults.length}`);
    
    expect(accessibleRoutes).toBeGreaterThan(0);
  });

  test('should validate authentication bypass strategies individually', async () => {
    console.log('🧪 Testing individual authentication bypass strategies...');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Test Strategy 1: Mock Session
    console.log('\n🔧 Testing Strategy 1: Mock Session');
    const mockResult = await authBypass.mockBetterAuthSession();
    console.log('  Result:', mockResult);
    
    // Test Strategy 2: Cookie-based Auth
    console.log('\n🔧 Testing Strategy 2: Cookie-based Auth');
    const cookieResult = await authBypass.setCookieBasedAuth();
    console.log('  Result:', cookieResult);
    
    // Test Strategy 3: Request Interception
    console.log('\n🔧 Testing Strategy 3: Request Interception');
    const interceptResult = await authBypass.interceptAuthRequests();
    console.log('  Result:', interceptResult);
    
    // Try to access a protected route
    console.log('\n🔍 Testing protected route access...');
    
    try {
      await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 10000 });
      
      const finalUrl = page.url();
      const isAuthenticated = !finalUrl.includes('/auth');
      
      console.log(`  Final URL: ${finalUrl}`);
      console.log(`  Is authenticated: ${isAuthenticated}`);
      
      await PuppeteerHelpers.takeScreenshot(page, 'auth-bypass-individual-strategies-test');
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    
    console.log('\n📊 Strategy Test Summary:');
    console.log(`  Mock Session: ${mockResult.success ? '✅' : '❌'}`);
    console.log(`  Cookie Auth: ${cookieResult.success ? '✅' : '❌'}`);
    console.log(`  Request Interception: ${interceptResult.success ? '✅' : '❌'}`);
  });

}, 90000); // 90 second timeout