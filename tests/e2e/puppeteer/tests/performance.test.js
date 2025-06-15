const AuthPage = require('../pages/auth-page');
const MigrationsPage = require('../pages/migrations-page');
const OrgsPage = require('../pages/orgs-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Performance and Load Tests', () => {
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
    await authPage.logout();
  });

  describe('PERF_001: Large Dataset Migration Performance', () => {
    test('should handle large dataset migration within acceptable timeframes', async () => {
      const startTime = Date.now();
      
      await migrationsPage.navigateToNewMigration();
      
      const largeDatasetProject = {
        name: `Large_Dataset_Test_${Date.now()}`,
        description: 'Performance test with large dataset',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Target Org',
        objects: ['Contact', 'Account'],
        recordCount: 10000
      };
      
      await migrationsPage.createMigrationProject(largeDatasetProject);
      await migrationsPage.selectMigrationProject(largeDatasetProject.name);
      
      const migrationStartTime = Date.now();
      await migrationsPage.executeMigration();
      
      const completed = await migrationsPage.waitForMigrationCompletion(1800000); // 30 minutes
      expect(completed).toBe(true);
      
      const migrationEndTime = Date.now();
      const migrationDuration = migrationEndTime - migrationStartTime;
      
      expect(migrationDuration).toBeLessThan(1800000); // Under 30 minutes
      
      const results = await migrationsPage.getMigrationResults();
      expect(results.successCount).toBeTruthy();

      await migrationsPage.takeScreenshot('large-dataset-completed');
    });

    test('should maintain UI responsiveness during large migrations', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const largeProject = {
        name: `UI_Responsiveness_Test_${Date.now()}`,
        description: 'UI responsiveness test',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Target Org',
        objects: ['Contact', 'Account', 'Opportunity'],
        recordCount: 5000
      };
      
      await migrationsPage.createMigrationProject(largeProject);
      await migrationsPage.selectMigrationProject(largeProject.name);
      await migrationsPage.executeMigration();
      
      const responseTimes = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await migrationsPage.click('[data-testid="progress-bar"]');
        await page.waitForTimeout(100);
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        await page.waitForTimeout(2000);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(averageResponseTime).toBeLessThan(2000); // Under 2 seconds
      
      const progress = await migrationsPage.getMigrationProgress();
      expect(typeof progress).toBe('number');
    });

    test('should monitor memory usage during processing', async () => {
      const metrics = await page.metrics();
      const initialMemory = metrics.JSHeapUsedSize;
      
      await migrationsPage.navigateToNewMigration();
      
      const memoryTestProject = {
        name: `Memory_Test_${Date.now()}`,
        description: 'Memory usage test',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Target Org',
        objects: ['Contact'],
        recordCount: 5000
      };
      
      await migrationsPage.createMigrationProject(memoryTestProject);
      await migrationsPage.selectMigrationProject(memoryTestProject.name);
      await migrationsPage.executeMigration();
      
      await page.waitForTimeout(10000);
      
      const duringMigrationMetrics = await page.metrics();
      const duringMigrationMemory = duringMigrationMetrics.JSHeapUsedSize;
      
      const memoryIncrease = duringMigrationMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      expect(memoryIncreaseMB).toBeLessThan(512); // Under 512MB
      
      await migrationsPage.waitForMigrationCompletion();
      
      const finalMetrics = await page.metrics();
      const finalMemory = finalMetrics.JSHeapUsedSize;
      
      expect(finalMemory).toBeLessThan(duringMigrationMemory * 1.5);
    });

    test('should verify progress reporting accuracy for large volumes', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const progressTestProject = {
        name: `Progress_Test_${Date.now()}`,
        description: 'Progress reporting accuracy test',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Target Org',
        objects: ['Contact'],
        recordCount: 1000
      };
      
      await migrationsPage.createMigrationProject(progressTestProject);
      await migrationsPage.selectMigrationProject(progressTestProject.name);
      await migrationsPage.executeMigration();
      
      const progressReadings = [];
      const startTime = Date.now();
      
      while (Date.now() - startTime < 30000) { // Monitor for 30 seconds
        const progress = await migrationsPage.getMigrationProgress();
        const timestamp = Date.now();
        
        progressReadings.push({ progress, timestamp });
        
        if (progress === 100) break;
        
        await page.waitForTimeout(2000);
      }
      
      expect(progressReadings.length).toBeGreaterThan(0);
      
      for (let i = 1; i < progressReadings.length; i++) {
        expect(progressReadings[i].progress).toBeGreaterThanOrEqual(progressReadings[i - 1].progress);
      }
      
      const finalProgress = progressReadings[progressReadings.length - 1].progress;
      expect(finalProgress).toBeGreaterThan(0);
    });

    test('should complete within performance benchmarks', async () => {
      const benchmarkStart = Date.now();
      
      await migrationsPage.navigateToNewMigration();
      
      const benchmarkProject = {
        name: `Benchmark_Test_${Date.now()}`,
        description: 'Performance benchmark test',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Target Org',
        objects: ['Contact'],
        recordCount: 1000
      };
      
      await migrationsPage.createMigrationProject(benchmarkProject);
      
      const projectCreationTime = Date.now() - benchmarkStart;
      expect(projectCreationTime).toBeLessThan(10000); // Under 10 seconds
      
      await migrationsPage.selectMigrationProject(benchmarkProject.name);
      
      const migrationStart = Date.now();
      await migrationsPage.executeMigration();
      
      const executionInitTime = Date.now() - migrationStart;
      expect(executionInitTime).toBeLessThan(5000); // Under 5 seconds to start
      
      await migrationsPage.waitForMigrationCompletion();
      
      const totalMigrationTime = Date.now() - migrationStart;
      const recordsPerSecond = 1000 / (totalMigrationTime / 1000);
      
      expect(recordsPerSecond).toBeGreaterThan(1); // At least 1 record per second
    });

    test('should handle concurrent page operations during migration', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const concurrentTestProject = {
        name: `Concurrent_Test_${Date.now()}`,
        description: 'Concurrent operations test',
        sourceOrg: 'Test Source Org',
        targetOrg: 'Test Target Org',
        objects: ['Contact'],
        recordCount: 2000
      };
      
      await migrationsPage.createMigrationProject(concurrentTestProject);
      await migrationsPage.selectMigrationProject(concurrentTestProject.name);
      await migrationsPage.executeMigration();
      
      const operations = [];
      
      for (let i = 0; i < 3; i++) {
        operations.push(
          (async () => {
            await page.waitForTimeout(1000 * i);
            const progress = await migrationsPage.getMigrationProgress();
            return progress;
          })()
        );
      }
      
      const results = await Promise.all(operations);
      
      results.forEach(progress => {
        expect(typeof progress).toBe('number');
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    });
  });
});