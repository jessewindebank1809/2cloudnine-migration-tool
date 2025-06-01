interface CachedSession {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified?: boolean;
    image?: string | null;
  };
  expiresAt: number;
  cachedAt: number;
}

class SessionCache {
  private cache = new Map<string, CachedSession>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  set(sessionToken: string, session: CachedSession): void {
    // Clear old entries if cache is getting too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.clearExpired();
      
      // If still too large, clear oldest entries
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
        const toDelete = entries.slice(0, this.MAX_CACHE_SIZE / 2);
        toDelete.forEach(([key]) => this.cache.delete(key));
      }
    }

    this.cache.set(sessionToken, {
      ...session,
      cachedAt: Date.now(),
    });
  }

  get(sessionToken: string): CachedSession | null {
    const cached = this.cache.get(sessionToken);
    
    if (!cached) return null;
    
    const now = Date.now();
    
    // Check if cache entry is expired
    if (now - cached.cachedAt > this.CACHE_TTL) {
      this.cache.delete(sessionToken);
      return null;
    }
    
    // Check if session itself is expired
    if (cached.expiresAt && now > cached.expiresAt) {
      this.cache.delete(sessionToken);
      return null;
    }
    
    return cached;
  }

  delete(sessionToken: string): void {
    this.cache.delete(sessionToken);
  }

  clear(): void {
    this.cache.clear();
  }

  private clearExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.cache.forEach((value, key) => {
      if (
        now - value.cachedAt > this.CACHE_TTL ||
        (value.expiresAt && now > value.expiresAt)
      ) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => this.cache.delete(key));
  }

  // Clean up expired entries periodically
  startCleanupTimer(): void {
    setInterval(() => {
      this.clearExpired();
    }, this.CACHE_TTL);
  }
}

export const sessionCache = new SessionCache();

// Start cleanup timer if we're in a server environment
if (typeof window === 'undefined') {
  sessionCache.startCleanupTimer();
} 