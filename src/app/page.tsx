'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated using Better Auth
    const checkAuthAndRedirect = async () => {
      try {
        // Quick check for existing session first
        const existingSession = document.cookie.includes('better-auth.session_token');
        if (!existingSession) {
          router.replace('/auth/signin');
          return;
        }

        // Use our fast auth check endpoint
        const response = await fetch('/api/auth/check', {
          credentials: 'include',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && !!data.user) {
            router.replace('/home');
          } else {
            router.replace('/auth/signin');
          }
        } else {
          router.replace('/auth/signin');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/auth/signin');
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  // Show minimal loading state while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // This should not be reached as we redirect immediately
  return null;
} 