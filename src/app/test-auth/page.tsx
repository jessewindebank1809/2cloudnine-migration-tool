import Link from 'next/link';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export default async function TestAuthPage() {
  try {
    // Test if auth instance is working
    const session = await auth.api.getSession({
      headers: new Headers(), // Empty headers for testing
    });

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Auth Instance Status:</h2>
            <p className="text-green-600">✅ Auth instance created successfully</p>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold">Session Status:</h2>
            {session ? (
              <div>
                <p className="text-green-600">✅ Session found</p>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  {JSON.stringify(session, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-blue-600">ℹ️ No active session (this is normal for unauthenticated users)</p>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Test Auth Endpoints:</h2>
            <div className="space-x-2">
              <Link 
                href="/api/auth/sign-in" 
                className="bg-blue-500 text-white px-4 py-2 rounded inline-block"
              >
                Test Sign In Endpoint
              </Link>
              <Link 
                href="/api/auth/get-session" 
                className="bg-green-500 text-white px-4 py-2 rounded inline-block"
              >
                Test Get Session Endpoint
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Auth Test Failed</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error:</p>
          <pre className="text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>
      </div>
    );
  }
} 