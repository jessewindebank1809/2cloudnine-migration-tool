const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');
const AuthBypass = require('../utils/auth-bypass');

describe('UI Element Detection Framework', () => {
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
      await new Promise(resolve => setTimeout(resolve, 3000));
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

  // Helper function to authenticate (with fallback to bypass)
  async function authenticateUser() {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    console.log('🔧 Attempting authentication bypass...');
    const bypassResult = await authBypass.quickBypass(baseUrl);
    
    if (bypassResult.success) {
      console.log('✅ Authentication bypass successful');
      return;
    }
    
    console.log('⚠️ Authentication bypass failed, attempting OAuth flow...');
    
    // Fallback to original OAuth flow
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent?.toLowerCase() || '';
        if (text.includes('salesforce') || text.includes('continue')) {
          button.click();
          return;
        }
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (page.url().includes('salesforce.com')) {
      const credentials = {
        username: process.env.TEST_SALESFORCE_TARGET_USERNAME,
        password: process.env.TEST_SALESFORCE_TARGET_PASSWORD
      };
      
      await page.type('#username', credentials.username, { delay: 10 });
      await page.type('#password', credentials.password, { delay: 10 });
      await page.click('#Login');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
    
    const currentUrl = page.url();
    if (!currentUrl.includes('localhost') || currentUrl.includes('/auth')) {
      throw new Error('Authentication failed');
    }
  }

  // UI Element Detection Functions
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

      // Detect Modal/Dialog Elements
      const modals = document.querySelectorAll('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="dialog"]');
      modals.forEach((modal, index) => {
        results.modals.push({
          index,
          className: modal.className,
          id: modal.id,
          role: modal.getAttribute('role'),
          visible: modal.offsetParent !== null,
          zIndex: window.getComputedStyle(modal).zIndex
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

      // Detect Dropdown Menus
      const dropdowns = document.querySelectorAll('[role="menu"], .dropdown, .select, [data-testid*="dropdown"]');
      dropdowns.forEach((dropdown, index) => {
        results.dropdowns.push({
          index,
          className: dropdown.className,
          id: dropdown.id,
          role: dropdown.getAttribute('role'),
          visible: dropdown.offsetParent !== null
        });
      });

      // Detect Error Messages/Alerts
      const errorElements = document.querySelectorAll('.error, .alert, [role="alert"], [data-testid*="error"]');
      errorElements.forEach((error, index) => {
        results.errors.push({
          index,
          text: error.textContent?.trim() || '',
          className: error.className,
          id: error.id,
          role: error.getAttribute('role'),
          visible: error.offsetParent !== null
        });
      });

      return results;
    });
  }

  // Test Suite for each major page
  test('should detect UI elements on Home page', async () => {
    console.log('🏠 Testing UI elements on Home page...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    const elements = await detectUIElements();
    
    console.log('📊 Home Page UI Elements:');
    console.log(`  🔘 Buttons: ${elements.buttons.length}`);
    console.log(`  📝 Inputs: ${elements.inputs.length}`);
    console.log(`  📋 Forms: ${elements.forms.length}`);
    console.log(`  🔗 Links: ${elements.links.length}`);
    console.log(`  📊 Tables: ${elements.tables.length}`);
    console.log(`  🧭 Navigation: ${elements.navigation.length}`);
    console.log(`  📄 Cards: ${elements.cards.length}`);
    
    // Validate critical elements exist
    expect(elements.buttons.length).toBeGreaterThan(0);
    expect(elements.navigation.length).toBeGreaterThan(0);
    
    // Check for logout button using improved detection
    const hasLogoutButton = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const innerHTML = btn.innerHTML;
        const className = btn.className || '';
        
        // Multiple detection strategies
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
    
    await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-home');
  });

  test('should detect UI elements on Organizations page', async () => {
    console.log('🏢 Testing UI elements on Organizations page...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/orgs`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    const elements = await detectUIElements();
    
    console.log('📊 Organizations Page UI Elements:');
    console.log(`  🔘 Buttons: ${elements.buttons.length}`);
    console.log(`  📝 Inputs: ${elements.inputs.length}`);
    console.log(`  📋 Forms: ${elements.forms.length}`);
    console.log(`  🔗 Links: ${elements.links.length}`);
    console.log(`  📊 Tables: ${elements.tables.length}`);
    console.log(`  📄 Cards: ${elements.cards.length}`);
    
    // Check for organisation-specific elements
    const hasConnectButton = elements.buttons.some(btn => 
      btn.text.toLowerCase().includes('connect') || 
      btn.text.toLowerCase().includes('add')
    );
    console.log(`  🔌 Connect/Add button found: ${hasConnectButton}`);
    
    // List all button texts for debugging
    console.log('  🔘 Button texts:', elements.buttons.map(btn => btn.text).filter(text => text));
    
    await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-orgs');
  });

  test('should detect UI elements on Migrations page', async () => {
    console.log('🔄 Testing UI elements on Migrations page...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/migrations`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    const elements = await detectUIElements();
    
    console.log('📊 Migrations Page UI Elements:');
    console.log(`  🔘 Buttons: ${elements.buttons.length}`);
    console.log(`  📝 Inputs: ${elements.inputs.length}`);
    console.log(`  📋 Forms: ${elements.forms.length}`);
    console.log(`  🔗 Links: ${elements.links.length}`);
    console.log(`  📊 Tables: ${elements.tables.length}`);
    console.log(`  📄 Cards: ${elements.cards.length}`);
    console.log(`  📂 Dropdowns: ${elements.dropdowns.length}`);
    
    // Check for migration-specific elements
    const hasNewMigrationButton = elements.buttons.some(btn => 
      btn.text.toLowerCase().includes('new') || 
      btn.text.toLowerCase().includes('create')
    );
    console.log(`  ➕ New Migration button found: ${hasNewMigrationButton}`);
    
    // Check for data tables (migration lists)
    const hasDataTable = elements.tables.length > 0;
    console.log(`  📊 Data table found: ${hasDataTable}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-migrations');
  });

  test('should detect UI elements on Templates page', async () => {
    console.log('📄 Testing UI elements on Templates page...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/templates`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    const elements = await detectUIElements();
    
    console.log('📊 Templates Page UI Elements:');
    console.log(`  🔘 Buttons: ${elements.buttons.length}`);
    console.log(`  📝 Inputs: ${elements.inputs.length}`);
    console.log(`  📋 Forms: ${elements.forms.length}`);
    console.log(`  🔗 Links: ${elements.links.length}`);
    console.log(`  📊 Tables: ${elements.tables.length}`);
    console.log(`  📄 Cards: ${elements.cards.length}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-templates');
  });

  test('should detect UI elements on Analytics page', async () => {
    console.log('📈 Testing UI elements on Analytics page...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/analytics`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    const elements = await detectUIElements();
    
    console.log('📊 Analytics Page UI Elements:');
    console.log(`  🔘 Buttons: ${elements.buttons.length}`);
    console.log(`  📝 Inputs: ${elements.inputs.length}`);
    console.log(`  📋 Forms: ${elements.forms.length}`);
    console.log(`  🔗 Links: ${elements.links.length}`);
    console.log(`  📊 Tables: ${elements.tables.length}`);
    console.log(`  📄 Cards: ${elements.cards.length}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'ui-detection-analytics');
  });

  test('should validate navigation consistency across pages', async () => {
    console.log('🧭 Testing navigation consistency...');
    
    await authenticateUser();
    
    const pages = ['/home', '/orgs', '/migrations', '/templates', '/analytics'];
    const navigationResults = [];
    
    for (const pagePath of pages) {
      const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
      await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const elements = await detectUIElements();
      navigationResults.push({
        page: pagePath,
        navigationCount: elements.navigation.length,
        linkCount: elements.links.length,
        hasNavigation: elements.navigation.length > 0
      });
    }
    
    console.log('🧭 Navigation Consistency Results:');
    navigationResults.forEach(result => {
      console.log(`  ${result.page}: Nav=${result.navigationCount}, Links=${result.linkCount}`);
    });
    
    // Validate all pages have consistent navigation
    const allHaveNavigation = navigationResults.every(result => result.hasNavigation);
    console.log(`✅ All pages have navigation: ${allHaveNavigation}`);
    
    expect(allHaveNavigation).toBe(true);
  });

  test('should detect interactive element functionality', async () => {
    console.log('🎯 Testing interactive element functionality...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Test button clicks
    const buttonTest = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      let clickableButtons = 0;
      let disabledButtons = 0;
      
      buttons.forEach(btn => {
        if (btn.disabled) {
          disabledButtons++;
        } else if (btn.offsetParent !== null) {
          clickableButtons++;
        }
      });
      
      return { clickableButtons, disabledButtons, totalButtons: buttons.length };
    });
    
    console.log('🔘 Button Functionality:');
    console.log(`  Total buttons: ${buttonTest.totalButtons}`);
    console.log(`  Clickable buttons: ${buttonTest.clickableButtons}`);
    console.log(`  Disabled buttons: ${buttonTest.disabledButtons}`);
    
    // Test link functionality
    const linkTest = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      let validLinks = 0;
      let brokenLinks = 0;
      
      links.forEach(link => {
        if (link.href && link.href !== window.location.href + '#') {
          validLinks++;
        } else {
          brokenLinks++;
        }
      });
      
      return { validLinks, brokenLinks, totalLinks: links.length };
    });
    
    console.log('🔗 Link Functionality:');
    console.log(`  Total links: ${linkTest.totalLinks}`);
    console.log(`  Valid links: ${linkTest.validLinks}`);
    console.log(`  Broken/empty links: ${linkTest.brokenLinks}`);
    
    expect(buttonTest.clickableButtons).toBeGreaterThan(0);
    expect(linkTest.validLinks).toBeGreaterThan(0);
  });

}, 120000); // 2 minute timeout