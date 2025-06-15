const { spawn } = require('child_process');
const waitPort = require('wait-port');
const path = require('path');
const fs = require('fs');

module.exports = async () => {
  // Try to load test environment file if it exists
  const envTestPath = path.join(__dirname, '.env.test');
  if (fs.existsSync(envTestPath)) {
    require('dotenv').config({ path: envTestPath });
  }

  const testDbUrl = process.env.TEST_DATABASE_URL;
  const appUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
  
  if (!testDbUrl) {
    console.warn('⚠️  TEST_DATABASE_URL not set. Tests may fail.');
    console.warn('📝 Please copy tests/e2e/puppeteer/.env.example to .env.test and configure your test environment.');
    
    // For now, skip database requirement for basic test structure validation
    console.log('🔄 Continuing without database for basic validation...');
  }

  console.log('Starting test environment...');
  
  global.__SERVER__ = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      NODE_ENV: 'test'
    }
  });

  global.__SERVER__.stdout.on('data', (data) => {
    if (process.env.DEBUG_TESTS) {
      console.log(`Server: ${data}`);
    }
  });

  global.__SERVER__.stderr.on('data', (data) => {
    if (process.env.DEBUG_TESTS) {
      console.error(`Server Error: ${data}`);
    }
  });

  const port = new URL(appUrl).port || 3000;
  await waitPort({
    host: 'localhost',
    port: parseInt(port),
    timeout: 30000,
    output: 'silent'
  });

  console.log(`Test server ready at ${appUrl}`);
};