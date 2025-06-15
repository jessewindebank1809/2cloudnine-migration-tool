const path = require('path');

module.exports = {
  preset: 'jest-puppeteer',
  rootDir: path.resolve(__dirname, '../../..'),
  testMatch: ['**/tests/e2e/puppeteer/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/puppeteer/setup.js'],
  testTimeout: 60000,
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,ts,tsx}'
  ],
  coverageReporters: ['text', 'lcov', 'html']
};