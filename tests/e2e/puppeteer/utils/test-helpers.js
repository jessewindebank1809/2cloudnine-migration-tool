const TestConfig = require('./test-config');

class TestHelpers {
  static async waitForSelector(page, selector, timeout = TestConfig.timeouts.medium) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.error(`Selector not found: ${selector}`);
      return false;
    }
  }

  static async waitForNavigation(page, timeout = TestConfig.timeouts.medium) {
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout });
      return true;
    } catch (error) {
      console.error('Navigation timeout');
      return false;
    }
  }

  static async fillForm(page, formData) {
    for (const [selector, value] of Object.entries(formData)) {
      await page.waitForSelector(selector);
      await page.type(selector, value, { delay: 50 });
    }
  }

  static async clickAndWait(page, selector, timeout = TestConfig.timeouts.medium) {
    await page.waitForSelector(selector);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout }),
      page.click(selector)
    ]);
  }

  static async takeScreenshot(page, name) {
    if (process.env.CAPTURE_SCREENSHOTS) {
      await page.screenshot({
        path: `tests/e2e/puppeteer/screenshots/${name}-${Date.now()}.png`,
        fullPage: true
      });
    }
  }

  static async waitForText(page, text, timeout = TestConfig.timeouts.medium) {
    try {
      await page.waitForFunction(
        (searchText) => document.body.textContent.includes(searchText),
        { timeout },
        text
      );
      return true;
    } catch (error) {
      console.error(`Text not found: ${text}`);
      return false;
    }
  }

  static async clearAndType(page, selector, text) {
    await page.click(selector);
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Meta');
    await page.type(selector, text);
  }

  static async simulateNetworkFailure(page) {
    await page.setOfflineMode(true);
  }

  static async restoreNetwork(page) {
    await page.setOfflineMode(false);
  }

  static async getConsoleErrors(page) {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }
}

module.exports = TestHelpers;