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

  console.log('🚀 Initializing application...');
  
  // Start the token refresh scheduler asynchronously to not block startup
  setImmediate(async () => {
    try {
      // Dynamically import TokenManager to avoid client-side bundling
      const { TokenManager } = await import('./salesforce/token-manager');
      const tokenManager = TokenManager.getInstance();
      tokenManager.startTokenRefreshScheduler();
      console.log('✅ Token refresh scheduler started');
    } catch (error) {
      console.error('❌ Failed to start token refresh scheduler:', error);
    }
  });
  
  isInitialized = true;
  console.log('✅ Application initialized successfully');
}

// Auto-initialize on module load (server startup)
// Only runs once when the module is first loaded
if (typeof window === 'undefined') {
  initializeApp();
} 