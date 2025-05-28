import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

interface ApiError {
  error: string;
  code?: string;
  reconnectUrl?: string;
}

export function useAutoReconnect() {
  const router = useRouter();

  const apiCall = useCallback(async <T>(
    apiFunction: () => Promise<Response>,
    options?: {
      showGenericError?: boolean;
      customErrorHandler?: (error: ApiError) => boolean;
    }
  ): Promise<T | null> => {
    try {
      const response = await apiFunction();
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        
        // Try custom error handler first
        if (options?.customErrorHandler && options.customErrorHandler(errorData)) {
          return null;
        }

        // Check if it's a reconnection required error - just redirect without auto-reconnect
        if (errorData.code === 'RECONNECT_REQUIRED' || errorData.code === 'TOKEN_EXPIRED') {
          console.log('Token expired/missing, redirecting to reconnection page...');
          
          if (errorData.reconnectUrl) {
            router.push(errorData.reconnectUrl);
          } else {
            router.push('/orgs');
          }
          return null;
        }

        // Show generic error if requested
        if (options?.showGenericError !== false) {
          console.error('API Error:', errorData.error || 'An unexpected error occurred');
        }

        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      
      if (options?.showGenericError !== false) {
        console.error('Network Error: Failed to connect to the server. Please check your connection.');
      }

      return null;
    }
  }, [router]);

  return {
    apiCall,
    isReconnecting: false,
  };
} 