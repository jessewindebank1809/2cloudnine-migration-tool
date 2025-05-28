import { SalesforceClient } from './client';

/**
 * Executes a Salesforce operation with automatic token refresh retry
 */
export async function withTokenRefresh<T>(
  client: SalesforceClient,
  operation: () => Promise<T>,
  operationName: string = 'Salesforce operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Check if it's a token-related error
    if (error instanceof Error && (
      error.message.includes('invalid_grant') ||
      error.message.includes('expired') ||
      error.message.includes('INVALID_SESSION_ID') ||
      error.message.includes('expired access/refresh token') ||
      error.message.includes('Connection failed: expired access/refresh token') ||
      error.message.includes('Authentication token has expired')
    )) {
      console.log(`Token expired during ${operationName}, attempting automatic refresh...`);
      
      // Attempt token refresh
      const refreshResult = await client.refreshAccessToken();
      if (refreshResult.success) {
        console.log(`Token refresh successful, retrying ${operationName}...`);
        // Retry the operation after successful token refresh
        return await operation();
      } else {
        console.error(`Token refresh failed for ${operationName}:`, refreshResult.error);
        // If refresh failed, throw a more descriptive error
        throw new Error(refreshResult.error || 'Authentication token has expired. Please reconnect the organisation.');
      }
    } else {
      // Not a token error, re-throw the original error
      throw error;
    }
  }
}

/**
 * Check if an error is token-related
 */
export function isTokenError(error: Error): boolean {
  return (
    error.message.includes('invalid_grant') ||
    error.message.includes('expired') ||
    error.message.includes('INVALID_SESSION_ID') ||
    error.message.includes('expired access/refresh token') ||
    error.message.includes('Connection failed: expired access/refresh token') ||
    error.message.includes('Authentication token has expired') ||
    error.message.includes('TOKEN_EXPIRED')
  );
} 