import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Custom error handler for development to suppress common non-critical errors
const suppressDevErrors = process.env.NODE_ENV === 'development';

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  errorFormat: 'minimal',
});

// Add error handling for common development issues
if (suppressDevErrors) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args.join(' ');
    
    // Suppress session deletion errors in development
    if (message.includes('Record to delete does not exist') && 
        message.includes('prisma.session.delete')) {
      return; // Silently ignore
    }
    
    // Call original console.error for other messages
    originalConsoleError.apply(console, args);
  };
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
} 