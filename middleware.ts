import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Simplified middleware for development performance
  if (process.env.NODE_ENV === 'development') {
    // Minimal headers for development
    if (pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'no-cache');
    }
    return response;
  }

  // Full middleware only in production
  // Add performance headers for different route types
  if (pathname.startsWith('/api/')) {
    // API routes - add cache headers and optimizations
    if (pathname.startsWith('/api/templates')) {
      // Templates are relatively static - longer cache
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    } else if (pathname.startsWith('/api/health')) {
      // Health checks - short cache
      response.headers.set('Cache-Control', 'public, max-age=60');
    } else if (pathname.includes('/analytics/')) {
      // Analytics - medium cache with stale-while-revalidate
      response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    } else {
      // Default API cache
      response.headers.set('Cache-Control', 'private, max-age=0, must-revalidate');
    }
  } else {
    // Page routes - add prefetch hints and performance headers
    const isPriorityRoute = [
      '/',
      '/migrations',
      '/migrations/new',
      '/home',
      '/orgs'
    ].includes(pathname) || pathname.startsWith('/migrations/[id]');

    if (isPriorityRoute) {
      // High-priority routes get aggressive prefetching
      response.headers.set('Link', [
        '</api/templates>; rel=prefetch; as=fetch',
        '</api/organisations>; rel=prefetch; as=fetch',
        '</globals.css>; rel=preload; as=style',
      ].join(', '));
      
      // Enable Early Hints for critical resources
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      // Standard routes
      response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    }

    // Add security and performance headers
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  }

  // Route-specific optimizations
  if (pathname.startsWith('/migrations/')) {
    // For migration routes, hint at likely next navigations
    const migrationPrefetchHints = [
      '</api/migrations/validate>; rel=prefetch; as=fetch',
      '</api/salesforce/discover-objects>; rel=prefetch; as=fetch'
    ];
    
    const existingLink = response.headers.get('Link') || '';
    const newLink = existingLink ? 
      `${existingLink}, ${migrationPrefetchHints.join(', ')}` : 
      migrationPrefetchHints.join(', ');
    
    response.headers.set('Link', newLink);
  }

  // Add timing headers for performance monitoring
  response.headers.set('Server-Timing', `middleware;dur=0;desc="Route: ${pathname}"`);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}; 