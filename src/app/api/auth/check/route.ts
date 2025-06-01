import { NextRequest, NextResponse } from 'next/server';
import { sessionCache } from '@/lib/auth/session-cache';

export async function GET(request: NextRequest) {
  try {
    // Extract session token from cookies
    const sessionToken = request.headers.get('cookie')?.match(/better-auth\.session_token=([^;]+)/)?.[1];
    
    if (!sessionToken) {
      return NextResponse.json({ user: null, authenticated: false });
    }

    // Check cache first (super fast)
    const cachedSession = sessionCache.get(sessionToken);
    if (cachedSession) {
      return NextResponse.json({ 
        user: cachedSession.user, 
        authenticated: true,
        source: 'cache'
      });
    }

    // If not in cache, assume not authenticated for speed
    // The full auth check will happen on the server-side when needed
    return NextResponse.json({ 
      user: null, 
      authenticated: false,
      source: 'cache-miss'
    });
    
  } catch (error) {
    console.error('Fast auth check error:', error);
    return NextResponse.json({ user: null, authenticated: false });
  }
} 