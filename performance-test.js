const puppeteer = require('puppeteer');

async function testPagePerformance() {
  console.log('🔍 Starting comprehensive performance analysis...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for headless mode
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable performance monitoring
  await page.setCacheEnabled(false); // Disable cache for accurate testing
  
  console.log('📊 Measuring page load metrics...');
  const startTime = Date.now();
  
  // Navigate to the page with a more realistic timeout
  await page.goto('http://localhost:3000', { 
    waitUntil: 'domcontentloaded',
    timeout: 15000 // 15 second timeout
  });
  
  const domContentLoadedTime = Date.now() - startTime;
  console.log(`⏱️  DOM Content Loaded: ${domContentLoadedTime}ms`);
  
  // Wait for page to be interactive (but not necessarily all resources loaded)
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    const fullLoadTime = Date.now() - startTime;
    console.log(`⏱️  Full Page Load: ${fullLoadTime}ms`);
  } catch (error) {
    const partialLoadTime = Date.now() - startTime;
    console.log(`⏱️  Partial Load (timeout): ${partialLoadTime}ms`);
  }
  
  // Get performance metrics
  const performanceMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    
    return {
      // Navigation timing
      domainLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
      connection: navigation.connectEnd - navigation.connectStart,
      request: navigation.responseStart - navigation.requestStart,
      response: navigation.responseEnd - navigation.responseStart,
      domProcessing: navigation.domComplete - navigation.domLoading,
      
      // Paint timing
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
      
      // Load events
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadEvent: navigation.loadEventEnd - navigation.loadEventStart,
    };
  });
  
  console.log('\n📈 Detailed Performance Breakdown:');
  console.log(`   🌐 Domain Lookup: ${(performanceMetrics.domainLookup || 0).toFixed(2)}ms`);
  console.log(`   🔗 Connection: ${(performanceMetrics.connection || 0).toFixed(2)}ms`);
  console.log(`   📤 Request: ${(performanceMetrics.request || 0).toFixed(2)}ms`);
  console.log(`   📥 Response: ${(performanceMetrics.response || 0).toFixed(2)}ms`);
  console.log(`   🏗️  DOM Processing: ${(performanceMetrics.domProcessing || 0).toFixed(2)}ms`);
  console.log(`   🎨 First Paint: ${(performanceMetrics.firstPaint || 0).toFixed(2)}ms`);
  console.log(`   🖼️  First Contentful Paint: ${(performanceMetrics.firstContentfulPaint || 0).toFixed(2)}ms`);
  console.log(`   📋 DOM Content Loaded Event: ${(performanceMetrics.domContentLoaded || 0).toFixed(2)}ms`);
  console.log(`   🏁 Load Event: ${(performanceMetrics.loadEvent || 0).toFixed(2)}ms`);
  
  // Analyze network requests
  console.log('\n🌐 Network Analysis:');
  const resourceTiming = await page.evaluate(() => {
    return performance.getEntriesByType('resource').map(resource => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize,
      type: resource.initiatorType
    })).sort((a, b) => b.duration - a.duration);
  });
  
  console.log('   Slowest requests:');
  resourceTiming.slice(0, 10).forEach((resource, index) => {
    const filename = resource.name.split('/').pop() || resource.name;
    console.log(`   ${index + 1}. ${filename} (${resource.duration.toFixed(2)}ms, ${(resource.size/1024).toFixed(1)}KB)`);
  });
  
  // Check for JavaScript errors
  console.log('\n🐛 JavaScript Console Messages:');
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`   ❌ Error: ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      console.log(`   ⚠️  Warning: ${msg.text()}`);
    }
  });
  
  // Wait a bit to capture any console messages
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check if auth check is completing
  console.log('\n🔐 Checking authentication state...');
  const isAuthCheckComplete = await page.evaluate(() => {
    return document.querySelector('.animate-spin') === null;
  });
  
  if (!isAuthCheckComplete) {
    console.log('   ⏳ Auth check still running - this may be the bottleneck');
    
    // Wait for auth check to complete and measure time
    const authStartTime = Date.now();
    await page.waitForFunction(() => {
      return document.querySelector('.animate-spin') === null;
    }, { timeout: 30000 });
    const authCompleteTime = Date.now() - authStartTime;
    console.log(`   ✅ Auth check completed in: ${authCompleteTime}ms`);
  } else {
    console.log('   ✅ Auth check already complete');
  }
  
  // Take a screenshot for reference
  await page.screenshot({ path: 'performance-test-screenshot.png', fullPage: true });
  console.log('\n📸 Screenshot saved as performance-test-screenshot.png');
  
  await browser.close();
  
  console.log('\n✅ Performance analysis complete!');
  
  // Summary
  console.log('\n📊 SUMMARY:');
  console.log(`   Total Load Time: ${fullLoadTime}ms`);
  if (fullLoadTime > 5000) {
    console.log('   🚨 CRITICAL: Page load time exceeds 5 seconds');
  } else if (fullLoadTime > 3000) {
    console.log('   ⚠️  WARNING: Page load time exceeds 3 seconds');
  } else {
    console.log('   ✅ Page load time is acceptable');
  }
}

// Handle errors gracefully
testPagePerformance().catch(error => {
  console.error('❌ Performance test failed:', error);
  process.exit(1);
}); 