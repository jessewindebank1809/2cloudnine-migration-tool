const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting logout flow test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();

  // Listen to console events
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'log' || type === 'error' || type === 'warn') {
      console.log(`🌐 Browser Console [${type}]:`, msg.text());
    }
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
  });

  // Listen to network requests/responses
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    if (url.includes('/api/auth') || url.includes('logout') || url.includes('signin')) {
      console.log(`📡 Auth Request: ${method} ${url}`);
    }
  });

  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (url.includes('/api/auth') || url.includes('logout') || url.includes('signin')) {
      console.log(`📨 Auth Response: ${status} ${url}`);
    }
  });

  try {
    // Step 1: Navigate to the app
    console.log('\n📍 Step 1: Navigating to home page...');
    await page.goto('http://localhost:3000/home', { waitUntil: 'networkidle2' });
    
    // Check if we're redirected to signin (not authenticated)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/auth/signin')) {
      console.log('❌ Not authenticated - need to sign in first');
      console.log('Please sign in manually and then run this script again');
      await browser.close();
      return;
    }

    // Step 2: Check initial cookies and session state
    console.log('\n📍 Step 2: Checking initial authentication state...');
    const initialCookies = await page.cookies();
    console.log('Initial cookies:', initialCookies.map(c => `${c.name}=${c.value.substring(0, 50)}...`));
    
    // Check localStorage
    const localStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        items[key] = window.localStorage.getItem(key);
      }
      return items;
    });
    console.log('Initial localStorage:', Object.keys(localStorage));

    // Check sessionStorage
    const sessionStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        items[key] = window.sessionStorage.getItem(key);
      }
      return items;
    });
    console.log('Initial sessionStorage:', Object.keys(sessionStorage));

    // Step 3: Find and click logout button
    console.log('\n📍 Step 3: Looking for logout button...');
    
    // Wait for the logout button to be available - it contains a LogOut icon
    await page.waitForSelector('button svg[data-lucide="log-out"]', { timeout: 10000 });
    
    // Find the logout button by looking for the LogOut icon
    const logoutButton = await page.evaluateHandle(() => {
      const logoutIcon = document.querySelector('svg[data-lucide="log-out"]');
      return logoutIcon ? logoutIcon.closest('button') : null;
    });

    const logoutButtonElement = await logoutButton.asElement();
    if (!logoutButtonElement) {
      console.log('❌ Could not find logout button');
      await browser.close();
      return;
    }

    console.log('✅ Found logout button');

    // Step 4: Click logout and monitor the process
    console.log('\n📍 Step 4: Clicking logout button...');
    
    // Set up promise to wait for navigation or specific responses
    const logoutPromise = Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null),
      page.waitForResponse(response => response.url().includes('/api/auth/logout'), { timeout: 10000 }).catch(() => null)
    ]);

    await logoutButtonElement.click();
    console.log('🖱️ Logout button clicked');

    // Wait for logout process to complete
    await logoutPromise;

    // Step 5: Check what happened after logout
    console.log('\n📍 Step 5: Checking post-logout state...');
    
    // Wait a moment for any redirects or state changes
    await page.waitForTimeout(2000);
    
    const postLogoutUrl = page.url();
    console.log(`Post-logout URL: ${postLogoutUrl}`);

    // Check cookies after logout
    const postLogoutCookies = await page.cookies();
    console.log('Post-logout cookies:', postLogoutCookies.map(c => `${c.name}=${c.value.substring(0, 50)}...`));

    // Check localStorage after logout
    const postLogoutLocalStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        items[key] = window.localStorage.getItem(key);
      }
      return items;
    });
    console.log('Post-logout localStorage:', Object.keys(postLogoutLocalStorage));

    // Check sessionStorage after logout
    const postLogoutSessionStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        items[key] = window.sessionStorage.getItem(key);
      }
      return items;
    });
    console.log('Post-logout sessionStorage:', Object.keys(postLogoutSessionStorage));

    // Step 6: Test if logout was effective
    console.log('\n📍 Step 6: Testing logout effectiveness...');
    
    // Try to navigate to a protected page
    console.log('Attempting to navigate to /home...');
    await page.goto('http://localhost:3000/home', { waitUntil: 'networkidle2' });
    
    const finalUrl = page.url();
    console.log(`Final URL after attempting to access protected page: ${finalUrl}`);
    
    if (finalUrl.includes('/auth/signin')) {
      console.log('✅ Logout successful - redirected to signin page');
    } else {
      console.log('❌ Logout failed - still able to access protected pages');
      
      // Check if there's still session data
      const remainingCookies = await page.cookies();
      const salesforceCookie = remainingCookies.find(c => c.name === 'salesforce-session');
      if (salesforceCookie) {
        console.log('❌ Salesforce session cookie still exists:', salesforceCookie.value.substring(0, 100) + '...');
      }
      
      const remainingLocalStorage = await page.evaluate(() => {
        return localStorage.getItem('dev-bypass-session');
      });
      if (remainingLocalStorage) {
        console.log('❌ Bypass session still exists in localStorage');
      }
    }

    // Step 7: Additional checks
    console.log('\n📍 Step 7: Additional verification...');
    
    // Check if we can manually trigger auth check
    const authCheckResult = await page.evaluate(async () => {
      try {
        // Try to check session using the same logic as the app
        const cookies = document.cookie.split(';');
        const salesforceCookie = cookies.find(cookie => 
          cookie.trim().startsWith('salesforce-session=')
        );
        
        if (salesforceCookie) {
          const cookieValue = salesforceCookie.split('=')[1];
          const sessionData = JSON.parse(decodeURIComponent(cookieValue));
          
          // Check if session is expired
          if (new Date(sessionData.expires) > new Date()) {
            return { hasSession: true, sessionData };
          }
        }
        
        return { hasSession: false };
      } catch (error) {
        return { hasSession: false, error: error.message };
      }
    });
    
    console.log('Manual auth check result:', authCheckResult);

    console.log('\n🏁 Logout flow test completed');
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for manual inspection. Press Ctrl+C to close.');
    
    // Wait indefinitely until user closes
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Don't auto-close so we can inspect
    // await browser.close();
  }
})(); 