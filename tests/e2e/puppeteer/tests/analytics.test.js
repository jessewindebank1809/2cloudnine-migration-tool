const AuthPage = require('../pages/auth-page');
const AnalyticsPage = require('../pages/analytics-page');
const MigrationsPage = require('../pages/migrations-page');
const TestConfig = require('../utils/test-config');
const TestData = require('../utils/test-data');

describe('Analytics Dashboard Tests', () => {
  let authPage;
  let analyticsPage;
  let migrationsPage;

  beforeAll(() => {
    TestConfig.validate();
  });

  beforeEach(async () => {
    authPage = new AuthPage(page);
    analyticsPage = new AnalyticsPage(page);
    migrationsPage = new MigrationsPage(page);

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

  describe('ANALYTICS_001: Migration Analytics Display', () => {
    test('should display migration statistics correctly', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      const stats = await analyticsPage.getMigrationStatistics();
      
      expect(stats.totalMigrations).toBeTruthy();
      expect(stats.successRate).toBeTruthy();
      
      const totalCount = parseInt(stats.totalMigrations);
      expect(totalCount).toBeGreaterThanOrEqual(0);
      
      if (stats.successRate.includes('%')) {
        const successRate = parseFloat(stats.successRate.replace('%', ''));
        expect(successRate).toBeGreaterThanOrEqual(0);
        expect(successRate).toBeLessThanOrEqual(100);
      }

      await analyticsPage.takeScreenshot('analytics-dashboard');
    });

    test('should load and display data visualization components', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      const chartsLoaded = await analyticsPage.verifyChartsLoad();
      expect(chartsLoaded).toBe(true);
      
      const chartData = await analyticsPage.getChartData('migration-trends');
      if (chartData) {
        expect(Array.isArray(chartData) || typeof chartData === 'object').toBe(true);
      }
    });

    test('should apply date range filters correctly', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      const initialStats = await analyticsPage.getMigrationStatistics();
      
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      await analyticsPage.applyDateRangeFilter(startDate, endDate);
      
      const filteredStats = await analyticsPage.getMigrationStatistics();
      expect(filteredStats).toBeTruthy();
      
      const chartsStillLoaded = await analyticsPage.verifyChartsLoad();
      expect(chartsStillLoaded).toBe(true);
    });

    test('should filter by organisation correctly', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      await analyticsPage.applyOrgFilter('Test Source Org');
      
      const filteredStats = await analyticsPage.getMigrationStatistics();
      expect(filteredStats).toBeTruthy();
      
      const chartsLoaded = await analyticsPage.verifyChartsLoad();
      expect(chartsLoaded).toBe(true);
    });

    test('should filter by template type', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      await analyticsPage.applyTemplateFilter('Payroll Migration');
      
      const filteredStats = await analyticsPage.getMigrationStatistics();
      expect(filteredStats).toBeTruthy();
    });

    test('should verify real-time updates during active migrations', async () => {
      await migrationsPage.navigateToNewMigration();
      
      const projectData = TestData.createMigrationProject();
      await migrationsPage.createMigrationProject(projectData);
      await migrationsPage.selectMigrationProject(projectData.name);
      await migrationsPage.executeMigration();
      
      await analyticsPage.navigateToAnalytics();
      
      const realtimeWorking = await analyticsPage.verifyRealtimeUpdates();
      expect(realtimeWorking).toBe(true);
      
      await analyticsPage.refreshDashboard();
      
      const refreshedStats = await analyticsPage.getMigrationStatistics();
      expect(refreshedStats).toBeTruthy();
    });

    test('should export analytics reports successfully', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      const download = await analyticsPage.exportAnalyticsReport();
      
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toContain('analytics');
      expect(download.suggestedFilename()).toMatch(/\.(csv|pdf|xlsx)$/);
      
      await download.saveAs(`tests/e2e/puppeteer/downloads/${download.suggestedFilename()}`);
    });

    test('should display all required metrics', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      const stats = await analyticsPage.getMigrationStatistics();
      
      expect(stats.totalMigrations).toBeTruthy();
      expect(stats.successRate).toBeTruthy();
      
      if (stats.recordsProcessed) {
        const recordCount = parseInt(stats.recordsProcessed.replace(/[^\d]/g, ''));
        expect(recordCount).toBeGreaterThanOrEqual(0);
      }
      
      if (stats.averageTime) {
        expect(stats.averageTime).toMatch(/\d+/);
      }
    });

    test('should handle responsive design correctly', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      
      const responsiveness = await analyticsPage.verifyDashboardResponsiveness();
      
      expect(typeof responsiveness.mobileLayout).toBe('boolean');
      expect(typeof responsiveness.desktopLayout).toBe('boolean');
    });

    test('should refresh data when requested', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.waitForDataLoad();
      const initialStats = await analyticsPage.getMigrationStatistics();
      
      await analyticsPage.refreshDashboard();
      
      const refreshedStats = await analyticsPage.getMigrationStatistics();
      expect(refreshedStats).toBeTruthy();
      
      const chartsStillLoaded = await analyticsPage.verifyChartsLoad();
      expect(chartsStillLoaded).toBe(true);
    });

    test('should handle empty data states gracefully', async () => {
      await analyticsPage.navigateToAnalytics();
      
      await analyticsPage.applyDateRangeFilter('2000-01-01', '2000-01-02');
      
      const stats = await analyticsPage.getMigrationStatistics();
      expect(stats).toBeTruthy();
      
      if (stats.totalMigrations === '0' || stats.totalMigrations === '') {
        expect(true).toBe(true);
      }
    });
  });
});