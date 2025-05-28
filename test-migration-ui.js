const puppeteer = require('puppeteer');

/**
 * Simple test of migration UI navigation and screenshots
 */
async function testMigrationUI() {
  console.log('🚀 Starting migration UI test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the migration builder
    console.log('📍 Navigating to migration builder...');
    await page.goto('http://localhost:3000/migrations/new', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/01-migration-builder.png', fullPage: true });
    console.log('📸 Screenshot saved: 01-migration-builder.png');

    // Wait a bit to see the page
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to navigate to home page
    console.log('📍 Navigating to home page...');
    await page.goto('http://localhost:3000/home', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.screenshot({ path: 'screenshots/02-home-page.png', fullPage: true });
    console.log('📸 Screenshot saved: 02-home-page.png');

    console.log('✅ Test completed successfully!');
    console.log('📁 Screenshots saved in screenshots/ directory');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testMigrationUI().catch(console.error); 