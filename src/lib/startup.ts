import { TokenManager } from './salesforce/token-manager';

let isInitialized = false;

export function initializeApp() {
  if (isInitialized) {
    return;
  }

  console.log('🚀 Initializing application...');
  
  // Start the token refresh scheduler
  const tokenManager = TokenManager.getInstance();
  tokenManager.startTokenRefreshScheduler();
  
  isInitialized = true;
  console.log('✅ Application initialized successfully');
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeApp();
} 