const BasePage = require('./base-page');

class OrgsPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      connectOrgButton: '[data-testid="connect-org-button"]',
      orgList: '[data-testid="org-list"]',
      orgItem: '[data-testid="org-item"]',
      orgName: '[data-testid="org-name"]',
      orgStatus: '[data-testid="org-status"]',
      connectSalesforceButton: '[data-testid="connect-salesforce-button"]',
      discoverSchemaButton: '[data-testid="discover-schema-button"]',
      schemaResults: '[data-testid="schema-results"]',
      objectList: '[data-testid="object-list"]',
      fieldList: '[data-testid="field-list"]',
      connectionProgress: '[data-testid="connection-progress"]',
      schemaProgress: '[data-testid="schema-progress"]',
      errorMessage: '[data-testid="error-message"]',
      successMessage: '[data-testid="success-message"]'
    };
  }

  async navigateToOrgs() {
    await this.navigate('/orgs');
  }

  async connectNewOrg() {
    await this.click(this.selectors.connectOrgButton);
    await this.waitForSelector(this.selectors.connectSalesforceButton);
  }

  async clickConnectSalesforce() {
    await this.click(this.selectors.connectSalesforceButton);
  }

  async getConnectedOrgs() {
    if (await this.isVisible(this.selectors.orgList)) {
      return this.page.$$eval(
        this.selectors.orgItem,
        items => items.map(item => ({
          name: item.querySelector('[data-testid="org-name"]')?.textContent?.trim(),
          status: item.querySelector('[data-testid="org-status"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async selectOrg(orgName) {
    const orgItems = await this.page.$$(this.selectors.orgItem);
    
    for (const item of orgItems) {
      const nameElement = await item.$('[data-testid="org-name"]');
      if (nameElement) {
        const name = await nameElement.evaluate(el => el.textContent.trim());
        if (name === orgName) {
          await item.click();
          return true;
        }
      }
    }
    return false;
  }

  async discoverSchema() {
    await this.click(this.selectors.discoverSchemaButton);
    await this.waitForSelector(this.selectors.schemaProgress);
  }

  async waitForSchemaDiscovery(timeout = 30000) {
    try {
      await this.page.waitForSelector(this.selectors.schemaResults, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  async getDiscoveredObjects() {
    if (await this.isVisible(this.selectors.objectList)) {
      return this.page.$$eval(
        `${this.selectors.objectList} [data-testid="object-item"]`,
        items => items.map(item => ({
          name: item.querySelector('[data-testid="object-name"]')?.textContent?.trim(),
          fieldCount: item.querySelector('[data-testid="field-count"]')?.textContent?.trim(),
          type: item.querySelector('[data-testid="object-type"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async getObjectFields(objectName) {
    await this.click(`[data-object="${objectName}"]`);
    
    if (await this.isVisible(this.selectors.fieldList)) {
      return this.page.$$eval(
        `${this.selectors.fieldList} [data-testid="field-item"]`,
        items => items.map(item => ({
          name: item.querySelector('[data-testid="field-name"]')?.textContent?.trim(),
          type: item.querySelector('[data-testid="field-type"]')?.textContent?.trim(),
          required: item.querySelector('[data-testid="field-required"]')?.textContent?.trim()
        }))
      );
    }
    return [];
  }

  async getConnectionStatus(orgName) {
    const orgs = await this.getConnectedOrgs();
    const org = orgs.find(o => o.name === orgName);
    return org ? org.status : null;
  }

  async hasErrorMessage() {
    return this.isVisible(this.selectors.errorMessage);
  }

  async hasSuccessMessage() {
    return this.isVisible(this.selectors.successMessage);
  }

  async getErrorMessage() {
    if (await this.hasErrorMessage()) {
      return this.getText(this.selectors.errorMessage);
    }
    return null;
  }

  async getSuccessMessage() {
    if (await this.hasSuccessMessage()) {
      return this.getText(this.selectors.successMessage);
    }
    return null;
  }

  async verifyOrgConnection(orgName) {
    const orgs = await this.getConnectedOrgs();
    return orgs.some(org => org.name === orgName && org.status === 'Connected');
  }
}

module.exports = OrgsPage;