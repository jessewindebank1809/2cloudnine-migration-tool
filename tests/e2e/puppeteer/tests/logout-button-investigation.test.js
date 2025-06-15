const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Logout Button Investigation', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: false, // Visual mode to see the logout button
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  });

  afterAll(async () => {
    if (browser) {
      await new Promise(resolve => setTimeout(resolve, 5000));
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

  // Helper function to authenticate
  async function authenticateUser() {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
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
  }

  test('should investigate and fix logout button detection', async () => {
    console.log('🔍 Investigating logout button detection...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Take screenshot to see the current state
    await PuppeteerHelpers.takeScreenshot(page, 'logout-investigation-initial');
    
    // Original detection method (that fails)
    const originalDetection = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const results = [];
      
      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim() || '';
        const hasLogoutText = text.toLowerCase().includes('logout') || 
                             text.toLowerCase().includes('sign out');
        
        results.push({
          index,
          text: text,
          hasLogoutText,
          className: btn.className,
          innerHTML: btn.innerHTML
        });
      });
      
      return results;
    });
    
    console.log('🔍 Original Detection Results:');
    originalDetection.forEach((btn, i) => {
      console.log(`  Button ${i}: "${btn.text}" (logout text: ${btn.hasLogoutText})`);
    });
    
    // Improved detection method (look for icons and click handlers)
    const improvedDetection = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const results = [];
      
      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim() || '';
        const innerHTML = btn.innerHTML;
        const className = btn.className;
        
        // Check for logout indicators
        const hasLogoutText = text.toLowerCase().includes('logout') || 
                             text.toLowerCase().includes('sign out');
        
        // Check for logout icon (LogOut icon from lucide-react)
        const hasLogoutIcon = innerHTML.includes('LogOut') || 
                             innerHTML.includes('log-out') ||
                             className.includes('logout') ||
                             btn.getAttribute('aria-label')?.toLowerCase().includes('logout') ||
                             btn.getAttribute('title')?.toLowerCase().includes('logout');
        
        // Check if it's in the user/nav area (likely logout button location)
        const parentClasses = btn.parentElement?.className || '';
        const isInUserArea = parentClasses.includes('space-x-4') || 
                            parentClasses.includes('border-l') ||
                            className.includes('ghost') ||
                            className.includes('size-sm');
        
        // Check onclick handler patterns
        const onClickString = btn.onclick?.toString() || '';
        const hasSignOutHandler = onClickString.includes('signOut') || 
                                 onClickString.includes('logout') ||
                                 onClickString.includes('handleSignOut');
        
        const isLikelyLogout = hasLogoutText || hasLogoutIcon || 
                              (isInUserArea && hasSignOutHandler) ||
                              (isInUserArea && !text && innerHTML.includes('svg'));
        
        results.push({
          index,
          text: text || '(no text)',
          innerHTML: innerHTML.substring(0, 100) + '...',
          className: className,
          hasLogoutText,
          hasLogoutIcon,
          isInUserArea,
          hasSignOutHandler,
          isLikelyLogout,
          visible: btn.offsetParent !== null
        });
      });
      
      return results;
    });
    
    console.log('\n🔧 Improved Detection Results:');
    improvedDetection.forEach((btn, i) => {
      if (btn.isLikelyLogout) {
        console.log(`  ✅ LOGOUT BUTTON ${i}: "${btn.text}"`);
        console.log(`     Class: ${btn.className}`);
        console.log(`     Icon: ${btn.hasLogoutIcon}, UserArea: ${btn.isInUserArea}`);
        console.log(`     Visible: ${btn.visible}`);
      } else {
        console.log(`  Button ${i}: "${btn.text}" (not logout)`);
      }
    });
    
    // Count how many logout buttons we found
    const logoutButtonCount = improvedDetection.filter(btn => btn.isLikelyLogout).length;
    console.log(`\n📊 Total logout buttons found: ${logoutButtonCount}`);
    
    // Test if we can click the logout button
    if (logoutButtonCount > 0) {
      console.log('\n🧪 Testing logout button click...');
      
      const clickResult = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          const innerHTML = btn.innerHTML;
          const className = btn.className;
          const parentClasses = btn.parentElement?.className || '';
          
          const hasLogoutIcon = innerHTML.includes('LogOut') || innerHTML.includes('log-out');
          const isInUserArea = parentClasses.includes('space-x-4') || 
                              parentClasses.includes('border-l') ||
                              className.includes('ghost');
          const isIconOnly = !text && innerHTML.includes('svg');
          
          if ((hasLogoutIcon || (isInUserArea && isIconOnly)) && btn.offsetParent !== null) {
            // Don't actually click, just verify we can identify it
            return {
              found: true,
              className: btn.className,
              innerHTML: btn.innerHTML.substring(0, 100),
              parentClasses: btn.parentElement?.className
            };
          }
        }
        
        return { found: false };
      });
      
      console.log('🎯 Logout button click test:', clickResult);
      
      if (clickResult.found) {
        console.log('✅ Successfully identified clickable logout button!');
      } else {
        console.log('❌ Could not identify clickable logout button');
      }
    }
    
    await PuppeteerHelpers.takeScreenshot(page, 'logout-investigation-final');
    
    // Validation
    expect(logoutButtonCount).toBeGreaterThan(0);
  });

  test('should create improved logout detection function', async () => {
    console.log('🔧 Creating improved logout detection function...');
    
    await authenticateUser();
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Define the improved detection function
    const improvedLogoutDetection = await page.evaluate(() => {
      // Improved logout button detection function
      function findLogoutButton() {
        const buttons = document.querySelectorAll('button');
        
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          const innerHTML = btn.innerHTML;
          const className = btn.className || '';
          
          // Multiple detection strategies
          const strategies = {
            textBased: text.toLowerCase().includes('logout') || 
                      text.toLowerCase().includes('sign out') ||
                      text.toLowerCase().includes('log out'),
            
            iconBased: innerHTML.includes('LogOut') || 
                      innerHTML.includes('log-out') ||
                      className.includes('logout'),
            
            contextBased: (() => {
              const parent = btn.parentElement;
              const parentClasses = parent?.className || '';
              const isInUserArea = parentClasses.includes('space-x-4') && 
                                  parentClasses.includes('border-l');
              const isGhostButton = className.includes('ghost') && 
                                   className.includes('sm');
              const hasIcon = innerHTML.includes('svg') || innerHTML.includes('<svg');
              const noText = !text || text.length === 0;
              
              return isInUserArea && isGhostButton && hasIcon && noText;
            })(),
            
            attributeBased: btn.getAttribute('aria-label')?.toLowerCase().includes('logout') ||
                           btn.getAttribute('title')?.toLowerCase().includes('logout') ||
                           btn.getAttribute('data-testid')?.toLowerCase().includes('logout')
          };
          
          // Return if any strategy matches
          if (Object.values(strategies).some(strategy => strategy)) {
            return {
              found: true,
              element: btn,
              strategies: strategies,
              text: text || '(icon only)',
              className: className,
              visible: btn.offsetParent !== null
            };
          }
        }
        
        return { found: false };
      }
      
      return findLogoutButton();
    });
    
    console.log('🔧 Improved detection result:');
    console.log(`  Found: ${improvedLogoutDetection.found}`);
    if (improvedLogoutDetection.found) {
      console.log(`  Text: "${improvedLogoutDetection.text}"`);
      console.log(`  Class: ${improvedLogoutDetection.className}`);
      console.log(`  Visible: ${improvedLogoutDetection.visible}`);
      console.log(`  Strategies that matched:`, 
        Object.entries(improvedLogoutDetection.strategies)
          .filter(([_, matched]) => matched)
          .map(([strategy, _]) => strategy)
      );
    }
    
    expect(improvedLogoutDetection.found).toBe(true);
    
    console.log('✅ Improved logout detection function working!');
  });

}, 90000); // 90 second timeout