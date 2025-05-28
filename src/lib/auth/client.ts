import { createAuthClient } from "better-auth/client"
import { genericOAuthClient } from "better-auth/client/plugins"

// Determine the base URL for the auth client at runtime
const getBaseURL = () => {
  // If we're in the browser, use the current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // For server-side rendering, use environment variables or fallback
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    genericOAuthClient(),
  ],
}) 