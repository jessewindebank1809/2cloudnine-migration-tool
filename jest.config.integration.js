const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./"
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node", // Use Node environment for integration tests
  testMatch: [
    "**/tests/integration/**/*.(test|spec).(js|jsx|ts|tsx)"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/"
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@prisma/client$": "<rootDir>/__mocks__/@prisma/client.js"
  },
  modulePathIgnorePatterns: [
    "<rootDir>/.next/"
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }]
  },
  testEnvironmentOptions: {
    customExportConditions: ["node"]
  }
};

module.exports = createJestConfig(customJestConfig);