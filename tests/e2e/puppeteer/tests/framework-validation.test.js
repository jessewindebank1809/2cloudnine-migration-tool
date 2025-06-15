const TestConfig = require('../utils/test-config');

describe('Puppeteer Framework Validation', () => {
  beforeAll(() => {
    TestConfig.validate();
  });

  test('should validate test framework is working', async () => {
    expect(page).toBeDefined();
    expect(browser).toBeDefined();
  });

  test('should navigate to application base URL', async () => {
    const baseUrl = TestConfig.baseUrl;
    await page.goto(baseUrl);
    
    const url = page.url();
    expect(url).toContain('localhost');
  });

  test('should capture page title', async () => {
    const baseUrl = TestConfig.baseUrl;
    await page.goto(baseUrl);
    
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(typeof title).toBe('string');
  });

  test('should verify page load performance', async () => {
    const startTime = Date.now();
    
    const baseUrl = TestConfig.baseUrl;
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000); // Under 10 seconds
  });

  test('should handle basic page interactions', async () => {
    const baseUrl = TestConfig.baseUrl;
    await page.goto(baseUrl);
    
    // Wait for page to be interactive
    await page.waitForSelector('body');
    
    // Basic interaction test
    const bodyExists = await page.$('body');
    expect(bodyExists).toBeTruthy();
  });
});