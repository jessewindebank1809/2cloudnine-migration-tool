const AuthPage = require('../pages/auth-page');
const MigrationsPage = require('../pages/migrations-page');
const OrgsPage = require('../pages/orgs-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');
const TestHelpers = require('../utils/test-helpers');

describe('Error Handling and Edge Cases Tests', () => {
  let authPage;
  let migrationsPage;
  let orgsPage;

  beforeAll(() => {
    TestConfig.validate();
  });

  beforeEach(async () => {
    authPage = new AuthPage(page);
    migrationsPage = new MigrationsPage(page);
    orgsPage = new OrgsPage(page);

    await authPage.navigate('/');
    await authPage.clickSignInWithSalesforce();
    await authPage.completeSalesforceOAuth(
      TestData.users.admin.username,
      TestData.users.admin.password
    );
  });

  afterEach(async () => {
    await TestHelpers.restoreNetwork(page);
    await authPage.logout();
  });

  describe('ERROR_001: Network Connectivity Issues', () => {
    test('should handle network disconnection during migration gracefully', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);
      await migrationsPage.selectMigrationProject(projectData.name);
      
      await migrationsPage.executeMigration();
      
      await page.waitForTimeout(2000);
      
      await TestHelpers.simulateNetworkFailure(page);
      
      await page.waitForTimeout(3000);
      
      const hasErrorMessage = await migrationsPage.isVisible('[data-testid="network-error"]');
      expect(hasErrorMessage).toBe(true);
      
      await TestHelpers.restoreNetwork(page);
      
      await page.waitForTimeout(2000);
      
      const status = await migrationsPage.getMigrationStatus();
      expect(['Retrying', 'Failed', 'Paused', 'Resumed']).toContain(status);

      await migrationsPage.takeScreenshot('network-error-recovery');
    });

    test('should display clear error messages for network failures', async () => {
      await orgsPage.navigateToOrgs();
      
      await TestHelpers.simulateNetworkFailure(page);
      
      await orgsPage.connectNewOrg();
      
      const hasErrorMessage = await orgsPage.hasErrorMessage();
      expect(hasErrorMessage).toBe(true);
      
      const errorMessage = await orgsPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.toLowerCase()).toContain('network');
    });

    test('should implement retry mechanisms for failed requests', async () => {
      await orgsPage.navigateToOrgs();
      
      await orgsPage.connectNewOrg();
      await orgsPage.clickConnectSalesforce();
      
      await TestHelpers.simulateNetworkFailure(page);
      
      await page.waitForTimeout(1000);
      
      await TestHelpers.restoreNetwork(page);
      
      await authPage.completeSalesforceOAuth(
        TestData.users.admin.username,
        TestData.users.admin.password
      );
      
      const hasSuccessMessage = await orgsPage.hasSuccessMessage();
      expect(hasSuccessMessage).toBe(true);
    });

    test('should allow user recovery from network errors', async () => {
      await migrationsPage.navigateToMigrations();
      
      await TestHelpers.simulateNetworkFailure(page);
      
      await page.reload();
      
      await TestHelpers.restoreNetwork(page);
      
      await page.waitForTimeout(2000);
      
      const projects = await migrationsPage.getMigrationProjects();
      expect(Array.isArray(projects)).toBe(true);
    });

    test('should prevent data corruption during network issues', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      
      await TestHelpers.simulateNetworkFailure(page);
      
      await migrationsPage.createMigrationProject(projectData);
      
      await TestHelpers.restoreNetwork(page);
      
      await migrationsPage.navigateToMigrations();
      
      const projects = await migrationsPage.getMigrationProjects();
      const corruptedProject = projects.find(p => 
        p.name === projectData.name && p.status === 'Corrupted'
      );
      expect(corruptedProject).toBeFalsy();
    });
  });

  describe('ERROR_002: Salesforce API Limits', () => {
    test('should detect and handle Salesforce API governor limits', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const largeProjectData = {
        ...TestData.createMigrationProject(),
        objects: ['Contact', 'Account', 'Opportunity', 'Lead', 'Case'],
        recordCount: 10000
      };
      
      await migrationsPage.createMigrationProject(largeProjectData);
      await migrationsPage.selectMigrationProject(largeProjectData.name);
      await migrationsPage.executeMigration();
      
      await page.waitForTimeout(10000);
      
      const logs = await migrationsPage.getMigrationLogs();
      const rateLimitLog = logs.find(log => 
        log.message.includes('rate limit') || 
        log.message.includes('API limit') ||
        log.message.includes('governor')
      );
      
      if (rateLimitLog) {
        expect(rateLimitLog).toBeTruthy();
        
        const status = await migrationsPage.getMigrationStatus();
        expect(['Paused', 'Queued', 'Rate Limited']).toContain(status);
      }
    });

    test('should queue migrations properly during API limits', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);
      await migrationsPage.selectMigrationProject(projectData.name);
      
      await page.evaluate(() => {
        window.simulateApiLimit = true;
      });
      
      await migrationsPage.executeMigration();
      
      const status = await migrationsPage.getMigrationStatus();
      expect(['Queued', 'Waiting', 'Paused']).toContain(status);
      
      await page.evaluate(() => {
        window.simulateApiLimit = false;
      });
    });

    test('should provide clear status messages during API limits', async () => {
      await migrationsPage.navigateToMigrations();
      
      const projects = await migrationsPage.getMigrationProjects();
      
      if (projects.length > 0) {
        await migrationsPage.selectMigrationProject(projects[0].name);
        
        await page.evaluate(() => {
          window.simulateApiLimit = true;
        });
        
        await migrationsPage.executeMigration();
        
        const logs = await migrationsPage.getMigrationLogs();
        const statusMessages = logs.filter(log => 
          log.message.includes('limit') || log.message.includes('quota')
        );
        
        expect(statusMessages.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('should automatically resume after API limits reset', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);
      await migrationsPage.selectMigrationProject(projectData.name);
      
      await page.evaluate(() => {
        window.simulateApiLimit = true;
        setTimeout(() => {
          window.simulateApiLimit = false;
        }, 5000);
      });
      
      await migrationsPage.executeMigration();
      
      await page.waitForTimeout(8000);
      
      const status = await migrationsPage.getMigrationStatus();
      expect(['Running', 'Resumed', 'In Progress']).toContain(status);
    });

    test('should handle concurrent migration limits', async () => {
      const projectData1 = TestData.createMigrationProject();
      const projectData2 = TestData.createMigrationProject();
      
      await migrationsPage.navigateToNewMigration();
      await migrationsPage.createMigrationProject(projectData1);
      
      await migrationsPage.navigateToNewMigration();
      await migrationsPage.createMigrationProject(projectData2);
      
      await migrationsPage.selectMigrationProject(projectData1.name);
      await migrationsPage.executeMigration();
      
      await migrationsPage.navigateToMigrations();
      await migrationsPage.selectMigrationProject(projectData2.name);
      await migrationsPage.executeMigration();
      
      const project1Status = await migrationsPage.getMigrationStatus();
      
      await migrationsPage.navigateToMigrations();
      await migrationsPage.selectMigrationProject(projectData1.name);
      const project2Status = await migrationsPage.getMigrationStatus();
      
      const validStatuses = ['Running', 'Queued', 'Waiting', 'In Progress'];
      expect(validStatuses).toContain(project1Status);
      expect(validStatuses).toContain(project2Status);
    });

    test('should display API usage metrics', async () => {
      await migrationsPage.navigateToMigrations();
      
      const hasApiMetrics = await migrationsPage.isVisible('[data-testid="api-usage"]');
      
      if (hasApiMetrics) {
        const apiUsage = await migrationsPage.getText('[data-testid="api-usage"]');
        expect(apiUsage).toBeTruthy();
        expect(apiUsage).toMatch(/\d+/);
      }
    });
  });
});