const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./"
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  testMatch: [
    "**/__tests__/**/*.(js|jsx|ts|tsx)",
    "**/*.(test|spec).(js|jsx|ts|tsx)"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/tests/unit/components/MigrationProjectBuilder.bun.test.tsx",
    "<rootDir>/tests/e2e/puppeteer/",
    ...(process.env.CI ? ["<rootDir>/tests/e2e/"] : [])
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "@prisma/client": "<rootDir>/__mocks__/@prisma/client.js",
    "^lucide-react$": "<rootDir>/__mocks__/lucide-react.js"
  },
  modulePathIgnorePatterns: [
    "<rootDir>/.next/"
  ],
  // Configure specific test environments based on file patterns
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }]
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@radix-ui|@tanstack|@floating-ui)/)"
  ],
  // Handle different environments for specific test types
  testEnvironment: "jest-environment-jsdom",
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/lib/database/migrations/**",
    "!src/lib/salesforce/schema/**",
  ]
};

module.exports = createJestConfig(customJestConfig);
