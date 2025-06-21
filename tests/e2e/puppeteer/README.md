# Puppeteer End-to-End Testing Suite

Comprehensive E2E testing implementation for the 2cloudnine Migration Tool following the detailed specification.

## Overview

This testing suite provides complete coverage of all critical user journeys, data flows, and UI components using Puppeteer automation.

## Structure

```
tests/e2e/puppeteer/
├── jest.config.js          # Jest configuration for Puppeteer
├── global-setup.js         # Test environment setup
├── global-teardown.js      # Test environment cleanup
├── setup.js               # Test setup and utilities
├── utils/
│   ├── test-config.js      # Test configuration management
│   ├── test-helpers.js     # Common test utilities
│   ├── test-data.js        # Test data generation
│   └── test-data-manager.js # Database test data management
├── pages/
│   ├── base-page.js        # Base page object model
│   ├── auth-page.js        # Authentication page model
│   ├── home-page.js        # Home dashboard page model
│   ├── orgs-page.js        # Organisations page model
│   ├── migrations-page.js  # Migrations page model
│   ├── templates-page.js   # Templates page model
│   └── analytics-page.js   # Analytics page model
└── tests/
    ├── auth.test.js        # Authentication flow tests
    ├── organisations.test.js # Organisation management tests
    ├── migrations.test.js   # Migration workflow tests
    ├── templates.test.js    # Template management tests
    ├── analytics.test.js    # Analytics dashboard tests
    ├── error-handling.test.js # Error handling tests
    ├── performance.test.js  # Performance and load tests
    └── cross-browser.test.js # Cross-browser compatibility
```

## Test Categories

### Authentication Tests (AUTH_001-003)
- Salesforce OAuth sign-in flow
- Session persistence across refreshes
- Sign-out and session cleanup

### Organisation Management (ORG_001-002)
- Multi-organisation connections
- Schema discovery and validation
- Error handling for org connections

### Migration Workflows (MIG_001-003)
- Migration project creation
- Real-time execution monitoring
- Results validation and reporting

### Template Management (TEMP_001)
- Template selection and configuration
- Preview and customization
- Application to migration projects

### Analytics Dashboard (ANALYTICS_001)
- Statistics display and visualization
- Filtering and date range selection
- Real-time updates and export functionality

### Error Handling (ERROR_001-002)
- Network connectivity issues
- Salesforce API governor limits
- Graceful error recovery

### Performance Testing (PERF_001)
- Large dataset migration performance
- UI responsiveness during processing
- Memory usage monitoring

### Cross-Browser Compatibility (BROWSER_001)
- Multi-browser testing (Chrome, Firefox, Safari, Edge)
- Responsive design validation
- JavaScript functionality consistency

## Setup Requirements

### Environment Variables

```bash
# Test Database
TEST_DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/migration_tool_test"

# Salesforce Test Credentials
TEST_SALESFORCE_SANDBOX_CLIENT_ID="your_test_sandbox_client_id"
TEST_SALESFORCE_SANDBOX_CLIENT_SECRET="your_test_sandbox_client_secret"
TEST_SALESFORCE_SOURCE_USERNAME="source_test@example.com.sandbox"
TEST_SALESFORCE_SOURCE_PASSWORD="test_password"
TEST_SALESFORCE_TARGET_USERNAME="target_test@example.com.sandbox"
TEST_SALESFORCE_TARGET_PASSWORD="test_password"

# Application URL
TEST_APP_URL="http://localhost:3000"

# Optional: Browser executable path
PUPPETEER_EXECUTABLE_PATH="/path/to/chrome"
```

### Prerequisites

1. Node.js 18+ with npm
2. Test Salesforce sandbox organisations (minimum 2)
3. PostgreSQL test database
4. All environment variables configured

## Running Tests

### All Tests
```bash
npm run test:e2e:puppeteer
```

