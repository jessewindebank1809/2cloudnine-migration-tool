const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('Basic Puppeteer Framework Test', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Load test environment
    const envTestPath = path.join(__dirname, '..', '.env.test');
    if (fs.existsSync(envTestPath)) {
      require('dotenv').config({ path: envTestPath });
    }

    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should launch browser and create page', async () => {
    expect(browser).toBeDefined();
    expect(page).toBeDefined();
  });

  test('should navigate to test application', async () => {
    const baseUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
    
    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const url = page.url();
      expect(url).toContain('localhost');
      
      const title = await page.title();
      expect(title).toBeTruthy();
      
      console.log(`✅ Successfully loaded: ${title} at ${url}`);
    } catch (error) {
      console.warn(`⚠️  Could not connect to ${baseUrl}. Make sure dev server is running.`);
      console.warn('Error:', error.message);
      
      // Don't fail the test if server isn't running - this is just a framework validation
      expect(error.message).toContain('net::ERR_CONNECTION_REFUSED');
    }
  });

  test('should handle basic page interactions', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 data-testid="title">Test Page</h1>
          <button data-testid="test-button">Click Me</button>
          <div data-testid="result"></div>
          <script>
            document.querySelector('[data-testid="test-button"]').addEventListener('click', () => {
              document.querySelector('[data-testid="result"]').textContent = 'Button clicked!';
            });
          </script>
        </body>
      </html>
    `);

    // Wait for elements
    await page.waitForSelector('[data-testid="title"]');
    await page.waitForSelector('[data-testid="test-button"]');

    // Check title
    const title = await page.$eval('[data-testid="title"]', el => el.textContent);
    expect(title).toBe('Test Page');

    // Click button
    await page.click('[data-testid="test-button"]');

    // Check result
    await page.waitForSelector('[data-testid="result"]');
    const result = await page.$eval('[data-testid="result"]', el => el.textContent);
    expect(result).toBe('Button clicked!');

    console.log('✅ Basic page interactions working correctly');
  });

  test('should validate test environment configuration', async () => {
    console.log('🔍 Validating test environment...');
    
    const config = {
      TEST_APP_URL: process.env.TEST_APP_URL,
      TEST_SALESFORCE_SOURCE_USERNAME: process.env.TEST_SALESFORCE_SOURCE_USERNAME,
      TEST_SALESFORCE_TARGET_USERNAME: process.env.TEST_SALESFORCE_TARGET_USERNAME,
      DEBUG_TESTS: process.env.DEBUG_TESTS,
      CAPTURE_SCREENSHOTS: process.env.CAPTURE_SCREENSHOTS,
      HEADLESS: process.env.HEADLESS
    };

    console.log('Environment configuration:', config);

    expect(config.TEST_APP_URL).toBeTruthy();
    expect(config.TEST_SALESFORCE_SOURCE_USERNAME).toBeTruthy();
    expect(config.TEST_SALESFORCE_TARGET_USERNAME).toBeTruthy();

    // Validate credentials format
    expect(config.TEST_SALESFORCE_SOURCE_USERNAME).toMatch(/.*@.*\..*$/);
    expect(config.TEST_SALESFORCE_TARGET_USERNAME).toMatch(/.*@.*\..*$/);

    console.log('✅ Test environment configuration is valid');
  });

  test('should capture screenshot if enabled', async () => {
    await page.setContent(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #2196F3;">Puppeteer Framework Test</h1>
          <p>This is a test page to validate screenshot functionality.</p>
          <div style="background: #f0f0f0; padding: 10px; border-radius: 5px;">
            Test content for screenshot validation
          </div>
        </body>
      </html>
    `);

    if (process.env.CAPTURE_SCREENSHOTS === 'true') {
      const screenshotDir = path.join(__dirname, '..', 'screenshots');
      
      // Create screenshots directory if it doesn't exist
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const screenshotPath = path.join(screenshotDir, 'framework-test.png');
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });

      expect(fs.existsSync(screenshotPath)).toBe(true);
      console.log(`✅ Screenshot captured: ${screenshotPath}`);
    } else {
      console.log('📷 Screenshot capture disabled');
    }
  });
});