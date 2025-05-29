import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';

export async function GET(_: NextRequest) {
  // Skip database operations during build time
  if (!process.env.DATABASE_URL) {
    const health = {
      status: 'build-time',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      database: 'build-time-skip',
      uptime: process.uptime(),
    };
    return NextResponse.json(health, { status: 200 });
  }

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Get basic application info
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      database: 'connected',
      uptime: process.uptime(),
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime(),
    };

    return NextResponse.json(health, { status: 503 });
  }
} 