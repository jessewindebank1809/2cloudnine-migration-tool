const { configureToMatchImageSnapshot } = require('jest-image-snapshot');

expect.extend({ toMatchImageSnapshot: configureToMatchImageSnapshot() });

beforeEach(async () => {
  // Only set up page if it exists (jest-puppeteer should provide it)
  if (typeof page !== 'undefined' && page) {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    page.on('console', (msg) => {
      if (process.env.DEBUG_TESTS && msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
    
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message);
    });
  }
});

afterEach(async () => {
  if (process.env.CAPTURE_SCREENSHOTS && typeof page !== 'undefined' && page) {
    try {
      const testName = expect.getState().currentTestName || 'unknown-test';
      await page.screenshot({
        path: `tests/e2e/puppeteer/screenshots/${testName}.png`,
        fullPage: true
      });
    } catch (error) {
      console.warn('Failed to capture screenshot:', error.message);
    }
  }
});