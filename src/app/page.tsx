'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { AUTH_BYPASS_ENABLED, getBypassSession } from '@/lib/auth/bypass';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check for bypass session if enabled
        if (AUTH_BYPASS_ENABLED) {
          const bypassSession = getBypassSession();
          if (bypassSession) {
            router.replace('/dashboard');
            return;
          }
        }

        // Check for our custom Salesforce session cookie
        const checkCustomSession = () => {
          try {
            const cookies = document.cookie.split(';');
            const salesforceCookie = cookies.find(cookie => 
              cookie.trim().startsWith('salesforce-session=')
            );
            
            if (salesforceCookie) {
              const cookieValue = salesforceCookie.split('=')[1];
              const sessionData = JSON.parse(decodeURIComponent(cookieValue));
              
              // Check if session is expired
              if (new Date(sessionData.expires) > new Date()) {
                return true;
              }
            }
          } catch (error) {
            console.error('Error parsing custom session:', error);
          }
          return false;
        };

        if (checkCustomSession()) {
          router.replace('/dashboard');
          return;
        }

        // Fall back to regular auth check
        const session = await authClient.getSession();
        if (session?.data?.user) {
          // User is authenticated, redirect to dashboard
          router.replace('/dashboard');
        } else {
          // User is not authenticated, redirect to sign in
          router.replace('/auth/signin');
        }
      } catch (error) {
        // Error getting session, redirect to sign in
        router.replace('/auth/signin');
      }
    };

    checkAuth();
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  );
} 