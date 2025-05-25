'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CloudIcon, Shield, Users } from 'lucide-react';
import Link from 'next/link';

// Salesforce Logo Component
const SalesforceLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor">
    <g>
      <path d="M73.5,20.4c-1.7-8.6-9.3-15.1-18.4-15.1c-6.6,0-12.3,3.4-15.7,8.5c-2.3-1.4-4.9-2.2-7.8-2.2
        c-8.1,0-14.7,6.6-14.7,14.7c0,0.8,0.1,1.6,0.2,2.3C9.8,30.1,5,36.6,5,44.4c0,9.7,7.9,17.6,17.6,17.6h6.9v-6.2h-6.9
        c-6.3,0-11.4-5.1-11.4-11.4s5.1-11.4,11.4-11.4c1.2,0,2.4,0.2,3.5,0.6l3.9,1.3l0.6-4.1c0.5-3.3,3.3-5.8,6.7-5.8
        c2.2,0,4.2,1.1,5.4,2.9l2.2,3.3l3.6-1.6c1.8-0.8,3.7-1.2,5.7-1.2c7.1,0,12.9,5.8,12.9,12.9c0,1.4-0.2,2.7-0.7,4l-1.3,3.5
        l3.7,0.8c5.8,1.2,10.1,6.4,10.1,12.4c0,7.1-5.8,12.9-12.9,12.9H52.8v6.2h19.4c10.5,0,19-8.5,19-19
        C91.2,32.4,83.8,23.3,73.5,20.4z"/>
      <circle cx="27.8" cy="55.8" r="4.4"/>
      <circle cx="41.8" cy="69.8" r="4.4"/>
      <circle cx="55.8" cy="83.8" r="4.4"/>
      <circle cx="41.8" cy="41.8" r="4.4"/>
      <circle cx="55.8" cy="55.8" r="4.4"/>
      <circle cx="69.8" cy="69.8" r="4.4"/>
      <circle cx="55.8" cy="27.8" r="4.4"/>
      <circle cx="69.8" cy="41.8" r="4.4"/>
      <circle cx="83.8" cy="55.8" r="4.4"/>
    </g>
  </svg>
);

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSalesforceSignUp = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Starting Salesforce OAuth flow...');
      console.log('Auth client baseURL:', (authClient as any).options?.baseURL);
      console.log('Current window origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
      
      const result = await authClient.signIn.oauth2({
        providerId: "salesforce",
        callbackURL: "/dashboard",
      });
      
      console.log('OAuth result:', result);
    } catch (error) {
      console.error('Salesforce sign up error:', error);
      setError(`Salesforce sign up failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('Sign in link clicked - navigating to /auth/signin');
    router.push('/auth/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-c9-blue-50 via-c9-blue-100 to-c9-blue-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header with Salesforce Branding */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-c9-blue-400 to-c9-blue-600 flex items-center justify-center mb-6 shadow-xl shadow-c9-blue-200/50">
            <SalesforceLogo className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Join 2cloudnine
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            Create your account using your Salesforce organisation credentials
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center mb-4">
              <SalesforceLogo className="h-6 w-6 text-c9-blue-600 mr-3" />
              <CardTitle className="text-xl font-semibold text-gray-900">
                Connect with Salesforce
              </CardTitle>
            </div>
            <p className="text-sm text-gray-500">
              Use your existing Salesforce organisation to create your account
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSalesforceSignUp}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-c9-blue-600 to-c9-blue-400 hover:from-c9-blue-700 hover:to-c9-blue-500 text-white font-medium py-6 text-base shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              size="lg"
            >
              <SalesforceLogo className="mr-3 h-5 w-5" />
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating your account...
                </>
              ) : (
                'Create Account with Salesforce'
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">Secure OAuth 2.0 Authentication</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-c9-blue-50 to-c9-blue-100 rounded-xl p-5 border border-c9-blue-200/50">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-c9-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-c9-blue-600">Secure Connection</h3>
                  <p className="text-sm text-gray-700 mt-1">
                    We use Salesforce&apos;s secure OAuth authentication. Your credentials are never stored by us.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefits for new users */}
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <div className="h-2 w-2 bg-c9-blue-600 rounded-full mr-3"></div>
                Seamless Salesforce data migration
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="h-2 w-2 bg-c9-blue-600 rounded-full mr-3"></div>
                Secure, enterprise-grade platform
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="h-2 w-2 bg-c9-blue-600 rounded-full mr-3"></div>
                No additional setup required
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="text-center pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link 
                href="/auth/signin"
                onClick={handleSignInClick}
                className="font-semibold text-c9-blue-600 hover:text-c9-blue-700 transition-colors duration-200 hover:underline"
              >
                Sign in instead
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By signing up, you agree to our{' '}
            <a href="#" className="text-c9-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-c9-blue-600 hover:underline">Privacy Policy</a>
          </p>
          <div className="flex items-center justify-center mt-3 text-xs text-gray-400">
            <span>Powered by</span>
            <SalesforceLogo className="h-4 w-4 mx-2 text-c9-blue-600" />
            <span>Salesforce Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
} 