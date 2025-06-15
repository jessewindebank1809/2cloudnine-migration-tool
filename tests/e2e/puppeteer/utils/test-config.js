class TestConfig {
  static get baseUrl() {
    return process.env.TEST_APP_URL || 'http://localhost:3000';
  }

  static get salesforce() {
    return {
      sandbox: {
        clientId: process.env.TEST_SALESFORCE_SANDBOX_CLIENT_ID,
        clientSecret: process.env.TEST_SALESFORCE_SANDBOX_CLIENT_SECRET,
        sourceUsername: process.env.TEST_SALESFORCE_SOURCE_USERNAME,
        sourcePassword: process.env.TEST_SALESFORCE_SOURCE_PASSWORD,
        targetUsername: process.env.TEST_SALESFORCE_TARGET_USERNAME,
        targetPassword: process.env.TEST_SALESFORCE_TARGET_PASSWORD
      }
    };
  }

  static get database() {
    return {
      url: process.env.TEST_DATABASE_URL
    };
  }

  static get timeouts() {
    return {
      short: 5000,
      medium: 15000,
      long: 30000,
      migration: 60000
    };
  }

  static get browsers() {
    return ['chromium', 'firefox', 'webkit'];
  }

  static validate() {
    const required = [
      'TEST_DATABASE_URL',
      'TEST_SALESFORCE_SANDBOX_CLIENT_ID',
      'TEST_SALESFORCE_SOURCE_USERNAME',
      'TEST_SALESFORCE_TARGET_USERNAME'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
      console.warn('📝 Tests may fail or be skipped. Please configure your test environment.');
      
      // Don't throw error in development, just warn
      if (process.env.NODE_ENV === 'production' || process.env.CI) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
    }
  }
}

module.exports = TestConfig;