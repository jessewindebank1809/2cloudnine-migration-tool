const { TestEnvironment } = require('jest-environment-node');

class APITestEnvironment extends TestEnvironment {
  constructor(...args) {
    super(...args);

    // Add Web API polyfills
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    
    // Basic fetch polyfill for tests
    this.global.fetch = jest.fn();
  }
}

module.exports = APITestEnvironment;