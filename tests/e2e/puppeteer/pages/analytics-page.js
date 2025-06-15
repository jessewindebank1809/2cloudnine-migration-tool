const BasePage = require('./base-page');

class AnalyticsPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      dashboard: '[data-testid="analytics-dashboard"]',
      migrationStats: '[data-testid="migration-stats"]',
      successRate: '[data-testid="success-rate"]',
      totalMigrations: '[data-testid="total-migrations"]',
      recordsProcessed: '[data-testid="records-processed"]',
      averageTime: '[data-testid="average-time"]',
      chartContainer: '[data-testid="chart-container"]',
      dateRangeFilter: '[data-testid="date-range-filter"]',
      orgFilter: '[data-testid="org-filter"]',
      templateFilter: '[data-testid="template-filter"]',
      exportButton: '[data-testid="export-report-button"]',
      realtimeIndicator: '[data-testid="realtime-indicator"]',
      refreshButton: '[data-testid="refresh-button"]',
      loadingSpinner: '[data-testid="loading-spinner"]'
    };
  }

  async navigateToAnalytics() {
    await this.navigate('/analytics');
  }

  async getMigrationStatistics() {
    const stats = {};
    
    if (await this.isVisible(this.selectors.successRate)) {
      stats.successRate = await this.getText(this.selectors.successRate);
    }
    
    if (await this.isVisible(this.selectors.totalMigrations)) {
      stats.totalMigrations = await this.getText(this.selectors.totalMigrations);
    }
    
    if (await this.isVisible(this.selectors.recordsProcessed)) {
      stats.recordsProcessed = await this.getText(this.selectors.recordsProcessed);
    }
    
    if (await this.isVisible(this.selectors.averageTime)) {
      stats.averageTime = await this.getText(this.selectors.averageTime);
    }
    
    return stats;
  }

  async verifyChartsLoad() {
    await this.waitForSelector(this.selectors.chartContainer);
    
    const charts = await this.page.$$eval(
      `${this.selectors.chartContainer} canvas, ${this.selectors.chartContainer} svg`,
      elements => elements.length
    );
    
    return charts > 0;
  }

  async applyDateRangeFilter(startDate, endDate) {
    await this.click(this.selectors.dateRangeFilter);
    
    await this.type('[data-testid="start-date"]', startDate);
    await this.type('[data-testid="end-date"]', endDate);
    
    await this.click('[data-testid="apply-filter"]');
    await this.waitForSelector(this.selectors.loadingSpinner, { hidden: true });
  }

  async applyOrgFilter(orgName) {
    await this.click(this.selectors.orgFilter);
    await this.click(`[data-value="${orgName}"]`);
    await this.waitForSelector(this.selectors.loadingSpinner, { hidden: true });
  }

  async applyTemplateFilter(templateName) {
    await this.click(this.selectors.templateFilter);
    await this.click(`[data-value="${templateName}"]`);
    await this.waitForSelector(this.selectors.loadingSpinner, { hidden: true });
  }

  async exportAnalyticsReport() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.click(this.selectors.exportButton)
    ]);
    
    return download;
  }

  async verifyRealtimeUpdates() {
    const initialStats = await this.getMigrationStatistics();
    
    await this.page.waitForFunction(
      (initial) => {
        const indicator = document.querySelector('[data-testid="realtime-indicator"]');
        return indicator && indicator.classList.contains('active');
      },
      {},
      initialStats
    );
    
    return true;
  }

  async refreshDashboard() {
    await this.click(this.selectors.refreshButton);
    await this.waitForSelector(this.selectors.loadingSpinner);
    await this.waitForSelector(this.selectors.loadingSpinner, { hidden: true });
  }

  async waitForDataLoad() {
    try {
      await this.waitForSelector(this.selectors.loadingSpinner, { hidden: true });
      return true;
    } catch {
      return false;
    }
  }

  async verifyDashboardResponsiveness() {
    const viewport = this.page.viewport();
    
    await this.page.setViewport({ width: 768, height: 1024 });
    const mobileLayout = await this.isVisible('[data-testid="mobile-layout"]');
    
    await this.page.setViewport({ width: 1920, height: 1080 });
    const desktopLayout = await this.isVisible('[data-testid="desktop-layout"]');
    
    await this.page.setViewport(viewport);
    
    return { mobileLayout, desktopLayout };
  }

  async getChartData(chartId) {
    return this.page.evaluate((id) => {
      const chart = document.querySelector(`[data-chart-id="${id}"]`);
      if (chart && chart.chartData) {
        return chart.chartData;
      }
      return null;
    }, chartId);
  }
}

module.exports = AnalyticsPage;