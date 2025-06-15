/**
 * Authentication Bypass Utilities for UI Testing
 * 
 * This module provides various strategies to bypass authentication
 * for UI testing purposes, enabling headless testing of protected routes.
 */

class AuthBypass {
  constructor(page) {
    this.page = page;
  }

  /**
   * Strategy 1: Mock Better Auth Session in Browser Context
   * This approach overrides the authClient.getSession() method
   */
  async mockBetterAuthSession() {
    console.log('🔧 Applying Strategy 1: Mock Better Auth Session');
    
    return await this.page.evaluate(() => {
      // Create a mock session that matches Better Auth's expected structure
      const mockSessionData = {
        data: {
          user: {
            id: 'test-user-12345',
            email: 'testuser@2cloudnine.com+test-org@salesforce.local',
            name: 'Test User',
            image: null,
            salesforceOrgId: 'test-org-12345',
            salesforceInstanceUrl: 'https://test.salesforce.com'
          },
          session: {
            id: 'test-session-12345',
            token: 'test-session-token-12345',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            userId: 'test-user-12345'
          }
        }
      };

      try {
        // Method 1: Override global authClient if it exists
        if (window.authClient && window.authClient.getSession) {
          const originalGetSession = window.authClient.getSession;
          window.authClient.getSession = async () => {
            console.log('🔧 Mock authClient.getSession called');
            return mockSessionData;
          };
          window.__MOCK_AUTH_APPLIED__ = true;
          return { success: true, method: 'authClient override' };
        }

        // Method 2: Store session data in localStorage (Better Auth might check this)
        localStorage.setItem('better-auth.session-token', 'test-session-token-12345');
        localStorage.setItem('better-auth.user', JSON.stringify(mockSessionData.data.user));
        localStorage.setItem('better-auth.session', JSON.stringify(mockSessionData));

        // Method 3: Set various cookie patterns Better Auth might use
        const cookieOptions = '; path=/; SameSite=Lax';
        document.cookie = `better-auth.session-token=test-session-token-12345${cookieOptions}`;
        document.cookie = `better-auth.session=test-session-token-12345${cookieOptions}`;
        document.cookie = `auth-token=test-session-token-12345${cookieOptions}`;
        document.cookie = `session=test-session-token-12345${cookieOptions}`;

        // Method 4: Override fetch to intercept auth API calls
        const originalFetch = window.fetch;
        window.fetch = async (url, options) => {
          // Intercept auth-related API calls
          if (typeof url === 'string' && (
            url.includes('/api/auth/session') || 
            url.includes('/api/auth/check') ||
            url.includes('/api/auth/me')
          )) {
            console.log('🔧 Intercepted auth API call:', url);
            return new Response(JSON.stringify(mockSessionData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return originalFetch(url, options);
        };

        window.__MOCK_AUTH_APPLIED__ = true;
        return { success: true, method: 'localStorage, cookies, and fetch override' };

      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Strategy 2: Set Authentication Cookies Directly
   */
  async setCookieBasedAuth() {
    console.log('🔧 Applying Strategy 2: Cookie-Based Auth');
    
    const baseUrl = this.page.url() || 'http://localhost:3000';
    const domain = new URL(baseUrl).hostname;

    const cookiesToSet = [
      {
        name: 'better-auth.session-token',
        value: 'test-session-token-12345',
        domain: domain,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax'
      },
      {
        name: 'better-auth.session',
        value: 'test-session-token-12345',
        domain: domain,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax'
      },
      {
        name: 'auth-token',
        value: 'test-session-token-12345',
        domain: domain,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax'
      }
    ];

    try {
      for (const cookie of cookiesToSet) {
        await this.page.setCookie(cookie);
      }
      console.log('✅ Authentication cookies set successfully');
      return { success: true, cookiesSet: cookiesToSet.length };
    } catch (error) {
      console.log('❌ Failed to set authentication cookies:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Strategy 3: Request Interception for Auth APIs
   */
  async interceptAuthRequests() {
    console.log('🔧 Applying Strategy 3: Request Interception');
    
    const mockSessionData = {
      data: {
        user: {
          id: 'test-user-12345',
          email: 'testuser@2cloudnine.com+test-org@salesforce.local',
          name: 'Test User',
          salesforceOrgId: 'test-org-12345',
          salesforceInstanceUrl: 'https://test.salesforce.com'
        },
        session: {
          id: 'test-session-12345',
          token: 'test-session-token-12345',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    };

    try {
      await this.page.setRequestInterception(true);
      
      this.page.on('request', (request) => {
        const url = request.url();
        
        // Intercept authentication-related requests
        if (url.includes('/api/auth/session') || 
            url.includes('/api/auth/check') ||
            url.includes('/api/auth/me')) {
          
          console.log('🔧 Intercepting auth request:', url);
          
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockSessionData)
          });
        } else {
          request.continue();
        }
      });

      console.log('✅ Request interception activated');
      return { success: true, method: 'request interception' };
    } catch (error) {
      console.log('❌ Failed to set up request interception:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Strategy 4: Combined Approach (Recommended)
   * Uses multiple strategies for maximum compatibility
   */
  async applyAllStrategies() {
    console.log('🚀 Applying All Authentication Bypass Strategies');
    
    const results = {};

    // Apply cookie-based auth
    results.cookies = await this.setCookieBasedAuth();

    // Apply session mocking
    results.sessionMock = await this.mockBetterAuthSession();

    // Apply request interception
    results.requestInterception = await this.interceptAuthRequests();

    console.log('📊 Authentication Bypass Results:', results);
    
    const successCount = Object.values(results).filter(r => r.success).length;
    return {
      success: successCount > 0,
      appliedStrategies: successCount,
      totalStrategies: Object.keys(results).length,
      details: results
    };
  }

  /**
   * Verify if authentication bypass was successful
   */
  async verifyAuthBypass(baseUrl) {
    console.log('🔍 Verifying authentication bypass...');
    
    try {
      // Try to navigate to a protected route
      await this.page.goto(`${baseUrl}/home`, { 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for auth check

      const verification = await this.page.evaluate(() => {
        return {
          currentUrl: window.location.href,
          title: document.title,
          isOnAuthPage: window.location.href.includes('/auth'),
          isOnHomePage: window.location.href.includes('/home'),
          hasLoadingSpinner: !!document.querySelector('.animate-spin'),
          pageContent: document.body.textContent.substring(0, 100),
          hasMockAuth: window.__MOCK_AUTH_APPLIED__ || false
        };
      });

      const isAuthenticated = !verification.isOnAuthPage && 
                            (verification.isOnHomePage || !verification.currentUrl.includes('/auth'));

      console.log('🔍 Verification Results:');
      console.log('  Current URL:', verification.currentUrl);
      console.log('  Is authenticated:', isAuthenticated);
      console.log('  Mock auth applied:', verification.hasMockAuth);
      console.log('  Has loading spinner:', verification.hasLoadingSpinner);

      return {
        success: isAuthenticated,
        currentUrl: verification.currentUrl,
        details: verification
      };

    } catch (error) {
      console.log('❌ Verification failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Quick bypass method for testing (combines all strategies and verifies)
   */
  async quickBypass(baseUrl) {
    console.log('⚡ Performing Quick Authentication Bypass');
    
    // Apply all strategies
    const bypassResult = await this.applyAllStrategies();
    
    if (!bypassResult.success) {
      console.log('❌ All bypass strategies failed');
      return { success: false, reason: 'All strategies failed', details: bypassResult };
    }

    // Wait a moment for strategies to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the bypass worked
    const verification = await this.verifyAuthBypass(baseUrl);
    
    return {
      success: verification.success,
      bypassStrategies: bypassResult.appliedStrategies,
      currentUrl: verification.currentUrl,
      details: { bypass: bypassResult, verification: verification }
    };
  }
}

module.exports = AuthBypass;