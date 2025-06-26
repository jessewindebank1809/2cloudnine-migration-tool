import { TokenManager } from './token-manager';

export interface RefreshStrategy {
  beforeCriticalOperation?: boolean;
  forceRefreshIfOlderThan?: number; // minutes
  maxRetries?: number;
  retryDelay?: number; // milliseconds
}

export class TokenRefreshStrategy {
  private static readonly DEFAULT_STRATEGY: RefreshStrategy = {
    beforeCriticalOperation: true,
    forceRefreshIfOlderThan: 45, // 45 minutes
    maxRetries: 3,
    retryDelay: 1000
  };

  /**
   * Ensure token is fresh before critical operations
   */
  static async ensureFreshToken(
    orgId: string, 
    strategy: RefreshStrategy = TokenRefreshStrategy.DEFAULT_STRATEGY
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenManager = TokenManager.getInstance();
      
      // Get current token
      const token = await tokenManager.getValidToken(orgId);
      
      if (!token) {
        return { 
          success: false, 
          error: 'No valid token available. Organisation requires reconnection.' 
        };
      }
      
      // If strategy requires refresh before critical operations
      if (strategy.beforeCriticalOperation) {
        console.log(`Ensuring fresh token for critical operation on org ${orgId}`);
        
        // Force a proactive refresh to minimize risk of expiration during operation
        const validToken = await tokenManager.getValidToken(orgId);
        
        if (!validToken) {
          return { 
            success: false, 
            error: 'Failed to ensure fresh token for critical operation' 
          };
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error ensuring fresh token for org ${orgId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Create a custom strategy for specific use cases
   */
  static createStrategy(options: Partial<RefreshStrategy>): RefreshStrategy {
    return {
      ...TokenRefreshStrategy.DEFAULT_STRATEGY,
      ...options
    };
  }
  
  /**
   * Strategies for different operation types
   */
  static readonly STRATEGIES = {
    // For quick read operations
    READ_OPERATION: TokenRefreshStrategy.createStrategy({
      beforeCriticalOperation: false,
      forceRefreshIfOlderThan: 90 // 90 minutes
    }),
    
    // For data migration operations
    MIGRATION_OPERATION: TokenRefreshStrategy.createStrategy({
      beforeCriticalOperation: true,
      forceRefreshIfOlderThan: 30, // 30 minutes
      maxRetries: 5,
      retryDelay: 2000
    }),
    
    // For bulk operations
    BULK_OPERATION: TokenRefreshStrategy.createStrategy({
      beforeCriticalOperation: true,
      forceRefreshIfOlderThan: 15, // 15 minutes - more aggressive
      maxRetries: 3,
      retryDelay: 1000
    })
  };
}