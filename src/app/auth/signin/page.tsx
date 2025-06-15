'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// Salesforce Logo Component
const SalesforceCloudLogo = ({ className = "h-6 w-6" }: { className?: string }) => (
  <Image 
    src="/Salesforce_Corporate_Logo_RGB.png" 
    alt="Salesforce" 
    width={24}
    height={24}
    className={className}
  />
);

function SignInContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_error: 'OAuth authentication failed. Please try again.',
        missing_params: 'Invalid authentication response. Please try again.',
        invalid_state: 'Invalid authentication state. Please try again.',
        invalid_request: 'Invalid authentication request. Please try again.',
        config_error: 'Salesforce configuration error. Please contact support.',
        token_exchange_failed: 'Failed to exchange tokens. Please try again.',
        user_info_failed: 'Failed to retrieve user information. Please try again.',
        callback_error: 'Authentication callback error. Please try again.',
      };
      setError(errorMessages[errorParam] || 'An authentication error occurred. Please try again.');
    }
  }, [searchParams]);

  const handleSalesforceSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Starting Salesforce OAuth flow...');
      
      // Use Better Auth's OAuth flow
      const { authClient } = await import('@/lib/auth/client');
      
      await authClient.signIn.oauth2({
        providerId: "salesforce",
        callbackURL: "/home",
      });
    } catch (error) {
      console.error('Salesforce sign in error:', error);
      setError(`Salesforce sign in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full">
        <Card className="shadow-2xl border border-gray-200 bg-white overflow-hidden">
          {/* Blue banner with logo */}
          <div className="bg-gradient-to-r from-c9-blue-500 to-c9-blue-600 px-6 py-4 flex items-center">
            <Image 
              src="/Cloudnine Reversed Standard 2.png" 
              alt="2cloudnine Logo" 
              width={128}
              height={32}
              className="h-8 w-auto"
            />
            <span className="ml-3 text-white font-bold text-xl">Migration Tool</span>
          </div>
          
          <CardContent className="px-12 py-16">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome Back
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                Connect Salesforce to begin migrating your 2cloudnine data.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-8 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {/* Provider Button */}
            <div className="mb-8">
              {/* Salesforce Production Button */}
              <button
                onClick={handleSalesforceSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-6 py-4 text-white font-semibold rounded-lg bg-c9-blue-500 hover:bg-c9-blue-600 focus:outline-none focus:ring-4 focus:ring-c9-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <SalesforceCloudLogo className="mr-3 h-6 w-6 brightness-0 invert" />
                <span>
                  {isLoading ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Connecting to Salesforce...
                    </span>
                  ) : (
                    'Continue with Salesforce'
                  )}
                </span>
              </button>
            </div>

            {/* Footer Text */}
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Production and Developer Edition orgs supported
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 