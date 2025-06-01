import { NextResponse } from 'next/server';

// Ultra-fast health check - no database, no imports

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
} 