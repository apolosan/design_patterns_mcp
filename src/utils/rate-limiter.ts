/**
 * Rate Limiting Utilities
 * Implements token bucket algorithm to prevent abuse of MCP tool calls
 * Provides configurable limits per tool and per client
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxConcurrentRequests: number;
  burstLimit: number;
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
  concurrentRequests: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, RateLimitState> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: RateLimitConfig): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter(
        config || {
          maxRequestsPerMinute: 60,
          maxRequestsPerHour: 1000,
          maxConcurrentRequests: 10,
          burstLimit: 20,
        }
      );
    }
    return RateLimiter.instance;
  }

  /**
   * Check if a request is allowed for the given key
   */
  async checkLimit(key: string): Promise<void> {
    const now = Date.now();
    const state = this.getOrCreateState(key);

    // Refill tokens based on time passed
    this.refillTokens(state, now);

    // Check concurrent requests limit
    if (state.concurrentRequests >= this.config.maxConcurrentRequests) {
      throw new McpError(
        ErrorCode.InternalError,
        `Rate limit exceeded: too many concurrent requests (${this.config.maxConcurrentRequests})`
      );
    }

    // Check token availability
    if (state.tokens <= 0) {
      const resetTime = this.getResetTime(state, now);
      throw new McpError(
        ErrorCode.InternalError,
        `Rate limit exceeded. Try again in ${Math.ceil((resetTime - now) / 1000)} seconds`
      );
    }

    // Consume token and increment concurrent requests
    state.tokens--;
    state.concurrentRequests++;
  }

  /**
   * Record completion of a request (decrement concurrent counter)
   */
  completeRequest(key: string): void {
    const state = this.limits.get(key);
    if (state && state.concurrentRequests > 0) {
      state.concurrentRequests--;
    }
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): {
    remainingTokens: number;
    concurrentRequests: number;
    resetTime: number;
  } {
    const state = this.getOrCreateState(key);
    const now = Date.now();
    this.refillTokens(state, now);

    return {
      remainingTokens: Math.max(0, state.tokens),
      concurrentRequests: state.concurrentRequests,
      resetTime: this.getResetTime(state, now),
    };
  }

  /**
   * Reset rate limit state for a key (useful for testing)
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup(maxAge: number = 3600000): void {
    // 1 hour default
    const now = Date.now();
    const cutoff = now - maxAge;

    for (const [key, state] of this.limits.entries()) {
      if (state.lastRefill < cutoff && state.concurrentRequests === 0) {
        this.limits.delete(key);
      }
    }
  }

  private getOrCreateState(key: string): RateLimitState {
    let state = this.limits.get(key);
    if (!state) {
      state = {
        tokens: this.config.burstLimit,
        lastRefill: Date.now(),
        concurrentRequests: 0,
      };
      this.limits.set(key, state);
    }
    return state;
  }

  private refillTokens(state: RateLimitState, now: number): void {
    const timePassed = now - state.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 60000) * (this.config.maxRequestsPerMinute / 60)); // per minute rate

    if (tokensToAdd > 0) {
      state.tokens = Math.min(this.config.burstLimit, state.tokens + tokensToAdd);
      state.lastRefill = now;
    }
  }

  private getResetTime(state: RateLimitState, _now: number): number {
    // Calculate when next token will be available
    const tokensNeeded = 1;
    const timeForToken = (tokensNeeded / (this.config.maxRequestsPerMinute / 60)) * 60000;
    return state.lastRefill + timeForToken;
  }
}

/**
 * Middleware function for rate limiting MCP tool calls
 */
export function withRateLimit<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyFn: (...args: T) => string,
  rateLimiter?: RateLimiter
): (...args: T) => Promise<R> {
  const limiter = rateLimiter || RateLimiter.getInstance();

  return async (...args: T): Promise<R> => {
    const key = keyFn(...args);

    try {
      await limiter.checkLimit(key);
      const result = await fn(...args);
      return result;
    } finally {
      limiter.completeRequest(key);
    }
  };
}

/**
 * Rate limiting for MCP server tool calls
 */
export class MCPRateLimiter {
  private limiter: RateLimiter;

  constructor(config?: RateLimitConfig) {
    this.limiter = RateLimiter.getInstance(config);
  }

  /**
   * Wrap a tool handler with rate limiting
   */
  wrapToolHandler<T extends any[], R>(
    handler: (...args: T) => Promise<R>,
    toolName: string
  ): (...args: T) => Promise<R> {
    return withRateLimit(handler, () => `tool:${toolName}`, this.limiter);
  }

  /**
   * Get rate limit status
   */
  getStatus(toolName: string) {
    return this.limiter.getStatus(`tool:${toolName}`);
  }

  /**
   * Clean up old rate limit entries
   */
  cleanup() {
    this.limiter.cleanup();
  }
}
