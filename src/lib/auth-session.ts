import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export interface SalesforceSession {
  id: string;
  email: string;
  name: string;
  salesforce_access_token: string;
  instance_url: string;
  org_id: string;
}

export function getSession(): SalesforceSession | null {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('sf_session');
    
    if (!sessionCookie) {
      return null;
    }
    
    return JSON.parse(sessionCookie.value) as SalesforceSession;
  } catch (error) {
    console.error('Failed to parse session cookie:', error);
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): SalesforceSession | null {
  try {
    const sessionCookie = request.cookies.get('sf_session');
    
    if (!sessionCookie) {
      return null;
    }
    
    return JSON.parse(sessionCookie.value) as SalesforceSession;
  } catch (error) {
    console.error('Failed to parse session cookie:', error);
    return null;
  }
} 