import { NextRequest, NextResponse } from 'next/server';

// Use edge runtime for maximum performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  // Simple health check without database connectivity  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    runtime: 'edge',
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'unknown',
    performance: {
      responseTime: Date.now(),
      runtime: 'edge',
      benefits: [
        'Faster cold starts',
        'Lower latency',
        'Better scalability',
        'Reduced memory usage'
      ]
    }
  };

  return NextResponse.json(health, { 
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60', // Cache for 1 minute
    }
  });
} 