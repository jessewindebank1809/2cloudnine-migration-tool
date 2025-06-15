const { spawn } = require('child_process');
const waitPort = require('wait-port');
const path = require('path');
const fs = require('fs');

async function startTestServer() {
  // Load test environment if available
  const envTestPath = path.join(__dirname, '.env.test');
  if (fs.existsSync(envTestPath)) {
    require('dotenv').config({ path: envTestPath });
  }

  const appUrl = process.env.TEST_APP_URL || 'http://localhost:3000';
  const port = new URL(appUrl).port || 3000;

  console.log('🚀 Starting test server...');
  
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // Wait for server to be ready
  try {
    await waitPort({
      host: 'localhost',
      port: parseInt(port),
      timeout: 30000,
      output: 'silent'
    });
    
    console.log(`✅ Test server ready at ${appUrl}`);
    console.log('📝 Run tests with: npm run test:e2e:puppeteer');
    console.log('🛑 Press Ctrl+C to stop the server');
    
  } catch (error) {
    console.error('❌ Failed to start test server:', error.message);
    server.kill();
    process.exit(1);
  }

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping test server...');
    server.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.kill();
    process.exit(0);
  });
}

// Only run if called directly
if (require.main === module) {
  startTestServer().catch(console.error);
}

module.exports = startTestServer;