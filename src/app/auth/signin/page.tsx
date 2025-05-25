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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header with 2cloudnine Branding */}
        <div className="text-center">
          <div className="mx-auto h-24 w-auto flex items-center justify-center mb-6">
            <div className="relative group">
              {/* Refined background with subtle shadow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-slate-200/40 via-blue-100/50 to-indigo-100/40 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition-all duration-300"></div>
              
              {/* Clean white container with professional styling */}
              <div className="relative bg-white rounded-2xl px-6 py-4 shadow-lg border border-slate-200/60 group-hover:shadow-xl transition-all duration-300">
                <img 
                  src="/Cloudnine Reversed Standard 1.png" 
                  alt="2cloudnine Logo" 
                  className="h-16 w-auto relative z-10 transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Migration Tool
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Connect your Salesforce organisation
            </p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              Securely authenticate with your Salesforce org to begin the migration process
            </p>
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm ring-1 ring-gray-200/50">
          <CardHeader className="text-center pb-8 pt-8">
            <CardTitle className="text-2xl font-semibold text-gray-900 mb-2">
              Continue with Salesforce
            </CardTitle>
            <p className="text-sm text-gray-500">
              Use your existing Salesforce credentials
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6 px-8 pb-8">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {/* Salesforce Sign In Button */}
            <button
              onClick={handleSalesforceSignIn}
              disabled={isLoading}
              className="group w-full flex items-center justify-center px-6 py-4 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-c9-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-2 border-c9-blue-500 text-c9-blue-600 bg-white hover:bg-c9-blue-50 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-c9-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <SalesforceCloudLogo className="mr-4 h-8 w-auto relative z-10" />
              <span className="relative z-10">
                {isLoading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-c9-blue-500 border-t-transparent mr-3"></div>
                    Connecting to Salesforce...
                  </span>
                ) : (
                  'Sign in with Salesforce'
                )}
              </span>
            </button>

            {/* Security Notice */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-xl p-4 border border-gray-200/50">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900 mb-1">Secure OAuth 2.0 Authentication</p>
                  <p className="text-gray-600 text-xs leading-relaxed">
                    Your credentials are handled securely by Salesforce. We never store your password.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium">
                Production and Developer Edition orgs supported
              </p>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
} 