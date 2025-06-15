const TestConfig = require('../utils/test-config');
const TestHelpers = require('../utils/test-helpers');

class BasePage {
  constructor(page) {
    this.page = page;
    this.url = TestConfig.baseUrl;
  }

  async navigate(path = '') {
    const fullUrl = `${this.url}${path}`;
    await this.page.goto(fullUrl, { waitUntil: 'networkidle0' });
  }

  async waitForSelector(selector, timeout) {
    return TestHelpers.waitForSelector(this.page, selector, timeout);
  }

  async click(selector) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  async type(selector, text) {
    await this.page.waitForSelector(selector);
    await this.page.type(selector, text, { delay: 50 });
  }

  async getText(selector) {
    await this.page.waitForSelector(selector);
    return this.page.$eval(selector, el => el.textContent.trim());
  }

  async isVisible(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async takeScreenshot(name) {
    return TestHelpers.takeScreenshot(this.page, name);
  }

  async waitForNavigation() {
    return TestHelpers.waitForNavigation(this.page);
  }

  async getCurrentUrl() {
    return this.page.url();
  }

  async getPageTitle() {
    return this.page.title();
  }
}

module.exports = BasePage;