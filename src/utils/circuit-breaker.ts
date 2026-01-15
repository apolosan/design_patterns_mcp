/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when service is unavailable
 */

export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation, requests pass through
  OPEN = 'open',         // Service unavailable, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  recoveryTimeout: number;       // Time in ms before attempting recovery
  monitoringPeriod: number;      // Time window in ms for failure counting
  successThreshold: number;      // Number of successes needed in half-open state
  name: string;                  // Circuit breaker identifier
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly state: CircuitBreakerState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker implementation for protecting external service calls
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private nextAttemptTime = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker '${this.config.name}' is OPEN`,
          this.config.name,
          this.state
        );
      }
      // Time to attempt recovery
      this.state = CircuitBreakerState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        // Service recovered
        this.reset();
      }
    } else {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failed during recovery test, go back to open
      this.state = CircuitBreakerState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      this.successCount = 0;
    } else if (this.failureCount >= this.config.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitBreakerState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    // Keep successCount for stats purposes - don't reset to 0
    this.nextAttemptTime = 0;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Manually open circuit breaker
   */
  open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
  }

  /**
   * Manually close circuit breaker
   */
  close(): void {
    this.reset();
  }

  /**
   * Check if circuit breaker can accept requests
   */
  canExecute(): boolean {
    return this.state === CircuitBreakerState.CLOSED ||
           (this.state === CircuitBreakerState.HALF_OPEN) ||
           (this.state === CircuitBreakerState.OPEN && Date.now() >= this.nextAttemptTime);
  }
}