### Individual Test Suites
```bash
npm run test:e2e:auth           # Authentication tests
npm run test:e2e:orgs           # Organisation tests
npm run test:e2e:migrations     # Migration workflow tests
npm run test:e2e:templates      # Template management tests
npm run test:e2e:analytics      # Analytics dashboard tests
npm run test:e2e:errors         # Error handling tests
npm run test:e2e:performance    # Performance tests
npm run test:e2e:browser        # Cross-browser tests
```

### Test Options
```bash
npm run test:e2e:puppeteer:watch      # Watch mode
npm run test:e2e:puppeteer:debug      # Debug mode with console output
npm run test:e2e:puppeteer:headless   # Headless mode
npm run test:e2e:puppeteer:screenshots # Capture screenshots
```

### Cleanup
```bash
npm run test:e2e:cleanup        # Remove screenshots and downloads
```

## Test Data Management

The suite includes comprehensive test data management:

- **Automatic Setup**: Test database seeding with required data
- **Cleanup**: Automatic cleanup after test runs
- **Isolation**: Each test run uses fresh, isolated data
- **Performance Data**: Large dataset generation for performance tests

## Page Object Model

Tests use the Page Object Model pattern for maintainability:

- **BasePage**: Common functionality for all pages
- **Specific Pages**: Individual page models with locators and methods
- **Reusable Methods**: Common operations abstracted into utility functions

## Error Handling

Comprehensive error handling includes:

- **Network Failures**: Automatic retry and recovery testing
- **API Limits**: Salesforce governor limit simulation
- **Timeout Handling**: Configurable timeouts for different operations
- **Screenshot Capture**: Automatic screenshots on test failures

## Performance Monitoring

Performance tests monitor:

- **Response Times**: Page load and interaction times
- **Memory Usage**: JavaScript heap size tracking
- **Migration Speed**: Records processed per second
- **UI Responsiveness**: Interface response during heavy operations

## Browser Compatibility

Cross-browser testing covers:

- **Chrome**: Primary testing browser
- **Firefox**: Secondary browser testing
- **Safari**: macOS compatibility
- **Edge**: Windows compatibility

## Configuration

### Test Timeouts
- **Short**: 5 seconds (quick interactions)
- **Medium**: 15 seconds (page loads)
- **Long**: 30 seconds (complex operations)
- **Migration**: 60 seconds (migration operations)

### Screenshot Capture
Screenshots are automatically captured:
- On test failures
- At key test milestones
- When `CAPTURE_SCREENSHOTS=true` is set

## Continuous Integration

The test suite is designed for CI/CD integration:

- **Headless Mode**: Supports server environments
- **Parallel Execution**: Tests can run in parallel
- **Environment Validation**: Automatic prerequisite checking
- **Failure Reporting**: Detailed error reporting and screenshots

## Success Criteria

Tests validate against specification requirements:

- **Functional**: 99.9% test pass rate for critical journeys
- **Performance**: Sub-2s response times, 30min migration limits
- **Reliability**: Zero data corruption, graceful error handling
- **Compatibility**: Consistent behavior across all browsers

## Troubleshooting

### Common Issues

1. **Environment Setup**: Ensure all environment variables are set
2. **Database Connection**: Verify test database is accessible
3. **Salesforce Credentials**: Check sandbox org credentials are valid
4. **Port Conflicts**: Ensure port 3000 is available for test server

### Debug Mode

Run tests in debug mode for detailed output:
```bash
DEBUG_TESTS=true npm run test:e2e:puppeteer:debug
```

### Test Data Issues

Clean and reset test data:
```bash
npm run test:e2e:cleanup
# Then re-run tests to recreate data
```

## Maintenance

Regular maintenance tasks:

1. **Update Selectors**: Keep page object selectors current
2. **Review Test Data**: Ensure test data matches current schema
3. **Performance Baselines**: Update performance benchmarks as needed
4. **Browser Updates**: Test with latest browser versions

This comprehensive test suite ensures robust validation of all application functionality while providing clear guidance for execution and maintenance.