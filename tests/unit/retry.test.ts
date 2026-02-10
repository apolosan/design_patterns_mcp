import { describe, test, expect, beforeEach } from 'vitest';
import { retry, retryWithCondition, RetryResult } from '../../src/utils/retry.js';

describe('Retry Utility', () => {
  describe('retry', () => {
    test('succeeds on first attempt', async () => {
      const operation = async () => 'success';
      const result = await retry(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.result).toBe('success');
    });

    test('retries on failure and succeeds', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return 'success';
      };

      const result = await retry(operation, { maxAttempts: 5, initialDelayMs: 10 });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('fails after max attempts', async () => {
      const operation = async () => {
        throw new Error('persistent failure');
      };

      const result = await retry(operation, { maxAttempts: 3 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error?.message).toBe('persistent failure');
    });

    test('returns error correctly', async () => {
      const error = new Error('test error');
      const operation = async () => {
        throw error;
      };

      const result = await retry(operation, { maxAttempts: 2 });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    test('tracks total time', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        throw new Error('fail');
      };

      const start = Date.now();
      const result = await retry(operation, { maxAttempts: 2, initialDelayMs: 20 });
      const elapsed = Date.now() - start;

      expect(result.success).toBe(false);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(50);
    });
  });

  describe('retryWithCondition', () => {
    test('succeeds when condition is met immediately', async () => {
      const operation = async () => ({ status: 'ok' });
      const shouldRetry = () => false;

      const result = await retryWithCondition(operation, shouldRetry, { maxAttempts: 3 });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    test('retries when condition returns true', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return { status: attempts < 3 ? 'pending' : 'ok' };
      };
      const shouldRetry = (result: { status: string }) => result.status !== 'ok';

      const result = await retryWithCondition(operation, shouldRetry, { maxAttempts: 5 });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('fails after max attempts with retry condition', async () => {
      const operation = async () => ({ status: 'pending' });
      const shouldRetry = () => true;

      const result = await retryWithCondition(operation, shouldRetry, { maxAttempts: 3 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
    });

    test('handles operation errors', async () => {
      const operation = async () => {
        throw new Error('error');
      };
      const shouldRetry = () => false;

      const result = await retryWithCondition(operation, shouldRetry, { maxAttempts: 3 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('configuration', () => {
    test('uses default configuration', async () => {
      const operation = async () => 'success';
      const result = await retry(operation);

      expect(result.success).toBe(true);
    });

    test('customizes maxAttempts', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('fail');
      };

      await retry(operation, { maxAttempts: 2 });
      expect(attempts).toBe(2);
    });

    test('handles partial config override', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return 'success';
      };

      const result = await retry(operation, { maxAttempts: 5 });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });
});
