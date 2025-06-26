import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth, AuthSession } from '@/lib/auth/session-helper';

/**
 * Check if a user has admin privileges
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    // Add timeout to prevent hanging
    const user = await Promise.race([
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Admin check timeout')), 5000)
      )
    ]);

    return (user as any)?.role === 'ADMIN';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Require admin authentication for API routes
 */
export async function requireAdmin(request: NextRequest): Promise<AuthSession> {
  // First check if user is authenticated
  const session = await requireAuth(request);
  
  // Then check if user is admin
  const isAdmin = await isUserAdmin(session.user.id);
  
  if (!isAdmin) {
    throw new Error('Admin access required');
  }
  
  return session;
}

/**
 * Get admin emails from environment for initial admin setup
 */
export function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || '';
  return adminEmails
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);
}

/**
 * Check if an email should have admin privileges
 * Handles both regular emails and Salesforce-formatted emails
 */
export function shouldBeAdmin(email: string): boolean {
  const adminEmails = getAdminEmails();
  const normalizedEmail = email.toLowerCase();
  
  // Log for debugging admin access
  console.log('Checking admin access for:', normalizedEmail);
  console.log('Admin emails configured:', adminEmails);
  
  // Check direct match first
  if (adminEmails.some(adminEmail => normalizedEmail === adminEmail.toLowerCase())) {
    console.log('Direct email match found');
    return true;
  }
  
  // Check if it's a Salesforce-formatted email (email+orgid@salesforce.local)
  // Extract the original email part before the '+'
  const originalEmail = normalizedEmail.split('+')[0];
  
  // Check if original email matches any admin email
  if (adminEmails.some(adminEmail => originalEmail === adminEmail.toLowerCase())) {
    console.log('Original email match found:', originalEmail);
    return true;
  }
  
  // Also check if any admin email is contained within the normalized email
  // This handles cases where the email might have additional suffixes
  const adminMatched = adminEmails.some(adminEmail => {
    const adminLower = adminEmail.toLowerCase();
    return normalizedEmail.includes(adminLower) || originalEmail.includes(adminLower);
  });
  
  if (adminMatched) {
    console.log('Partial email match found');
  }
  
  return adminMatched;
}

/**
 * Promote a user to admin (useful for initial setup)
 */
export async function promoteToAdmin(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    throw error;
  }
}

/**
 * Auto-promote users based on email if they should be admin
 */
export async function autoPromoteAdmin(email: string, userId: string): Promise<void> {
  if (shouldBeAdmin(email)) {
    await promoteToAdmin(userId);
  }
}