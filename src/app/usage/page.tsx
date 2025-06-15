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
      redirect('/home?error=admin-required');
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