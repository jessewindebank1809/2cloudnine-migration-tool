import { useRouter } from 'next/navigation';
import { useCallback, useState, useRef } from 'react';

interface ApiError {
  error: string;
  code?: string;
  reconnectUrl?: string;
  requiresReconnect?: boolean;
  orgId?: string;
}

interface UseAutoReconnectOptions {
  enableBackgroundReconnect?: boolean;
  onReconnectSuccess?: () => void;
  onReconnectFailure?: (error: string) => void;
}

export function useAutoReconnect(options: UseAutoReconnectOptions = {}) {
  const router = useRouter();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const handleBackgroundReconnect = useCallback(async (orgId: string) => {
    try {
      setIsReconnecting(true);
      setReconnectError(null);
      
      // Get OAuth URL from API
      const response = await fetch(`/api/auth/oauth2/salesforce?orgId=${orgId}&background=true`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate OAuth');
      }
      
      const { url } = await response.json();
      
      // Open OAuth in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      popupRef.current = window.open(
        url,
        'salesforce_oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,resizable=yes`
      );
      
      if (!popupRef.current) {
        throw new Error('Please allow popups for this site to reconnect to Salesforce');
      }
      
      // Set up message listener for OAuth result
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'OAUTH_SUCCESS' && event.data.orgId === orgId) {
          console.log('Background OAuth reconnection successful');
          setIsReconnecting(false);
          window.removeEventListener('message', handleMessage);
          
          if (options.onReconnectSuccess) {
            options.onReconnectSuccess();
          }
        } else if (event.data.type === 'OAUTH_ERROR') {
          console.error('Background OAuth reconnection failed');
          setIsReconnecting(false);
          setReconnectError('Failed to reconnect to Salesforce');
          window.removeEventListener('message', handleMessage);
          
          if (options.onReconnectFailure) {
            options.onReconnectFailure('Failed to reconnect to Salesforce');
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Monitor popup closure
      const checkInterval = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleMessage);
          setIsReconnecting(false);
          setReconnectError('Reconnection cancelled');
        }
      }, 1000);
      
    } catch (err) {
      console.error('Failed to initiate background reconnection:', err);
      setIsReconnecting(false);
      setReconnectError(err instanceof Error ? err.message : 'Failed to reconnect');
      
      if (options.onReconnectFailure) {
        options.onReconnectFailure(err instanceof Error ? err.message : 'Failed to reconnect');
      }
    }
  }, [options]);

  const apiCall = useCallback(async <T>(
    apiFunction: () => Promise<Response>,
    apiOptions?: {
      showGenericError?: boolean;
      customErrorHandler?: (error: ApiError) => boolean;
    }
  ): Promise<T | null> => {
    try {
      const response = await apiFunction();
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        
        // Try custom error handler first
        if (apiOptions?.customErrorHandler && apiOptions.customErrorHandler(errorData)) {
          return null;
        }

        // Check if it's a reconnection required error
        if (errorData.code === 'RECONNECT_REQUIRED' || errorData.code === 'TOKEN_EXPIRED') {
          console.log('Token expired/missing, requires reconnection');
          
          // If background reconnect is enabled and we have an orgId, try it
          if (options.enableBackgroundReconnect && errorData.orgId && !isReconnecting) {
            console.log('Attempting background reconnection for org:', errorData.orgId);
            handleBackgroundReconnect(errorData.orgId);
            return null;
          }
          
          // Otherwise, redirect to reconnection page
          if (errorData.reconnectUrl) {
            router.push(errorData.reconnectUrl);
          } else {
            router.push('/orgs');
          }
          return null;
        }

        // Show generic error if requested
        if (apiOptions?.showGenericError !== false) {
          console.error('API Error:', errorData.error || 'An unexpected error occurred');
        }

        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      
      if (apiOptions?.showGenericError !== false) {
        console.error('Network Error: Failed to connect to the server. Please check your connection.');
      }

      return null;
    }
  }, [router, options.enableBackgroundReconnect, isReconnecting, handleBackgroundReconnect]);

  return {
    apiCall,
    isReconnecting,
    reconnectError,
    cancelReconnect: () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      setIsReconnecting(false);
    }
  };
} 