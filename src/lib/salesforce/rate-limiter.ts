import { z } from 'zod';

export interface RateLimiterConfig {
  maxRequestsPerSecond: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number;
}

export class SalesforceRateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private lastRequestTime = 0;
  
  constructor(private config: RateLimiterConfig = {
    maxRequestsPerSecond: 10,
    maxConcurrent: 5,
    retryAttempts: 3,
    retryDelay: 1000,
  }) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Rate limiting
        await this.waitForRateLimit();
        
        // Execute the function
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${this.config.retryAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.config.maxRequestsPerSecond;
    
    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async processQueue(): Promise<void> {
    if (this.running >= this.config.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const fn = this.queue.shift();
    
    if (fn) {
      try {
        await fn();
      } finally {
        this.running--;
        this.processQueue();
      }
    }
  }

  private isRetryableError(error: any): boolean {
    // Salesforce specific error codes that are retryable
    const retryableCodes = [
      'REQUEST_LIMIT_EXCEEDED',
      'CONCURRENT_REQUEST_LIMIT_EXCEEDED',
      'SERVER_UNAVAILABLE',
      'REQUEST_TIMEOUT',
      'UNABLE_TO_LOCK_ROW',
    ];
    
    if (error.errorCode && retryableCodes.includes(error.errorCode)) {
      return true;
    }
    
    // HTTP status codes that are retryable
    const retryableStatuses = [429, 502, 503, 504];
    if (error.status && retryableStatuses.includes(error.status)) {
      return true;
    }
    
    return false;
  }
} 