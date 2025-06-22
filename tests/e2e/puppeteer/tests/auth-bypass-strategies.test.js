const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PuppeteerHelpers = require('../utils/puppeteer-helpers');

describe('Authentication Bypass Strategies', () => {
  let browser;
  let page;

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
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should test Strategy 1: Mock Authentication Session', async () => {
    console.log('🔧 Testing Strategy 1: Mock Authentication Session');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Navigate to the auth signin page first
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Strategy 1: Mock the authClient.getSession() method
    const mockSessionResult = await page.evaluate(() => {
      try {
        // Mock the auth client session response
        const mockSessionData = {
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@2cloudnine.com',
              name: 'Test User',
              salesforceOrgId: 'test-org-id',
              salesforceInstanceUrl: 'https://test.salesforce.com'
            },
            session: {
              id: 'test-session-id',
              token: 'test-token',
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        };
        
        // Try to override the authClient.getSession method
        if (window.authClient) {
          window.authClient.getSession = async () => mockSessionData;
          return { success: true, method: 'authClient override' };
        }
        
        // Alternative: Store session data in localStorage (Better Auth might check this)
        localStorage.setItem('better-auth.session', JSON.stringify(mockSessionData));
        
        // Alternative: Set cookies that Better Auth might use
        document.cookie = 'better-auth.session=test-session-token; path=/';
        
        return { success: true, method: 'localStorage and cookies' };
        
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔧 Mock session result:', mockSessionResult);
    
    // Try to navigate to protected route
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    const currentUrl = page.url();
    const isAuthenticated = !currentUrl.includes('/auth') && currentUrl.includes('/home');
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`✅ Strategy 1 Success: ${isAuthenticated}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'auth-bypass-strategy-1');
  });

  test('should test Strategy 2: Session Cookie Injection', async () => {
    console.log('🔧 Testing Strategy 2: Session Cookie Injection');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // First, let's see what cookies exist after successful auth by checking the auth API
    const apiResponse = await page.evaluate(async (baseUrl) => {
      try {
        // Try to call the auth check API directly
        const response = await fetch(`${baseUrl}/api/auth/check`, {
          method: 'GET',
          credentials: 'include'
        });
        
        const data = await response.json();
        return { success: response.ok, data: data, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, baseUrl);
    
    console.log('🔍 Auth API check:', apiResponse);
    
    // Strategy 2: Set authentication cookies directly
    await page.setCookie({
      name: 'better-auth.session',
      value: 'test-session-token-value',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax'
    });
    
    // Also try alternative cookie names that Better Auth might use
    await page.setCookie({
      name: 'better-auth.session_token',
      value: 'test-session-token-value',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax'
    });
    
    // Try to navigate to protected route
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    const currentUrl = page.url();
    const isAuthenticated = !currentUrl.includes('/auth') && currentUrl.includes('/home');
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`✅ Strategy 2 Success: ${isAuthenticated}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'auth-bypass-strategy-2');
  });

  test('should test Strategy 3: Direct API Session Creation', async () => {
    console.log('🔧 Testing Strategy 3: Direct API Session Creation');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Strategy 3: Try to create a session via API call
    const sessionCreation = await page.evaluate(async (baseUrl) => {
      try {
        // Try to create a session directly via the Better Auth API
        const sessionData = {
          email: 'test@2cloudnine.com',
          name: 'Test User',
          salesforceOrgId: 'test-org-id'
        };
        
        // Attempt to call Better Auth's session creation endpoint
        const response = await fetch(`${baseUrl}/api/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sessionData),
          credentials: 'include'
        });
        
        const result = await response.json();
        return { 
          success: response.ok, 
          status: response.status, 
          data: result,
          headers: Object.fromEntries(response.headers.entries())
        };
        
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, baseUrl);
    
    console.log('🔧 Session creation result:', sessionCreation);
    
    // Try to navigate to protected route
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    const currentUrl = page.url();
    const isAuthenticated = !currentUrl.includes('/auth') && currentUrl.includes('/home');
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`✅ Strategy 3 Success: ${isAuthenticated}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'auth-bypass-strategy-3');
  });

  test('should test Strategy 4: Environment Variable Override', async () => {
    console.log('🔧 Testing Strategy 4: Environment Variable Override');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Strategy 4: Check if we can bypass auth with environment variables
    const envOverride = await page.evaluate(() => {
      try {
        // Try to set test environment variables that might disable auth
        window.process = window.process || {};
        window.process.env = window.process.env || {};
        window.process.env.NODE_ENV = 'test';
        window.process.env.DISABLE_AUTH = 'true';
        window.process.env.TEST_MODE = 'true';
        
        return { success: true, env: window.process.env };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔧 Environment override result:', envOverride);
    
    // Try to navigate directly to protected route
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    const currentUrl = page.url();
    const isAuthenticated = !currentUrl.includes('/auth') && currentUrl.includes('/home');
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`✅ Strategy 4 Success: ${isAuthenticated}`);
    
    await PuppeteerHelpers.takeScreenshot(page, 'auth-bypass-strategy-4');
  });

  test('should analyse authentication flow and create bypass recommendations', async () => {
    console.log('🔍 Analysing authentication flow for bypass opportunities...');
    
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    // Go to auth page and analyse the authentication check
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Analyse the auth flow
    const authAnalysis = await page.evaluate((baseUrl) => {
      const analysis = {
        currentUrl: window.location.href,
        hasAuthClient: typeof window.authClient !== 'undefined',
        hasLocalStorage: typeof localStorage !== 'undefined',
        hasCookies: document.cookie.length > 0,
        cookies: document.cookie,
        localStorage: {},
        sessionStorage: {},
        globalObjects: [],
        betterAuthObjects: []
      };
      
      // Check localStorage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            analysis.localStorage[key] = localStorage.getItem(key);
          }
        }
      } catch (error) {
        analysis.localStorageError = error.message;
      }
      
      // Check sessionStorage
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            analysis.sessionStorage[key] = sessionStorage.getItem(key);
          }
        }
      } catch (error) {
        analysis.sessionStorageError = error.message;
      }
      
      // Look for global objects that might be related to auth
      for (const key in window) {
        if (key.toLowerCase().includes('auth') || 
            key.toLowerCase().includes('session') ||
            key.toLowerCase().includes('better')) {
          analysis.globalObjects.push(key);
        }
      }
      
      // Check for Better Auth specific objects
      if (window.__BETTER_AUTH__) {
        analysis.betterAuthObjects.push('__BETTER_AUTH__');
      }
      
      return analysis;
    }, baseUrl);
    
    console.log('🔍 Authentication Analysis:');
    console.log('  Current URL:', authAnalysis.currentUrl);
    console.log('  Has authClient:', authAnalysis.hasAuthClient);
    console.log('  Cookies:', authAnalysis.cookies || 'none');
    console.log('  localStorage keys:', Object.keys(authAnalysis.localStorage));
    console.log('  sessionStorage keys:', Object.keys(authAnalysis.sessionStorage));
    console.log('  Auth-related global objects:', authAnalysis.globalObjects);
    console.log('  Better Auth objects:', authAnalysis.betterAuthObjects);
    
    // Try to navigate to a protected route and see what happens
    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    const protectedRouteAnalysis = await page.evaluate(() => {
      return {
        finalUrl: window.location.href,
        title: document.title,
        bodyContent: document.body.textContent.substring(0, 200),
        hasLoadingSpinner: !!document.querySelector('.animate-spin'),
        hasErrorMessage: document.body.textContent.toLowerCase().includes('error'),
        redirected: window.location.href.includes('/auth')
      };
    });
    
    console.log('🔍 Protected Route Analysis:');
    console.log('  Final URL:', protectedRouteAnalysis.finalUrl);
    console.log('  Page title:', protectedRouteAnalysis.title);
    console.log('  Has loading spinner:', protectedRouteAnalysis.hasLoadingSpinner);
    console.log('  Redirected to auth:', protectedRouteAnalysis.redirected);
    
    await PuppeteerHelpers.takeScreenshot(page, 'auth-analysis-final');
    
    // Generate recommendations
    console.log('\n🎯 BYPASS STRATEGY RECOMMENDATIONS:');
    console.log('1. 🍪 Cookie-based approach: Set better-auth session cookies');
    console.log('2. 🔧 Mock authClient.getSession() in browser context');
    console.log('3. 🌐 Use test environment with disabled authentication');
    console.log('4. 🔗 Direct database session insertion for testing');
    console.log('5. 📡 Intercept and mock authentication API calls');
  });

}, 120000); // 2 minute timeout