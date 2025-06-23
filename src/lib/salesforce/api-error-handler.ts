import { NextResponse } from 'next/server';

export interface TokenErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'RECONNECT_REQUIRED' | 'TOKEN_REFRESH_FAILED';
  reconnectUrl?: string;
  requiresReconnect?: boolean;
  orgId?: string;
}

/**
 * Check if an error is related to token expiration or authentication
 */
export function isTokenRelatedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const tokenErrorPatterns = [
    'invalid_grant',
    'expired',
    'INVALID_SESSION_ID',
    'Authentication token has expired',
    'expired access/refresh token',
    'Connection failed: expired access/refresh token',
    'TOKEN_EXPIRED',
    'Refresh token expired',
    'No refresh token available'
  ];
  
  return tokenErrorPatterns.some(pattern => 
    error.message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Create a standardized token error response
 */
export function createTokenErrorResponse(
  error: unknown,
  orgId?: string,
  returnUrl?: string
): NextResponse<TokenErrorResponse> {
  let errorMessage = 'Authentication error occurred';
  let code: TokenErrorResponse['code'] = 'TOKEN_REFRESH_FAILED';
  let requiresReconnect = false;
  
  if (error instanceof Error) {
    errorMessage = error.message;
    
    // Check if error has custom properties
    const errorWithProps = error as any;
    if (errorWithProps.requiresReconnect) {
      requiresReconnect = true;
      code = 'TOKEN_EXPIRED';
    } else if (errorWithProps.code === 'TOKEN_EXPIRED') {
      requiresReconnect = true;
      code = 'TOKEN_EXPIRED';
    }
    
    // Fallback pattern matching
    if (!requiresReconnect && isTokenRelatedError(error)) {
      requiresReconnect = true;
      code = 'TOKEN_EXPIRED';
    }
  }
  
  // Build reconnect URL
  let reconnectUrl: string | undefined;
  if (requiresReconnect && orgId) {
    const params = new URLSearchParams({ reconnect: orgId });
    if (returnUrl) {
      params.append('returnUrl', returnUrl);
    }
    reconnectUrl = `/orgs?${params.toString()}`;
  }
  
  return NextResponse.json<TokenErrorResponse>(
    {
      error: errorMessage,
      code,
      reconnectUrl,
      requiresReconnect,
      orgId
    },
    { status: 401 }
  );
}

/**
 * Handle API errors with automatic token error detection
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = 'An error occurred',
  orgId?: string
): NextResponse {
  console.error('API Error:', error);
  
  // Check if it's a token-related error
  if (isTokenRelatedError(error)) {
    return createTokenErrorResponse(error, orgId);
  }
  
  // Generic error response
  return NextResponse.json(
    { 
      error: error instanceof Error ? error.message : defaultMessage,
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  );
}