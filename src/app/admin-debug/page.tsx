import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { isUserAdmin } from '@/lib/auth/admin-check';
import { prisma } from '@/lib/database/prisma';

export default async function AdminDebugPage() {
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
      return (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4">Admin Debug</h1>
          <p className="text-red-600">❌ No session found - please log in</p>
        </div>
      );
    }

    const isAdmin = await isUserAdmin(session.user.id);
    
    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true, name: true }
    });

    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Admin Debug Information</h1>
        
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h2 className="text-lg font-semibold mb-2">Session Info:</h2>
          <p><strong>User ID:</strong> {session.user.id}</p>
          <p><strong>Email:</strong> {session.user.email}</p>
          <p><strong>Name:</strong> {session.user.name}</p>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h2 className="text-lg font-semibold mb-2">Database User Info:</h2>
          {user ? (
            <>
              <p><strong>Database ID:</strong> {user.id}</p>
              <p><strong>Database Email:</strong> {user.email}</p>
              <p><strong>Database Role:</strong> {user.role}</p>
              <p><strong>Database Name:</strong> {user.name}</p>
            </>
          ) : (
            <p className="text-red-600">❌ User not found in database</p>
          )}
        </div>

        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h2 className="text-lg font-semibold mb-2">Admin Status:</h2>
          <p className={`text-xl font-bold ${isAdmin ? 'text-green-600' : 'text-red-600'}`}>
            {isAdmin ? '✅ ADMIN' : '❌ NOT ADMIN'}
          </p>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Environment:</h2>
          <p><strong>Admin Emails:</strong> {process.env.ADMIN_EMAILS || 'Not set'}</p>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Admin Debug</h1>
        <p className="text-red-600">❌ Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}