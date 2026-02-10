/**
 * Retry Utility
 * Provides retry logic with exponential backoff for resilient external calls
 * Micro-utility: Generic retry mechanism for async operations
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOn: Array<new (...args: unknown[]) => unknown>;
}

export interface RetryResult<T> {
  success: boolean;
  attempts: number;
  result?: T;
  error?: Error;
  totalTimeMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryOn: [Error] as Array<new (...args: unknown[]) => unknown>,
};

function isRetryableError(error: unknown, retryOn: Array<new (...args: unknown[]) => unknown>): boolean {
  if (!(error instanceof Error)) return false;
  return retryOn.some(ErrorClass => error instanceof ErrorClass);
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        attempts: attempt + 1,
        result,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error, finalConfig.retryOn) || attempt === finalConfig.maxAttempts - 1) {
        return {
          success: false,
          attempts: attempt + 1,
          error: lastError,
          totalTimeMs: Date.now() - startTime,
        };
      }

      const delay = calculateDelay(attempt, finalConfig);
      await sleep(delay);
    }
  }

  return {
    success: false,
    attempts: finalConfig.maxAttempts,
    error: lastError,
    totalTimeMs: Date.now() - startTime,
  };
}

export async function retryWithCondition<T>(
  operation: () => Promise<T>,
  shouldRetry: (result: T, error?: Error) => boolean,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (!shouldRetry(result)) {
        return {
          success: true,
          attempts: attempt + 1,
          result,
          totalTimeMs: Date.now() - startTime,
        };
      }

      lastError = new Error('Retry condition not met');

      if (attempt === finalConfig.maxAttempts - 1) {
        return {
          success: false,
          attempts: attempt + 1,
          result,
          error: lastError,
          totalTimeMs: Date.now() - startTime,
        };
      }

      const delay = calculateDelay(attempt, finalConfig);
      await sleep(delay);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === finalConfig.maxAttempts - 1) {
        return {
          success: false,
          attempts: attempt + 1,
          error: lastError,
          totalTimeMs: Date.now() - startTime,
        };
      }

      const delay = calculateDelay(attempt, finalConfig);
      await sleep(delay);
    }
  }

  return {
    success: false,
    attempts: finalConfig.maxAttempts,
    error: lastError,
    totalTimeMs: Date.now() - startTime,
  };
}
