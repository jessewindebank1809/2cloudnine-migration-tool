const puppeteer = require('puppeteer');

/**
 * Quick test to check current migration results display
 * Run this after performing a migration manually
 */
async function quickResultsCheck() {
  console.log('🔍 Quick Migration Results Check...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging to capture debug info
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DEBUGGING RECORD RESULTS') || 
          text.includes('Record 1:') || 
          text.includes('Record 2:') ||
          text.includes('recordResults:') ||
          text.includes('totalRecords:') ||
          text.includes('successfulRecords:') ||
          text.includes('failedRecords:')) {
        console.log('🐛 Debug Info:', text);
      }
    });

    // Navigate to your migration results page
    // You'll need to replace this with the actual URL after running a migration
    console.log('📍 Navigate to your migration results page and press Enter...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    // Extract and display current results
    const results = await page.evaluate(() => {
      // Look for the debugging console logs first
      console.log('=== EXTRACTING RESULTS FROM PAGE ===');
      
      const data = {
        totalSuccessful: null,
        totalFailed: null,
        records: []
      };

      // Use the new data-testid attributes for reliable data extraction
      const successElement = document.querySelector('[data-testid="total-successful"]');
      const failedElement = document.querySelector('[data-testid="total-failed"]');
      
      if (successElement) {
        data.totalSuccessful = parseInt(successElement.textContent) || 0;
      }
      if (failedElement) {
        data.totalFailed = parseInt(failedElement.textContent) || 0;
      }
      
      // Get individual record results using data-testid
      const recordElements = document.querySelectorAll('[data-testid="record-result"]');
      
      recordElements.forEach((element, index) => {
        const sourceId = element.getAttribute('data-source-id');
        const successElement = element.querySelector('[data-testid="record-successful"]');
        const failedElement = element.querySelector('[data-testid="record-failed"]');
        
        const successText = successElement ? successElement.textContent : '';
        const failedText = failedElement ? failedElement.textContent : '';
        
        const successMatch = successText.match(/(\d+)\s+successful/);
        const failedMatch = failedText.match(/(\d+)\s+failed/);
        
        data.records.push({
          sourceId: sourceId,
          successful: successMatch ? parseInt(successMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0,
          successText: successText,
          failedText: failedText
        });
      });

      return data;
    });

    console.log('\n📊 EXTRACTED RESULTS:');
    console.log('=====================');
    console.log('Total Successful:', results.totalSuccessful);
    console.log('Total Failed:', results.totalFailed);
    console.log('\nIndividual Records:');
    results.records.forEach(record => {
      console.log(`Record ${record.sourceId}: ${record.successful} successful, ${record.failed} failed`);
      console.log(`  Text: ${record.successText}`);
    });

    // Take a screenshot for manual review
    await page.screenshot({ 
      path: 'screenshots/quick-results-check.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved: screenshots/quick-results-check.png');

  } catch (error) {
    console.error('❌ Quick check failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the quick check
quickResultsCheck().catch(console.error); 