import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { isUserAdmin } from '@/lib/auth/admin-check';
import { UsageMonitoringDashboard } from '@/components/features/usage-monitoring/UsageMonitoringDashboard';

export default async function UsagePage() {
  try {
    // Get cookies and create headers object properly
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    
    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: cookieHeader,
      }),
    });
    
    if (!session?.user) {
      redirect('/auth/signin');
    }

    // Check if user is admin with error handling
    let isAdmin = false;
    try {
      isAdmin = await isUserAdmin(session.user.id);
    } catch (error) {
      console.error('Error checking admin status:', error);
      redirect('/home?error=admin-check-failed');
    }
    
    if (!isAdmin) {
      // Show helpful message for non-admin users
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-yellow-900 mb-4">Admin Access Required</h1>
            <p className="text-yellow-800 mb-4">
              The usage monitoring dashboard is only available to administrators.
            </p>
            <div className="bg-white border border-yellow-100 rounded p-4 mb-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Your email:</strong> {session.user.email}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Admin status:</strong> Not configured
              </p>
            </div>
            <p className="text-sm text-yellow-700">
              If you should have admin access, please contact your system administrator to add your email to the ADMIN_EMAILS configuration.
            </p>
            <div className="mt-6">
              <a 
                href="/home" 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Return to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <UsageMonitoringDashboard isAdmin={isAdmin} />
      </div>
    );
  } catch (error) {
    console.error('Error in usage page:', error);
    redirect('/auth/signin?error=session-error');
  }
}