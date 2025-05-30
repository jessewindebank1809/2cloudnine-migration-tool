import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Allow access in staging (Fly app names containing 'staging') or with debug param
  const { searchParams } = new URL(request.url);
  const debugParam = searchParams.get('debug');
  const flyAppName = process.env.FLY_APP_NAME;
  const isStaging = flyAppName?.includes('staging');
  
  if (process.env.NODE_ENV === 'production' && !isStaging && debugParam !== 'allow') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    FLY_APP_NAME: process.env.FLY_APP_NAME,
    ENCRYPTION_KEY_EXISTS: !!process.env.ENCRYPTION_KEY,
    ENCRYPTION_KEY_LENGTH: process.env.ENCRYPTION_KEY?.length || 0,
    ENCRYPTION_KEY_FIRST_4: process.env.ENCRYPTION_KEY?.substring(0, 4) || 'null',
    DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
    SALESFORCE_CLIENT_ID_EXISTS: !!process.env.SALESFORCE_PRODUCTION_CLIENT_ID,
  };

  return NextResponse.json(envVars);
} 