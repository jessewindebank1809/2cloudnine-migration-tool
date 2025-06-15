const BasePage = require('./base-page');

class MigrationsPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      newMigrationButton: '[data-testid="new-migration-button"]',
      migrationList: '[data-testid="migration-list"]',
      migrationItem: '[data-testid="migration-item"]',
      migrationName: '[data-testid="migration-name"]',
      migrationStatus: '[data-testid="migration-status"]',
      migrationProgress: '[data-testid="migration-progress"]',
      sourceOrgSelect: '[data-testid="source-org-select"]',
      targetOrgSelect: '[data-testid="target-org-select"]',
      templateSelect: '[data-testid="template-select"]',
      customSetupOption: '[data-testid="custom-setup"]',
      migrationNameInput: '[data-testid="migration-name-input"]',
      migrationDescInput: '[data-testid="migration-description-input"]',
      objectSelector: '[data-testid="object-selector"]',
      saveProjectButton: '[data-testid="save-project-button"]',
      executeMigrationButton: '[data-testid="execute-migration-button"]',
      progressBar: '[data-testid="progress-bar"]',
      progressPercentage: '[data-testid="progress-percentage"]',
      statusIndicator: '[data-testid="status-indicator"]',
      logViewer: '[data-testid="log-viewer"]',
      errorList: '[data-testid="error-list"]',
      successCount: '[data-testid="success-count"]',
      failureCount: '[data-testid="failure-count"]',
      downloadReportButton: '[data-testid="download-report-button"]'
    };
  }

  async navigateToMigrations() {
    await this.navigate('/migrations');
  }

  async navigateToNewMigration() {
    await this.navigate('/migrations/new');
  }

  async clickNewMigration() {
    await this.click(this.selectors.newMigrationButton);
    await this.waitForNavigation();
  }

  async createMigrationProject(projectData) {
    await this.type(this.selectors.migrationNameInput, projectData.name);
    await this.type(this.selectors.migrationDescInput, projectData.description);
    
    await this.selectOption(this.selectors.sourceOrgSelect, projectData.sourceOrg);
    await this.selectOption(this.selectors.targetOrgSelect, projectData.targetOrg);
    
    if (projectData.template) {
      await this.selectOption(this.selectors.templateSelect, projectData.template);
    } else {
      await this.click(this.selectors.customSetupOption);
    }

    if (projectData.objects) {
      for (const object of projectData.objects) {
        await this.selectObject(object);
      }
    }

    await this.click(this.selectors.saveProjectButton);
    await this.waitForNavigation();
  }

  async selectOption(selector, value) {
    await this.click(selector);
    await this.click(`[data-value="${value}"]`);
  }

  async selectObject(objectName) {
    await this.click(`${this.selectors.objectSelector} [data-object="${objectName}"]`);
  }

  async getMigrationProjects() {
    if (await this.isVisible(this.selectors.migrationList)) {
      return this.page.$$eval(
        this.selectors.migrationItem,
        items => items.map(item => ({
          name: item.querySelector('[data-testid="migration-name"]')?.textContent?.trim(),
          status: item.querySelector('[data-testid="migration-status"]')?.textContent?.trim(),
          progress: item.querySelector('[data-testid="migration-progress"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async selectMigrationProject(projectName) {
    const projects = await this.page.$$(this.selectors.migrationItem);
    
    for (const project of projects) {
      const nameElement = await project.$('[data-testid="migration-name"]');
      if (nameElement) {
        const name = await nameElement.evaluate(el => el.textContent.trim());
        if (name === projectName) {
          await project.click();
          await this.waitForNavigation();
          return true;
        }
      }
    }
    return false;
  }

  async executeMigration() {
    await this.click(this.selectors.executeMigrationButton);
    await this.waitForSelector(this.selectors.progressBar);
  }

  async waitForMigrationCompletion(timeout = 60000) {
    try {
      await this.page.waitForFunction(
        () => {
          const status = document.querySelector('[data-testid="status-indicator"]');
          return status && (status.textContent.includes('Completed') || status.textContent.includes('Failed'));
        },
        { timeout }
      );
      return true;
    } catch {
      return false;
    }
  }

  async getMigrationProgress() {
    if (await this.isVisible(this.selectors.progressPercentage)) {
      const progressText = await this.getText(this.selectors.progressPercentage);
      return parseInt(progressText.replace('%', ''));
    }
    return 0;
  }

  async getMigrationStatus() {
    if (await this.isVisible(this.selectors.statusIndicator)) {
      return this.getText(this.selectors.statusIndicator);
    }
    return 'Unknown';
  }

  async getMigrationResults() {
    const results = {};
    
    if (await this.isVisible(this.selectors.successCount)) {
      results.successCount = await this.getText(this.selectors.successCount);
    }
    
    if (await this.isVisible(this.selectors.failureCount)) {
      results.failureCount = await this.getText(this.selectors.failureCount);
    }
    
    return results;
  }

  async getMigrationLogs() {
    if (await this.isVisible(this.selectors.logViewer)) {
      return this.page.$$eval(
        `${this.selectors.logViewer} [data-testid="log-entry"]`,
        entries => entries.map(entry => ({
          timestamp: entry.querySelector('[data-testid="log-timestamp"]')?.textContent?.trim(),
          level: entry.querySelector('[data-testid="log-level"]')?.textContent?.trim(),
          message: entry.querySelector('[data-testid="log-message"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async getMigrationErrors() {
    if (await this.isVisible(this.selectors.errorList)) {
      return this.page.$$eval(
        `${this.selectors.errorList} [data-testid="error-item"]`,
        items => items.map(item => ({
          record: item.querySelector('[data-testid="error-record"]')?.textContent?.trim(),
          field: item.querySelector('[data-testid="error-field"]')?.textContent?.trim(),
          message: item.querySelector('[data-testid="error-message"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async downloadReport() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.click(this.selectors.downloadReportButton)
    ]);
    
    return download;
  }

  async verifyMigrationProject(projectName) {
    const projects = await this.getMigrationProjects();
    return projects.some(project => project.name === projectName);
  }

  async waitForRealTimeUpdates(timeout = 5000) {
    const initialProgress = await this.getMigrationProgress();
    
    try {
      await this.page.waitForFunction(
        (initial) => {
          const current = document.querySelector('[data-testid="progress-percentage"]');
          return current && parseInt(current.textContent) > initial;
        },
        { timeout },
        initialProgress
      );
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = MigrationsPage;