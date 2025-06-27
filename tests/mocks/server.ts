import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Define default handlers
export const handlers = [
  // Default handler for migrations endpoint
  rest.get('/api/migrations', (req, res, ctx) => {
    return res(
      ctx.json({
        migrations: [],
      })
    );
  }),
];

// Setup server instance
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());