require("@testing-library/jest-dom");

// Mock Prisma Client globally before any test runs
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    organisations: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    migrations: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    migration_sessions: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

// Polyfill setImmediate for Node.js compatibility
if (typeof setImmediate === "undefined") {
  global.setImmediate = (callback, ...args) => {
    return setTimeout(callback, 0, ...args);
  };
  global.clearImmediate = clearTimeout;
}

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

// Global test setup for Request/Response APIs
// Always set up these globals for both server and client tests
const { Request, Response, Headers } = require("node-fetch");
if (!global.Request) {
  global.Request = Request;
}
if (!global.Response) {
  global.Response = Response;
}
if (!global.Headers) {
  global.Headers = Headers;
}

// Also set up URL and URLSearchParams if not already available
if (!global.URL) {
  global.URL = require("url").URL;
}
if (!global.URLSearchParams) {
  global.URLSearchParams = require("url").URLSearchParams;
}

// Add TextEncoder/TextDecoder for Node.js environment
if (typeof TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
