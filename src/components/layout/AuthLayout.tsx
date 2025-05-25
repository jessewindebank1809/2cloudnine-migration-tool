'use client';

import { usePathname } from 'next/navigation';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/error'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // For Better Auth, we'll handle authentication checks in individual page components
  return <>{children}</>;
} 