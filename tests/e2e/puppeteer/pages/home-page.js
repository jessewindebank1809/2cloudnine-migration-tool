const BasePage = require('./base-page');

class HomePage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      welcomeMessage: '[data-testid="welcome-message"]',
      migrationsLink: '[data-testid="migrations-link"]',
      orgsLink: '[data-testid="orgs-link"]',
      templatesLink: '[data-testid="templates-link"]',
      analyticsLink: '[data-testid="analytics-link"]',
      newMigrationButton: '[data-testid="new-migration-button"]',
      recentMigrations: '[data-testid="recent-migrations"]',
      orgStatus: '[data-testid="org-status"]'
    };
  }

  async navigateToHome() {
    await this.navigate('/home');
  }

  async isOnHomePage() {
    const url = await this.getCurrentUrl();
    return url.includes('/home') || url === `${this.url}/`;
  }

  async navigateToMigrations() {
    await this.click(this.selectors.migrationsLink);
    await this.waitForNavigation();
  }

  async navigateToOrgs() {
    await this.click(this.selectors.orgsLink);
    await this.waitForNavigation();
  }

  async navigateToTemplates() {
    await this.click(this.selectors.templatesLink);
    await this.waitForNavigation();
  }

  async navigateToAnalytics() {
    await this.click(this.selectors.analyticsLink);
    await this.waitForNavigation();
  }

  async clickNewMigration() {
    await this.click(this.selectors.newMigrationButton);
    await this.waitForNavigation();
  }

  async getWelcomeMessage() {
    if (await this.isVisible(this.selectors.welcomeMessage)) {
      return this.getText(this.selectors.welcomeMessage);
    }
    return null;
  }

  async getRecentMigrations() {
    if (await this.isVisible(this.selectors.recentMigrations)) {
      return this.page.$$eval(
        `${this.selectors.recentMigrations} [data-testid="migration-item"]`,
        items => items.map(item => item.textContent.trim())
      );
    }
    return [];
  }

  async getOrgStatus() {
    if (await this.isVisible(this.selectors.orgStatus)) {
      return this.getText(this.selectors.orgStatus);
    }
    return null;
  }

  async verifyDashboardElements() {
    const elements = [
      this.selectors.migrationsLink,
      this.selectors.orgsLink,
      this.selectors.templatesLink
    ];

    const results = {};
    for (const selector of elements) {
      results[selector] = await this.isVisible(selector);
    }
    
    return results;
  }
}

module.exports = HomePage;