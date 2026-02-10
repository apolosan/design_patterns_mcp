import { describe, expect, test, vi } from 'vitest';
import {
  isCodeBug,
  isCodeBugSimple,
  sanitizeErrorForUser,
  withErrorClassification,
  withErrorClassificationAsync,
  ErrorClassification,
  type ErrorAnalysisResult,
} from '../../src/utils/is-code-bug.js';

describe('isCodeBug', () => {
  describe('error classification', () => {
    test('should classify user error - not found', () => {
      const error = new Error('Resource not found');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.USER_ERROR);
      expect(result.isCodeBug).toBe(false);
      expect(result.shouldAlert).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    test('should classify user error - invalid input', () => {
      const error = new Error('Invalid input: email format is incorrect');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.USER_ERROR);
      expect(result.isCodeBug).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });

    test('should classify permission error correctly', () => {
      const error = new Error('Permission denied: you do not have access to this resource');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.PERMISSION_ERROR);
      expect(result.isCodeBug).toBe(false);
    });

    test('should classify user error - rate limit', () => {
      const error = new Error('Rate limit exceeded: too many requests');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.RATE_LIMIT_ERROR);
      expect(result.isCodeBug).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });

    test('should classify network-related errors', () => {
      const error = new Error('Database connection failed');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.NETWORK_ERROR);
      expect(result.isCodeBug).toBe(false);
    });

    test('should classify external service error - upstream', () => {
      const error = new Error('Upstream service unavailable');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.EXTERNAL_SERVICE);
      expect(result.isCodeBug).toBe(false);
    });

    test('should classify network error', () => {
      const error = new Error('Connection reset by peer');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.NETWORK_ERROR);
      expect(result.isCodeBug).toBe(false);
      expect(result.shouldAlert).toBe(true);
    });

    test('should classify timeout error', () => {
      const error = new Error('Request timed out after 30000ms');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.TIMEOUT_ERROR);
      expect(result.isCodeBug).toBe(false);
    });

    test('should classify code bug - internal error', () => {
      const error = new Error('Internal server error: undefined is not a function');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.CODE_BUG);
      expect(result.isCodeBug).toBe(true);
      expect(result.shouldAlert).toBe(true);
    });

    test('should classify code bug - null pointer', () => {
      const error = new Error('Cannot read property of null');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.CODE_BUG);
      expect(result.isCodeBug).toBe(true);
    });

    test('should classify unexpected error', () => {
      const error = new Error('Unexpected error occurred');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.CODE_BUG);
      expect(result.isCodeBug).toBe(true);
    });
  });

  describe('error code classification', () => {
    test('should classify by error code - VALIDATION_ERROR', () => {
      const error = { code: 'VALIDATION_ERROR', message: 'Invalid data' };
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.USER_ERROR);
      expect(result.isCodeBug).toBe(false);
    });

    test('should classify by error code - NOT_FOUND', () => {
      const error = { code: 'NOT_FOUND', message: 'Item missing' };
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.USER_ERROR);
      expect(result.isCodeBug).toBe(false);
    });

    test('should classify by error code - INTERNAL_ERROR', () => {
      const error = { code: 'INTERNAL_ERROR', message: 'Something went wrong' };
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.CODE_BUG);
      expect(result.isCodeBug).toBe(true);
    });

    test('should classify by error code - NULL_POINTER', () => {
      const error = { code: 'NULL_POINTER', message: 'Null value encountered' };
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.CODE_BUG);
      expect(result.isCodeBug).toBe(true);
    });

    test('should classify timeout by code', () => {
      const error = { code: 'REQUEST_TIMEOUT', message: 'Timeout occurred' };
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.TIMEOUT_ERROR);
      expect(result.isCodeBug).toBe(false);
    });
  });

  describe('Zod validation errors', () => {
    test('should classify ZodError as validation error', () => {
      try {
        const { z } = require('zod');
        z.string().parse(123);
      } catch (error) {
        const result = isCodeBug(error);

        expect(result.classification).toBe(ErrorClassification.VALIDATION_ERROR);
        expect(result.isCodeBug).toBe(false);
        expect(result.shouldAlert).toBe(false);
        expect(result.severity).toBe('low');
      }
    });
  });

  describe('isCodeBugSimple', () => {
    test('should return false for user errors', () => {
      const error = new Error('Invalid input');
      expect(isCodeBugSimple(error)).toBe(false);
    });

    test('should return true for code bugs', () => {
      const error = new Error('undefined is not a function');
      expect(isCodeBugSimple(error)).toBe(true);
    });

    test('should return false for external service errors', () => {
      const error = new Error('Database connection failed');
      expect(isCodeBugSimple(error)).toBe(false);
    });
  });

  describe('sanitizeErrorForUser', () => {
    test('should sanitize password from error message', () => {
      const error = new Error('Auth failed: password mySecret123 is invalid');
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).not.toContain('mySecret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    test('should sanitize API key from error message', () => {
      const error = new Error('API request failed: api_key=sk-1234567890abcdef');
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).not.toContain('sk-1234567890abcdef');
      expect(sanitized).toContain('[REDACTED]');
    });

    test('should sanitize token from error message', () => {
      const error = new Error('Auth error: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    test('should truncate stack traces', () => {
      const error = new Error('Error: Something failed\n    at Function.test (/path/to/file.js:10:5)\n    at Object.<anonymous> (/path/to/other.js:20:10)');
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).not.toContain('\n    at');
      expect(sanitized.split('\n').length).toBe(1);
    });

    test('should handle string errors', () => {
      const error = 'Simple string error';
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).toBe(error);
    });

    test('should handle object errors', () => {
      const error = { message: 'Object error', code: 'TEST' };
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).toBe('Object error');
    });

    test('should handle unknown errors', () => {
      const error = 12345;
      const sanitized = sanitizeErrorForUser(error);

      expect(sanitized).toBe('12345');
    });

    test('should handle null and undefined', () => {
      expect(sanitizeErrorForUser(null)).toBe('null');
      expect(sanitizeErrorForUser(undefined)).toBe('undefined');
    });
  });

  describe('withErrorClassification', () => {
    test('should wrap synchronous function', () => {
      const fn = vi.fn(() => 'success');
      const wrapped = withErrorClassification(fn, { operation: 'testOp' });

      const result = wrapped();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should preserve thrown errors', () => {
      const error = new Error('Test error');
      const fn = vi.fn(() => {
        throw error;
      });
      const wrapped = withErrorClassification(fn);

      expect(() => wrapped()).toThrow('Test error');
    });

    test('should add classification to thrown errors', () => {
      const error = new Error('Resource not found');
      const fn = vi.fn(() => {
        throw error;
      });
      const wrapped = withErrorClassification(fn);

      try {
        wrapped();
      } catch (e) {
        expect((e as { _classification?: ErrorClassification })._classification).toBeDefined();
        expect((e as { _isCodeBug?: boolean })._isCodeBug).toBeDefined();
      }
    });
  });

  describe('withErrorClassificationAsync', () => {
    test('should wrap async function', async () => {
      const fn = vi.fn(async () => 'async success');
      const wrapped = withErrorClassificationAsync(fn, { operation: 'asyncOp' });

      const result = await wrapped();

      expect(result).toBe('async success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should preserve rejected promises', async () => {
      const error = new Error('Async test error');
      const fn = vi.fn(async () => {
        throw error;
      });
      const wrapped = withErrorClassificationAsync(fn);

      await expect(wrapped()).rejects.toThrow('Async test error');
    });

    test('should add classification to rejected errors', async () => {
      const error = new Error('Database connection failed');
      const fn = vi.fn(async () => {
        throw error;
      });
      const wrapped = withErrorClassificationAsync(fn);

      try {
        await wrapped();
      } catch (e) {
        expect((e as { _classification?: ErrorClassification })._classification).toBeDefined();
      }
    });
  });

  describe('severity assignment', () => {
    test('should assign high severity to code bugs', () => {
      const error = new Error('Internal error');
      const result = isCodeBug(error);

      expect(result.severity).toBe('high');
    });

    test('should assign medium severity to network errors', () => {
      const error = new Error('Connection refused to remote server');
      const result = isCodeBug(error);

      expect(result.severity).toBe('medium');
    });

    test('should assign appropriate severity to user errors', () => {
      const error = new Error('Invalid input');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.USER_ERROR);
    });

    test('should assign low severity to rate limit errors', () => {
      const error = new Error('Too many requests');
      const result = isCodeBug(error);

      expect(result.severity).toBe('low');
    });
  });

  describe('confidence scoring', () => {
    test('should have high confidence for Zod validation errors', () => {
      try {
        const { z } = require('zod');
        z.object({ name: z.string() }).parse({ name: 123 });
      } catch (error) {
        const result = isCodeBug(error);
        expect(result.confidence).toBe(0.95);
      }
    });

    test('should have lower confidence for unknown errors', () => {
      const error = new Error('Some random error without clear classification');
      const result = isCodeBug(error);

      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('suggestions', () => {
    test('should provide context-based suggestions', () => {
      const error = new Error('Something failed');
      const result = isCodeBug(error, { operation: 'userSave' });

      expect(result.suggestions.some(s => s.includes('userSave'))).toBe(true);
    });

    test('should provide suggestions for timeout errors', () => {
      const error = new Error('Request timed out');
      const result = isCodeBug(error);

      expect(result.suggestions.some(s => s.toLowerCase().includes('timeout'))).toBe(true);
    });

    test('should provide suggestions for timeout errors', () => {
      const error = new Error('Request timed out');
      const result = isCodeBug(error);

      expect(result.suggestions.some(s => s.toLowerCase().includes('timeout'))).toBe(true);
    });

    test('should include context-based suggestions', () => {
      const error = new Error('Something failed');
      const result = isCodeBug(error, { operation: 'userSave' });

      expect(result.suggestions.some(s => s.includes('userSave'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle empty error message', () => {
      const error = new Error('');
      const result = isCodeBug(error);

      expect(result.classification).toBe(ErrorClassification.CODE_BUG);
    });

    test('should handle very long error message', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);
      const result = isCodeBug(error);

      expect(result.classification).toBeDefined();
    });

    test('should handle error with newlines', () => {
      const error = new Error('Error\nwith\nmultiple\nlines\nat function test (/path:1:1)');
      const result = isCodeBug(error);

      expect(result.classification).toBeDefined();
    });

    test('should handle error with special characters', () => {
      const error = new Error('Error with special chars: <>&"\'{}[]|\\');
      const result = isCodeBug(error);

      expect(result.classification).toBeDefined();
    });

    test('should handle non-english error messages', () => {
      const error = new Error('Error en español: entrada inválida');
      const result = isCodeBug(error);

      expect(result.classification).toBeDefined();
    });

    test('should handle Unicode error messages', () => {
      const error = new Error('エラー: 無効な入力です');
      const result = isCodeBug(error);

      expect(result.classification).toBeDefined();
    });
  });
});

describe('ErrorClassification enum', () => {
  test('should have all expected values', () => {
    expect(ErrorClassification.CODE_BUG).toBe('CODE_BUG');
    expect(ErrorClassification.USER_ERROR).toBe('USER_ERROR');
    expect(ErrorClassification.EXTERNAL_SERVICE).toBe('EXTERNAL_SERVICE');
    expect(ErrorClassification.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorClassification.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorClassification.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    expect(ErrorClassification.PERMISSION_ERROR).toBe('PERMISSION_ERROR');
    expect(ErrorClassification.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
    expect(ErrorClassification.UNKNOWN).toBe('UNKNOWN');
  });
});
