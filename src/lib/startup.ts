let isInitialized = false;

export async function initializeApp() {
  // Only run on server side
  if (typeof window !== 'undefined') {
    return;
  }

  if (isInitialized) {
    return;
  }

  // Skip initialization during build time when DATABASE_URL is not available
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ Skipping app initialization during build time');
    return;
  }

  // Skip initialization during instrumentation phase
  if (process.env.NEXT_RUNTIME === 'nodejs' && !(global as any).__app_initialized) {
    console.log('⚠️ Deferring app initialization during instrumentation phase');
    return;
  }

  console.log('🚀 Initializing application...');
  
  // Defer token refresh scheduler to avoid instrumentation phase issues
  // Use a longer delay to ensure Next.js is fully initialized
  setTimeout(async () => {
    try {
      // Dynamically import TokenManager to avoid client-side bundling
      const { TokenManager } = await import('./salesforce/token-manager');
      const tokenManager = TokenManager.getInstance();
      tokenManager.startTokenRefreshScheduler();
      console.log('✅ Token refresh scheduler started');
    } catch (error) {
      console.error('❌ Failed to start token refresh scheduler:', error);
    }
  }, 5000); // 5 second delay to ensure proper initialization
  
  isInitialized = true;
  (global as any).__app_initialized = true;
  console.log('✅ Application initialized successfully');
}

// Auto-initialize on module load (server startup)
// Only runs once when the module is first loaded
// Deferred to avoid instrumentation phase issues
if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'nodejs') {
  initializeApp();
} 