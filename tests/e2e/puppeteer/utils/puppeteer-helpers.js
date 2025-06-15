class PuppeteerHelpers {
  static async getText(page, selector) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return await page.$eval(selector, el => el.textContent.trim());
    } catch (error) {
      console.warn(`Could not get text from selector: ${selector}`);
      return null;
    }
  }

  static async isVisible(page, selector, timeout = 5000) {
    try {
      await page.waitForSelector(selector, { timeout, visible: true });
      return true;
    } catch {
      return false;
    }
  }

  static async clickAndWait(page, selector, timeout = 30000) {
    await page.waitForSelector(selector);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout }),
      page.click(selector)
    ]);
  }

  static async typeText(page, selector, text) {
    await page.waitForSelector(selector);
    await page.focus(selector);
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Meta');
    await page.type(selector, text, { delay: 50 });
  }

  static async selectOption(page, selector, value) {
    await page.waitForSelector(selector);
    await page.select(selector, value);
  }

  static async waitForText(page, text, timeout = 15000) {
    try {
      await page.waitForFunction(
        (searchText) => document.body.textContent.includes(searchText),
        { timeout },
        text
      );
      return true;
    } catch {
      return false;
    }
  }

  static async takeScreenshot(page, name) {
    if (process.env.CAPTURE_SCREENSHOTS === 'true') {
      const path = require('path');
      const fs = require('fs');
      
      const screenshotDir = path.join(__dirname, '..', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const screenshotPath = path.join(screenshotDir, `${name}-${Date.now()}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      
      console.log(`📷 Screenshot saved: ${screenshotPath}`);
    }
  }

  static async getElementCount(page, selector) {
    try {
      const elements = await page.$$(selector);
      return elements.length;
    } catch {
      return 0;
    }
  }

  static async getAllTexts(page, selector) {
    try {
      return await page.$$eval(selector, elements => 
        elements.map(el => el.textContent.trim())
      );
    } catch {
      return [];
    }
  }

  static async getElementAttributes(page, selector, attribute) {
    try {
      return await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } catch {
      return null;
    }
  }

  static async simulateNetworkOffline(page) {
    await page.setOfflineMode(true);
  }

  static async simulateNetworkOnline(page) {
    await page.setOfflineMode(false);
  }

  static async waitForElementCount(page, selector, expectedCount, timeout = 10000) {
    try {
      await page.waitForFunction(
        (sel, count) => document.querySelectorAll(sel).length === count,
        { timeout },
        selector,
        expectedCount
      );
      return true;
    } catch {
      return false;
    }
  }

  static async scrollToElement(page, selector) {
    await page.waitForSelector(selector);
    await page.$eval(selector, el => el.scrollIntoView());
  }

  static async hover(page, selector) {
    await page.waitForSelector(selector);
    await page.hover(selector);
  }

  static async getInputValue(page, selector) {
    try {
      return await page.$eval(selector, el => el.value);
    } catch {
      return null;
    }
  }

  static async pressKey(page, key) {
    await page.keyboard.press(key);
  }

  static async waitForPageLoad(page, timeout = 30000) {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout });
  }

  static async getCurrentUrl(page) {
    return page.url();
  }

  static async getPageTitle(page) {
    return page.title();
  }
}

module.exports = PuppeteerHelpers;