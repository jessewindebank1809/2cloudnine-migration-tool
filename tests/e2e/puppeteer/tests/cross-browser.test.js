const AuthPage = require('../pages/auth-page');
const HomePage = require('../pages/home-page');
const MigrationsPage = require('../pages/migrations-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Cross-Browser Compatibility Tests', () => {
  let authPage;
  let homePage;
  let migrationsPage;

  beforeAll(() => {
    TestConfig.validate();
  });

  beforeEach(async () => {
    authPage = new AuthPage(page);
    homePage = new HomePage(page);
    migrationsPage = new MigrationsPage(page);
  });

  afterEach(async () => {
    if (await authPage.isUserLoggedIn()) {
      await authPage.logout();
    }
  });

  describe('BROWSER_001: Multi-Browser Testing', () => {
    const testBrowserCompatibility = (browserName) => {
      describe(`${browserName} Browser Tests`, () => {
        test(`should run OAuth flows correctly in ${browserName}`, async () => {
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

          await authPage.takeScreenshot(`${browserName}-oauth-success`);
        });

        test(`should display consistent UI elements in ${browserName}`, async () => {
          await authPage.navigate('/');
          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          await homePage.navigateToHome();
          
          const dashboardElements = await homePage.verifyDashboardElements();
          
          Object.values(dashboardElements).forEach(isVisible => {
            expect(isVisible).toBe(true);
          });

          const welcomeMessage = await homePage.getWelcomeMessage();
          expect(welcomeMessage).toBeTruthy();
        });

        test(`should handle real-time updates in ${browserName}`, async () => {
          await authPage.navigate('/');
          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          await migrationsPage.navigateToNewMigration();
          
          const projectData = TestData.createMigrationProject();
          await migrationsPage.createMigrationProject(projectData);
          await migrationsPage.selectMigrationProject(projectData.name);
          await migrationsPage.executeMigration();

          const hasRealTimeUpdates = await migrationsPage.waitForRealTimeUpdates();
          expect(hasRealTimeUpdates).toBe(true);

          const progress = await migrationsPage.getMigrationProgress();
          expect(typeof progress).toBe('number');
          expect(progress).toBeGreaterThanOrEqual(0);
        });

        test(`should maintain responsive design in ${browserName}`, async () => {
          await authPage.navigate('/');
          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          const viewports = [
            { width: 320, height: 568 },   // Mobile
            { width: 768, height: 1024 },  // Tablet
            { width: 1920, height: 1080 }  // Desktop
          ];

          for (const viewport of viewports) {
            await page.setViewport(viewport);
            
            await homePage.navigateToHome();
            
            const dashboardElements = await homePage.verifyDashboardElements();
            const visibleElements = Object.values(dashboardElements).filter(Boolean).length;
            expect(visibleElements).toBeGreaterThan(0);

            await authPage.takeScreenshot(`${browserName}-responsive-${viewport.width}x${viewport.height}`);
          }

          await page.setViewport({ width: 1920, height: 1080 });
        });

        test(`should validate JavaScript functionality in ${browserName}`, async () => {
          await authPage.navigate('/');
          
          const consoleErrors = [];
          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              consoleErrors.push(msg.text());
            }
          });

          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          await homePage.navigateToMigrations();
          await migrationsPage.navigateToNewMigration();

          const criticalErrors = consoleErrors.filter(error => 
            !error.includes('favicon') && 
            !error.includes('AdBlock') &&
            !error.includes('extension')
          );

          expect(criticalErrors.length).toBe(0);
        });

        test(`should handle form interactions correctly in ${browserName}`, async () => {
          await authPage.navigate('/');
          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          await migrationsPage.navigateToNewMigration();
          
          const projectData = TestData.createMigrationProject();
          
          await migrationsPage.type('[data-testid="migration-name-input"]', projectData.name);
          const inputValue = await page.$eval('[data-testid="migration-name-input"]', el => el.value);
          expect(inputValue).toBe(projectData.name);

          await migrationsPage.type('[data-testid="migration-description-input"]', projectData.description);
          const descValue = await page.$eval('[data-testid="migration-description-input"]', el => el.value);
          expect(descValue).toBe(projectData.description);
        });

        test(`should validate CSS rendering in ${browserName}`, async () => {
          await authPage.navigate('/');
          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          await homePage.navigateToHome();
          
          const buttonStyles = await page.$eval('[data-testid="new-migration-button"]', (el) => {
            const styles = window.getComputedStyle(el);
            return {
              display: styles.display,
              visibility: styles.visibility,
              backgroundColor: styles.backgroundColor,
              borderRadius: styles.borderRadius
            };
          });

          expect(buttonStyles.display).not.toBe('none');
          expect(buttonStyles.visibility).not.toBe('hidden');
          expect(buttonStyles.backgroundColor).toBeTruthy();
        });

        test(`should handle navigation correctly in ${browserName}`, async () => {
          await authPage.navigate('/');
          await authPage.clickSignInWithSalesforce();
          await authPage.completeSalesforceOAuth(
            TestData.users.admin.username,
            TestData.users.admin.password
          );

          const navigationPaths = [
            { page: homePage, method: 'navigateToMigrations', expectedUrl: '/migrations' },
            { page: homePage, method: 'navigateToOrgs', expectedUrl: '/orgs' },
            { page: homePage, method: 'navigateToTemplates', expectedUrl: '/templates' }
          ];

          for (const nav of navigationPaths) {
            await nav.page[nav.method]();
            
            const currentUrl = await page.url();
            expect(currentUrl).toContain(nav.expectedUrl);
            
            await page.waitForTimeout(1000);
          }
        });

        test(`should maintain session consistency in ${browserName}`, async () => {
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

          await homePage.navigateToMigrations();
          expect(await authPage.isUserLoggedIn()).toBe(true);
        });
      });
    };

    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    
    browsers.forEach(browser => {
      if (process.env.BROWSER_TEST_ALL || process.env[`TEST_${browser.toUpperCase()}`]) {
        testBrowserCompatibility(browser);
      }
    });

    if (!process.env.BROWSER_TEST_ALL && !browsers.some(b => process.env[`TEST_${b.toUpperCase()}`])) {
      testBrowserCompatibility('Chrome');
    }
  });
});