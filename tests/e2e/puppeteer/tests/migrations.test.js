const AuthPage = require('../pages/auth-page');
const MigrationsPage = require('../pages/migrations-page');
const OrgsPage = require('../pages/orgs-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Migration Workflow Tests', () => {
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

    await orgsPage.navigateToOrgs();
    await orgsPage.connectNewOrg();
    await orgsPage.clickConnectSalesforce();
    await authPage.completeSalesforceOAuth(
      TestData.users.admin.username,
      TestData.users.admin.password
    );

    await orgsPage.connectNewOrg();
    await orgsPage.clickConnectSalesforce();
    await authPage.completeSalesforceOAuth(
      TestData.users.target.username,
      TestData.users.target.password
    );
  });

  afterEach(async () => {
    await authPage.logout();
  });

  describe('MIG_001: Migration Project Creation', () => {
    test('should create new migration project successfully', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);

      const projects = await migrationsPage.getMigrationProjects();
      const createdProject = projects.find(p => p.name === projectData.name);
      
      expect(createdProject).toBeTruthy();
      expect(createdProject.status).toBe('Draft');

      await migrationsPage.takeScreenshot('migration-project-created');
    });

    test('should validate migration configuration before saving', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const invalidProject = {
        name: '',
        description: 'Test project without name',
        sourceOrg: '',
        targetOrg: 'Test Target Org',
        objects: []
      };

      await migrationsPage.createMigrationProject(invalidProject);
      
      const currentUrl = await migrationsPage.getCurrentUrl();
      expect(currentUrl).toContain('/migrations/new');
    });

    test('should prevent creating migration with same source and target org', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const invalidProject = {
        name: 'Invalid Migration',
        description: 'Same source and target',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Source Org',
        objects: ['Contact']
      };

      await migrationsPage.createMigrationProject(invalidProject);
      
      const currentUrl = await migrationsPage.getCurrentUrl();
      expect(currentUrl).toContain('/migrations/new');
    });

    test('should save project configuration correctly', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);

      const projects = await migrationsPage.getMigrationProjects();
      const savedProject = projects.find(p => p.name === projectData.name);
      
      expect(savedProject).toBeTruthy();
      
      await migrationsPage.selectMigrationProject(projectData.name);
      
      const currentUrl = await migrationsPage.getCurrentUrl();
      expect(currentUrl).toContain('/migrations/');
    });
  });

  describe('MIG_002: Migration Execution and Monitoring', () => {
    let projectData;

    beforeEach(async () => {
      await migrationsPage.navigateToNewMigration();
      projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);
      await migrationsPage.selectMigrationProject(projectData.name);
    });

    test('should start migration execution successfully', async () => {
      await migrationsPage.executeMigration();
      
      const status = await migrationsPage.getMigrationStatus();
      expect(['Running', 'In Progress', 'Processing']).toContain(status);

      const progress = await migrationsPage.getMigrationProgress();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);

      await migrationsPage.takeScreenshot('migration-executing');
    });

    test('should display real-time progress updates', async () => {
      await migrationsPage.executeMigration();
      
      const hasRealTimeUpdates = await migrationsPage.waitForRealTimeUpdates();
      expect(hasRealTimeUpdates).toBe(true);

      const initialProgress = await migrationsPage.getMigrationProgress();
      
      await page.waitForTimeout(5000);
      
      const updatedProgress = await migrationsPage.getMigrationProgress();
      expect(updatedProgress).toBeGreaterThanOrEqual(initialProgress);
    });

    test('should show detailed progress indicators', async () => {
      await migrationsPage.executeMigration();
      
      const status = await migrationsPage.getMigrationStatus();
      expect(status).toBeTruthy();
      
      const progress = await migrationsPage.getMigrationProgress();
      expect(typeof progress).toBe('number');
      
      const logs = await migrationsPage.getMigrationLogs();
      expect(Array.isArray(logs)).toBe(true);
    });

    test('should complete migration and show final status', async () => {
      await migrationsPage.executeMigration();
      
      const completed = await migrationsPage.waitForMigrationCompletion();
      expect(completed).toBe(true);

      const finalStatus = await migrationsPage.getMigrationStatus();
      expect(['Completed', 'Failed', 'Completed with Errors']).toContain(finalStatus);

      const finalProgress = await migrationsPage.getMigrationProgress();
      expect(finalProgress).toBe(100);

      await migrationsPage.takeScreenshot('migration-completed');
    });
  });

  describe('MIG_003: Migration Results Validation', () => {
    let projectData;

    beforeEach(async () => {
      await migrationsPage.navigateToNewMigration();
      projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);
      await migrationsPage.selectMigrationProject(projectData.name);
      await migrationsPage.executeMigration();
      await migrationsPage.waitForMigrationCompletion();
    });

    test('should display accurate success/failure statistics', async () => {
      const results = await migrationsPage.getMigrationResults();
      
      expect(results.successCount).toBeTruthy();
      expect(results.failureCount).toBeDefined();
      
      const successCount = parseInt(results.successCount);
      const failureCount = parseInt(results.failureCount);
      
      expect(successCount).toBeGreaterThanOrEqual(0);
      expect(failureCount).toBeGreaterThanOrEqual(0);
      expect(successCount + failureCount).toBeGreaterThan(0);
    });

    test('should provide detailed record-level logs', async () => {
      const logs = await migrationsPage.getMigrationLogs();
      
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      
      logs.forEach(log => {
        expect(log.timestamp).toBeTruthy();
        expect(log.level).toBeTruthy();
        expect(log.message).toBeTruthy();
      });
    });

    test('should show detailed error information for failed records', async () => {
      const errors = await migrationsPage.getMigrationErrors();
      
      if (errors.length > 0) {
        errors.forEach(error => {
          expect(error.record || error.message).toBeTruthy();
          expect(error.message).toBeTruthy();
        });
      }
    });

    test('should allow downloading migration reports', async () => {
      const download = await migrationsPage.downloadReport();
      
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toContain('migration');
      expect(download.suggestedFilename()).toMatch(/\.(csv|pdf|xlsx)$/);
    });

    test('should maintain complete audit trail', async () => {
      const logs = await migrationsPage.getMigrationLogs();
      
      const startLog = logs.find(log => 
        log.message.includes('Migration started') || log.level === 'info'
      );
      expect(startLog).toBeTruthy();
      
      const endLog = logs.find(log => 
        log.message.includes('Migration completed') || log.message.includes('finished')
      );
      expect(endLog).toBeTruthy();
      
      const hasProcessingLogs = logs.some(log => 
        log.message.includes('Processing') || log.message.includes('record')
      );
      expect(hasProcessingLogs).toBe(true);
    });
  });
});