require("@testing-library/jest-dom");

// Mock environment variables for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test_migration_tool";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-encryption-key-32-characters";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID || "test-client-id";
process.env.SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET || "test-client-secret";
process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Mock Next.js router for client tests
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Global test setup for Request/Response APIs if in Node environment
if (typeof window === "undefined") {
  // Mock Web APIs for server tests
  try {
    const { Request, Response, Headers } = require("node-fetch");
    global.Request = Request;
    global.Response = Response;
    global.Headers = Headers;
  } catch (error) {
    // Fallback if node-fetch is not available
    console.warn("node-fetch not available for test environment");
  }
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
