import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';

export async function GET(_request: NextRequest) {
  // Skip database operations during build time or development for faster response
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'development') {
    const health = {
      status: process.env.NODE_ENV === 'development' ? 'dev-mode' : 'build-time',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      database: process.env.NODE_ENV === 'development' ? 'dev-skip' : 'build-time-skip',
      uptime: process.uptime(),
    };
    return NextResponse.json(health, { status: 200 });
  }

  try {
    // Only check database in production
    const dbCheckPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 2000)
    );
    
    await Promise.race([dbCheckPromise, timeoutPromise]);
    
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