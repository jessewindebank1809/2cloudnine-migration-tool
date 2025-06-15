import { NextRequest, NextResponse } from 'next/server';
import { usageTracker } from '@/lib/usage-tracker';

/**
 * Middleware to track API usage
 */
export async function trackApiUsage(
  request: NextRequest,
  response: NextResponse,
  userId?: string
): Promise<void> {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname;
  const method = request.method;
  
  // Track after response is ready
  const responseTime = Date.now() - startTime;
  const statusCode = response.status;

  await usageTracker.trackApiUsage(endpoint, method, responseTime, statusCode, userId);
}

/**
 * Higher-order function to wrap API routes with usage tracking
 */
export function withUsageTracking<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  options?: {
    trackFeature?: string;
    getUserId?: (request: NextRequest) => Promise<string | undefined>;
  }
) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest;
    const startTime = Date.now();
    
    try {
      // Get user ID if provided
      const userId = options?.getUserId ? await options.getUserId(request) : undefined;
      
      // Track feature usage if specified
      if (options?.trackFeature && userId) {
        await usageTracker.trackFeatureUsage(options.trackFeature, userId);
      }
      
      // Execute the handler
      const response = await handler(...args);
      
      // Track API usage
      const responseTime = Date.now() - startTime;
      await usageTracker.trackApiUsage(
        request.nextUrl.pathname,
        request.method,
        responseTime,
        response.status,
        userId
      );
      
      return response;
    } catch (error) {
      // Track API usage even for errors
      const responseTime = Date.now() - startTime;
      await usageTracker.trackApiUsage(
        request.nextUrl.pathname,
        request.method,
        responseTime,
        500,
        undefined
      );
      
      throw error;
    }
  };
}