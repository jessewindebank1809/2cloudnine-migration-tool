const AuthPage = require('../pages/auth-page');
const HomePage = require('../pages/home-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Authentication Flow Tests', () => {
  let authPage;
  let homePage;

  beforeAll(() => {
    TestConfig.validate();
  });

  beforeEach(async () => {
    authPage = new AuthPage(page);
    homePage = new HomePage(page);
  });

  afterEach(async () => {
    await authPage.logout();
  });

  describe('AUTH_001: Salesforce OAuth Sign-In', () => {
    test('should complete OAuth flow and redirect to home dashboard', async () => {
      await authPage.navigate('/');
      
      const isRedirectedToSignIn = await authPage.verifySignInPage();
      expect(isRedirectedToSignIn).toBe(true);

      await authPage.clickSignInWithSalesforce();

      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      const isOnHomePage = await homePage.isOnHomePage();
      expect(isOnHomePage).toBe(true);

      const isLoggedIn = await authPage.isUserLoggedIn();
      expect(isLoggedIn).toBe(true);

      const userProfile = await authPage.getUserProfileText();
      expect(userProfile).toBeTruthy();

      await authPage.takeScreenshot('auth-success');
    });

    test('should handle invalid credentials gracefully', async () => {
      await authPage.navigateToSignIn();
      await authPage.clickSignInWithSalesforce();

      await authPage.completeSalesforceOAuth(
        'invalid@example.com',
        'wrongpassword'
      );

      const isStillOnSignIn = await authPage.verifySignInPage();
      expect(isStillOnSignIn).toBe(true);

      const isLoggedIn = await authPage.isUserLoggedIn();
      expect(isLoggedIn).toBe(false);
    });
  });

  describe('AUTH_002: Authentication Persistence', () => {
    test('should persist session across browser refresh', async () => {
      await authPage.navigate('/');
      await authPage.clickSignInWithSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      expect(await authPage.isUserLoggedIn()).toBe(true);

      await page.reload({ waitUntil: 'networkidle0' });

      const isStillLoggedIn = await authPage.isUserLoggedIn();
      expect(isStillLoggedIn).toBe(true);

      const isOnHomePage = await homePage.isOnHomePage();
      expect(isOnHomePage).toBe(true);
    });

    test('should maintain session when navigating to protected routes', async () => {
      await authPage.navigate('/');
      await authPage.clickSignInWithSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      await homePage.navigateToMigrations();
      expect(await authPage.isUserLoggedIn()).toBe(true);

      await homePage.navigateToOrgs();
      expect(await authPage.isUserLoggedIn()).toBe(true);

      await homePage.navigateToTemplates();
      expect(await authPage.isUserLoggedIn()).toBe(true);
    });
  });

  describe('AUTH_003: Sign-Out Flow', () => {
    test('should successfully log out and redirect to sign-in', async () => {
      await authPage.navigate('/');
      await authPage.clickSignInWithSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      expect(await authPage.isUserLoggedIn()).toBe(true);

      await authPage.logout();

      const isRedirectedToSignIn = await authPage.verifySignInPage();
      expect(isRedirectedToSignIn).toBe(true);

      const isLoggedOut = await authPage.isUserLoggedIn();
      expect(isLoggedOut).toBe(false);
    });

    test('should prevent access to protected routes after logout', async () => {
      await authPage.navigate('/');
      await authPage.clickSignInWithSalesforce();
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );

      await authPage.logout();

      await authPage.navigate('/migrations');
      const isRedirectedFromMigrations = await authPage.verifySignInPage();
      expect(isRedirectedFromMigrations).toBe(true);

      await authPage.navigate('/orgs');
      const isRedirectedFromOrgs = await authPage.verifySignInPage();
      expect(isRedirectedFromOrgs).toBe(true);

      await authPage.navigate('/analytics');
      const isRedirectedFromAnalytics = await authPage.verifySignInPage();
      expect(isRedirectedFromAnalytics).toBe(true);
    });
  });
});