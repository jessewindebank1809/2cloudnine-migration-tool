'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// Salesforce Logo Component
const SalesforceCloudLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <img 
    src="/Salesforce_Corporate_Logo_RGB.png" 
    alt="Salesforce" 
    className={className}
  />
);

export default function SignInPage() {
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
      console.log('Starting Salesforce OAuth flow for production org...');
      
      // Redirect directly to our OAuth endpoint for user authentication
      const oauthUrl = `/api/auth/oauth2/salesforce/signin`;
      window.location.href = oauthUrl;
    } catch (error) {
      console.error('Salesforce sign in error:', error);
      setError(`Salesforce sign in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-c9-blue-50 via-c9-blue-100 to-c9-blue-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header with 2cloudnine Branding */}
        <div className="text-center">
          <div className="mx-auto h-24 w-24 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-c9-blue-200/50 bg-c9-blue-500">
            <img 
              src="/2cloudnine-logo.svg" 
              alt="2cloudnine Logo" 
              className="h-20 w-20 filter brightness-0 invert"
            />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            2cloudnine Migration Tool
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            Connect your Salesforce org to start migrating
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Continue with Salesforce
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Salesforce Sign In Button */}
            <button
              onClick={handleSalesforceSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-6 py-3 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-c9-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] border-2 border-c9-blue-500 text-c9-blue-500 bg-white hover:bg-c9-blue-50"

            >
              <SalesforceCloudLogo className="mr-4 h-12 w-auto" />
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-c9-blue-500 mr-2"></div>
                  Connecting to Salesforce...
                </>
              ) : (
                'Sign in with Salesforce'
              )}
            </button>

            <div className="text-xs text-center text-gray-500 mt-4">
              Production and Developer Edition orgs only
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 