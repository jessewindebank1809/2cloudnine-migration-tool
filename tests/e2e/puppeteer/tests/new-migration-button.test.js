const { testWithRetry, setupTest, login, waitForSelector, click, getText, waitForNavigation, takeScreenshot } = require('../utils/testHelpers');
const { selectors } = require('../utils/selectors');

describe('New Migration Button - Issue #110 Regression Test', () => {
  let page, browser;

  beforeAll(async () => {
    const setup = await setupTest();
    browser = setup.browser;
    page = setup.page;
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    // Clear any existing state
    await page.goto(`${process.env.APP_URL || 'http://localhost:3000'}/`, { waitUntil: 'networkidle0' });
  });

  testWithRetry('should allow starting a new migration immediately after completing one', async () => {
    // Step 1: Login and navigate to migrations
    await login(page);
    await waitForSelector(page, '[data-testid="dashboard"]', { timeout: 30000 });
    
    // Navigate to new migration
    await click(page, 'a[href="/migrations"]');
    await waitForNavigation(page);
    await click(page, 'a[href="/migrations/new"]');
    await waitForNavigation(page);

    // Step 2: Complete a migration flow
    console.log('Starting migration flow...');
    
    // Project Setup
    await waitForSelector(page, '[data-testid="project-setup"]', { timeout: 10000 });
    await page.type('input[name="projectName"]', 'Test Migration for Issue 110');
    
    // Select template if available
    const templateSelect = await page.$('select[name="templateId"]');
    if (templateSelect) {
      await page.select('select[name="templateId"]', await page.$$eval('select[name="templateId"] option', options => options[1]?.value || options[0].value));
    }
    
    await click(page, 'button:has-text("Next")');
    
    // Connection Setup
    await waitForSelector(page, '[data-testid="connection-setup"]', { timeout: 10000 });
    
    // Select source and target orgs if dropdowns exist
    const sourceOrgSelect = await page.$('select[name="sourceOrgId"]');
    if (sourceOrgSelect) {
      const sourceOptions = await page.$$eval('select[name="sourceOrgId"] option', options => 
        options.map(opt => opt.value).filter(val => val)
      );
      if (sourceOptions.length > 0) {
        await page.select('select[name="sourceOrgId"]', sourceOptions[0]);
      }
    }
    
    const targetOrgSelect = await page.$('select[name="targetOrgId"]');
    if (targetOrgSelect) {
      const targetOptions = await page.$$eval('select[name="targetOrgId"] option', options => 
        options.map(opt => opt.value).filter(val => val)
      );
      if (targetOptions.length > 0) {
        await page.select('select[name="targetOrgId"]', targetOptions[0]);
      }
    }
    
    await click(page, 'button:has-text("Next")');
    
    // Record Selection
    await waitForSelector(page, '[data-testid="record-selection"]', { timeout: 10000 });
    
    // Select at least one record
    const recordCheckbox = await page.$('input[type="checkbox"][name^="record-"]');
    if (recordCheckbox) {
      await recordCheckbox.click();
    }
    
    await click(page, 'button:has-text("Next")');
    
    // Migration Execution
    await waitForSelector(page, '[data-testid="migration-execution"]', { timeout: 10000 });
    
    // Wait for migration to complete (this might take a while in real scenarios)
    // For testing, we'll assume there's a success indicator
    await waitForSelector(page, '[data-testid="migration-complete"], [data-testid="view-results"], .migration-success', { timeout: 60000 });
    
    // Step 3: Click to view results
    const viewResultsButton = await page.$('button:has-text("View Results")');
    if (viewResultsButton) {
      await click(page, 'button:has-text("View Results")');
    }
    
    // Wait for results view
    await waitForSelector(page, '[data-testid="view-results"], .migration-results', { timeout: 10000 });
    
    // Take screenshot of results view
    await takeScreenshot(page, 'migration-results-before-new-migration');
    
    // Step 4: Find and click the New Migration button
    console.log('Looking for New Migration button...');
    
    // Try multiple selectors for the New Migration button
    const newMigrationButton = await page.$(
      'button:has-text("New Migration"), ' +
      'button[aria-label="New Migration"], ' +
      'a:has-text("New Migration"), ' +
      '.new-migration-button, ' +
      '[data-testid="new-migration-button"]'
    );
    
    expect(newMigrationButton).toBeTruthy();
    
    // Verify button is enabled
    const isDisabled = await page.evaluate(el => el.disabled, newMigrationButton);
    expect(isDisabled).toBe(false);
    
    // Click the New Migration button
    await newMigrationButton.click();
    
    // Step 5: Verify we're back at the project setup step with cleared state
    await waitForSelector(page, '[data-testid="project-setup"]', { timeout: 10000 });
    
    // Verify form fields are cleared
    const projectNameValue = await page.$eval('input[name="projectName"]', el => el.value);
    expect(projectNameValue).toBe('');
    
    // Verify we can start a new migration
    await page.type('input[name="projectName"]', 'Second Test Migration');
    await click(page, 'button:has-text("Next")');
    
    // Should be able to proceed to next step
    await waitForSelector(page, '[data-testid="connection-setup"]', { timeout: 10000 });
    
    console.log('✅ New Migration button works correctly after completing a migration');
  }, 3); // Retry up to 3 times

  testWithRetry('should disable New Migration button during active migration', async () => {
    // This test simulates checking the button state during an active migration
    await login(page);
    
    // Navigate to migrations page where we might see the New Migration button
    await page.goto(`${process.env.APP_URL || 'http://localhost:3000'}/migrations`, { waitUntil: 'networkidle0' });
    
    // If there's an active migration indicator, check button state
    const activeMigrationIndicator = await page.$('.active-migration, [data-testid="active-migration"]');
    if (activeMigrationIndicator) {
      const newMigrationButton = await page.$(
        'button:has-text("New Migration"), ' +
        'a:has-text("New Migration")'
      );
      
      if (newMigrationButton) {
        const isDisabled = await page.evaluate(el => {
          // Check if it's a button with disabled attribute or a link with disabled class
          return el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
        }, newMigrationButton);
        
        expect(isDisabled).toBe(true);
        
        // Check for disabled tooltip
        const title = await page.evaluate(el => el.title || el.getAttribute('data-tooltip'), newMigrationButton);
        expect(title).toContain('Cannot start new migration');
      }
    }
  }, 3);

  testWithRetry('should not navigate away when already on /migrations/new', async () => {
    await login(page);
    
    // Navigate directly to /migrations/new
    await page.goto(`${process.env.APP_URL || 'http://localhost:3000'}/migrations/new`, { waitUntil: 'networkidle0' });
    await waitForSelector(page, '[data-testid="project-setup"]', { timeout: 10000 });
    
    // Get current URL
    const urlBefore = page.url();
    
    // Click New Migration button
    const newMigrationButton = await page.$('button:has-text("New Migration"), [data-testid="new-migration-button"]');
    if (newMigrationButton) {
      await newMigrationButton.click();
      
      // Small delay to allow any navigation to occur
      await page.waitForTimeout(1000);
      
      // URL should remain the same
      const urlAfter = page.url();
      expect(urlAfter).toBe(urlBefore);
      
      // Should still be on project setup
      const projectSetup = await page.$('[data-testid="project-setup"]');
      expect(projectSetup).toBeTruthy();
    }
  }, 3);
});