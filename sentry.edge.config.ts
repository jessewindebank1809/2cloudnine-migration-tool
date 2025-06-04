// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
  tracesSampleRate: environment === 'production' ? 0.1 : 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: environment === 'local',

  // Environment-specific configuration
  environment,
});
