'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BackgroundOAuthReconnectProps {
  orgId: string;
  orgName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  autoTrigger?: boolean;
}

export function BackgroundOAuthReconnect({
  orgId,
  orgName = 'Organisation',
  onSuccess,
  onCancel,
  autoTrigger = false
}: BackgroundOAuthReconnectProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Set up message listener for OAuth success/failure
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_SUCCESS' && event.data.orgId === orgId) {
        console.log('OAuth reconnection successful for org:', orgId);
        setIsReconnecting(false);
        setError(null);
        
        // Clean up
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        
        // Notify parent component
        if (onSuccess) {
          onSuccess();
        } else {
          // Default behavior: refresh the page
          router.refresh();
        }
      } else if (event.data.type === 'OAUTH_ERROR') {
        console.error('OAuth reconnection failed');
        setIsReconnecting(false);
        setError('Failed to reconnect to Salesforce. Please try again.');
        
        // Clean up
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Auto-trigger if requested
    if (autoTrigger && !isReconnecting) {
      handleReconnect();
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
      
      // Clean up on unmount
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [orgId, autoTrigger, onSuccess, router]);

  const handleReconnect = async () => {
    try {
      setIsReconnecting(true);
      setError(null);
      
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
      
      // Check if popup is closed periodically
      checkIntervalRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          console.log('OAuth popup was closed by user');
          setIsReconnecting(false);
          setError('Reconnection cancelled');
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
          }
        }
      }, 1000);
      
    } catch (err) {
      console.error('Failed to initiate reconnection:', err);
      setIsReconnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to reconnect');
    }
  };

  const handleCancel = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    setIsReconnecting(false);
    
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Your Salesforce session for <strong>{orgName}</strong> has expired. 
          Please reconnect to continue.
        </AlertDescription>
      </Alert>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex gap-2">
        <Button
          onClick={handleReconnect}
          disabled={isReconnecting}
          variant="default"
        >
          {isReconnecting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Reconnecting...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconnect to Salesforce
            </>
          )}
        </Button>
        
        {isReconnecting && (
          <Button
            onClick={handleCancel}
            variant="outline"
          >
            Cancel
          </Button>
        )}
      </div>
      
      {isReconnecting && (
        <p className="text-sm text-muted-foreground">
          Please complete the authentication in the popup window...
        </p>
      )}
    </div>
  );
}