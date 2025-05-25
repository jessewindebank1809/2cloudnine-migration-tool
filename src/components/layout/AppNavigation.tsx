'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/client';
import { 
  AUTH_BYPASS_ENABLED, 
  getBypassSession, 
  clearBypassSession 
} from '@/lib/auth/bypass';

interface AppNavigationProps {
  children: React.ReactNode;
}

export function AppNavigation({ children }: AppNavigationProps) {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication and get session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check for bypass session if enabled
        if (AUTH_BYPASS_ENABLED) {
          const bypassSession = getBypassSession();
          if (bypassSession) {
            setSession({ user: bypassSession.user });
            setIsLoading(false);
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
                return {
                  user: {
                    id: sessionData.userId,
                    email: sessionData.email,
                    name: sessionData.name,
                  }
                };
              }
            }
          } catch (error) {
            console.error('Error parsing custom session:', error);
          }
          return null;
        };

        const customSession = checkCustomSession();
        if (customSession) {
          setSession(customSession);
          setIsLoading(false);
          return;
        }

        // Fall back to regular auth
        const sessionData = await authClient.getSession();
        if (sessionData?.data?.user) {
          setSession(sessionData.data);
        } else {
          router.replace('/auth/signin');
        }
      } catch (error) {
        router.replace('/auth/signin');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    try {
      // Clear bypass session if enabled
      if (AUTH_BYPASS_ENABLED) {
        clearBypassSession();
      }
      
      // Clear our custom Salesforce session cookie
      document.cookie = 'salesforce-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      await authClient.signOut();
      router.replace('/auth/signin');
    } catch (error) {
      console.error('Sign out error:', error);
      router.replace('/auth/signin');
    }
  };

  // Public routes that don't need navigation
  const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/error'];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session?.user) {
    return null; // Will redirect
  }

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-[#2491EB]/20 bg-[#2491EB]">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-auto flex items-center justify-center">
              <img 
                src="/Cloudnine Reversed Standard 2.png" 
                alt="2cloudnine Logo" 
                className="h-10 w-auto"
              />
            </div>
            <span className="font-bold text-xl text-white">Migration Tool</span>
          </div>
          <nav className="flex items-center space-x-6">
            <Link 
              href="/home" 
              className={`text-sm font-medium transition-colors ${
                isActive('/home') 
                  ? 'text-white font-semibold' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link 
              href="/orgs" 
              className={`text-sm font-medium transition-colors ${
                isActive('/orgs') 
                  ? 'text-white font-semibold' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Organisations
            </Link>
            <Link 
              href="/migrations" 
              className={`text-sm font-medium transition-colors ${
                isActive('/migrations') 
                  ? 'text-white font-semibold' 
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Migrations
            </Link>
            <Link href="/migrations/new">
              <Button variant="secondary" className="bg-white text-c9-blue-500 hover:bg-white/90">New Migration</Button>
            </Link>
            <div className="flex items-center space-x-4 ml-6 pl-6 border-l border-white/20">
              <div className="flex items-center space-x-2 text-white">
                <User className="h-4 w-4" />
                <span className="text-sm">{session.user.name || session.user.email}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        {children}
      </main>
    </div>
  );
} 