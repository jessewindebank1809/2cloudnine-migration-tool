const puppeteer = require('puppeteer');

async function simplePerformanceTest() {
  console.log('🔍 Simple Performance Test...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('📊 Testing page response time...');
  const startTime = Date.now();
  
  try {
    // Just test initial page load
    const response = await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    const loadTime = Date.now() - startTime;
    const status = response.status();
    
    console.log(`⏱️  Response Time: ${loadTime}ms`);
    console.log(`📱 Status Code: ${status}`);
    
    if (status === 200) {
      console.log('✅ Page loaded successfully');
      
      // Test if auth spinner is visible (indicates slow auth)
      const hasSpinner = await page.$('.animate-spin') !== null;
      if (hasSpinner) {
        console.log('⏳ Auth check still loading...');
        
        // Wait for auth to complete
        const authStartTime = Date.now();
        try {
          await page.waitForFunction(() => {
            return document.querySelector('.animate-spin') === null;
          }, { timeout: 10000 });
          const authTime = Date.now() - authStartTime;
          console.log(`🔐 Auth completed in: ${authTime}ms`);
        } catch (error) {
          console.log('⚠️  Auth check timeout after 10s');
        }
      } else {
        console.log('🔐 Auth already complete');
      }
      
      // Test a simple API call
      console.log('\n🌐 Testing API performance...');
      const apiStartTime = Date.now();
      
      try {
        const apiResponse = await page.evaluate(async () => {
          const response = await fetch('/api/health/fast');
          return {
            status: response.status,
            ok: response.ok
          };
        });
        
        const apiTime = Date.now() - apiStartTime;
        console.log(`⚡ API Response: ${apiTime}ms (Status: ${apiResponse.status})`);
        
      } catch (error) {
        console.log('❌ API test failed:', error.message);
      }
      
    } else {
      console.log(`❌ Page failed to load (Status: ${status})`);
    }
    
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.log(`❌ Page load failed after ${errorTime}ms:`, error.message);
  }
  
  await browser.close();
  
  console.log('\n📊 SUMMARY:');
  const loadTime = Date.now() - startTime;
  if (loadTime < 3000) {
    console.log(`✅ Good performance: ${loadTime}ms`);
  } else if (loadTime < 5000) {
    console.log(`⚠️  Slow performance: ${loadTime}ms`);
  } else {
    console.log(`🚨 Poor performance: ${loadTime}ms`);
  }
}

simplePerformanceTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 