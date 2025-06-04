// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Environment detection utility
function getEnvironment(): 'local' | 'staging' | 'production' {
  // For local development
  if (process.env.NODE_ENV === 'development') {
    return 'local';
  }
  
  // For deployed environments, check Fly app name
  const flyAppName = process.env.FLY_APP_NAME;
  if (flyAppName?.includes('staging')) {
    return 'staging';
  }
  
  // Default to production for deployed environments
  return 'production';
}

const environment = getEnvironment();

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: environment === 'production' ? 0.1 : 0.1, // Reduce sampling in dev

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false, // Disable debug in development for performance

  // Environment-specific configuration
  environment,
  
  // Performance optimizations for development
  beforeSend(event) {
    // Skip certain events in development to improve performance
    if (environment === 'local') {
      // Only send errors, not performance data
      if (event.type === 'transaction') {
        return null;
      }
    }
    return event;
  },
});
