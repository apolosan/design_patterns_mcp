/**
 * Unit Tests for Correlation ID Generator
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  generateCorrelationId,
  generateChildCorrelationId,
  getCurrentCorrelationContext,
  getCurrentCorrelationId,
  getParentCorrelationId,
  createCorrelationScope,
  withCorrelationId,
  withChildCorrelationId,
  bindToCorrelation,
  extractCorrelationFromHeaders,
  createCorrelationHeaders,
  isValidCorrelationId,
} from '../../src/utils/correlation-id.js';

describe('CorrelationIdGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCorrelationId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).not.toBe(id2);
    });

    test('should generate IDs with corr prefix', () => {
      const id = generateCorrelationId();

      expect(id.startsWith('corr-')).toBe(true);
    });

    test('should generate IDs with valid format', () => {
      const id = generateCorrelationId();

      expect(isValidCorrelationId(id)).toBe(true);
    });
  });

  describe('generateChildCorrelationId', () => {
    test('should generate unique child IDs', () => {
      const parentId = 'corr-abc123-def456';
      const child1 = generateChildCorrelationId(parentId);
      const child2 = generateChildCorrelationId(parentId);

      expect(child1).not.toBe(child2);
    });

    test('should include parent reference in child ID', () => {
      const parentId = 'corr-abc123-def456';
      const child = generateChildCorrelationId(parentId);

      expect(child.startsWith('corr-')).toBe(true);
      expect(child).not.toBe(parentId);
    });
  });

  describe('getCurrentCorrelationContext', () => {
    test('should return undefined when no context exists', () => {
      const context = getCurrentCorrelationContext();

      expect(context).toBeUndefined();
    });

    test('should return context when inside correlation scope', () => {
      const scope = createCorrelationScope('test-correlation-id');
      const result = scope(() => {
        return getCurrentCorrelationContext();
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-correlation-id');
    });
  });

  describe('getCurrentCorrelationId', () => {
    test('should return undefined when no context exists', () => {
      const id = getCurrentCorrelationId();

      expect(id).toBeUndefined();
    });

    test('should return ID when inside correlation scope', () => {
      const scope = createCorrelationScope('test-correlation-id');
      const result = scope(() => {
        return getCurrentCorrelationId();
      });

      expect(result).toBe('test-correlation-id');
    });
  });

  describe('getParentCorrelationId', () => {
    test('should return undefined when no parent context', () => {
      const scope = createCorrelationScope('parent-id');
      const result = scope(() => {
        return getParentCorrelationId();
      });

      expect(result).toBeUndefined();
    });

    test('should return parent ID when nested scope', () => {
      const innerResult = createCorrelationScope('parent-id')(() => {
        return createCorrelationScope('child-id')(() => {
          return {
            current: getCurrentCorrelationId(),
            parent: getParentCorrelationId(),
          };
        });
      });

      expect(innerResult?.current).toBe('child-id');
      expect(innerResult?.parent).toBe('parent-id');
    });
  });

  describe('createCorrelationScope', () => {
    test('should execute sync operation with correlation', () => {
      let capturedId: string | undefined;

      const scope = createCorrelationScope('scope-id');
      scope(() => {
        capturedId = getCurrentCorrelationId();
      });

      expect(capturedId).toBe('scope-id');
    });

    test('should execute async operation with correlation', async () => {
      let capturedId: string | undefined;

      const scope = createCorrelationScope('async-scope-id');
      await scope(async () => {
        capturedId = getCurrentCorrelationId();
        await Promise.resolve();
      });

      expect(capturedId).toBe('async-scope-id');
    });

    test('should preserve correlation across async boundaries', async () => {
      let capturedIds: string[] = [];

      const scope = createCorrelationScope('outer-id');
      await scope(async () => {
        capturedIds.push(getCurrentCorrelationId() ?? '');
        await Promise.resolve();
        capturedIds.push(getCurrentCorrelationId() ?? '');
        await Promise.resolve();
        capturedIds.push(getCurrentCorrelationId() ?? '');
      });

      expect(capturedIds.every(id => id === 'outer-id')).toBe(true);
    });
  });

  describe('withCorrelationId', () => {
    test('should set correlation ID for sync operation', () => {
      let capturedId: string | undefined;

      withCorrelationId('with-id', () => {
        capturedId = getCurrentCorrelationId();
      });

      expect(capturedId).toBe('with-id');
    });
  });

  describe('withChildCorrelationId', () => {
    test('should create child ID from parent', () => {
      let capturedId: string | undefined;
      let parentId: string | undefined;

      withCorrelationId('parent-123', () => {
        parentId = getCurrentCorrelationId();
        withChildCorrelationId(parentId!, () => {
          capturedId = getCurrentCorrelationId();
        });
      });

      expect(parentId).toBe('parent-123');
      expect(capturedId).toBeDefined();
      expect(capturedId).not.toBe(parentId);
    });
  });

  describe('bindToCorrelation', () => {
    test('should bind sync function to correlation ID', () => {
      const fn = vi.fn(() => getCurrentCorrelationId());
      const boundFn = bindToCorrelation(fn, 'bound-id');

      const result = boundFn();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe('bound-id');
    });

    test('should bind async function to correlation ID', async () => {
      const fn = vi.fn(async () => {
        await Promise.resolve();
        return getCurrentCorrelationId();
      });
      const boundFn = bindToCorrelation(fn, 'async-bound-id');

      const result = await boundFn();

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe('async-bound-id');
    });

    test('should propagate this context', () => {
      const context = { value: 'test' };

      function getValueFn(this: { value: string }) {
        return this.value;
      }

      const boundFn = bindToCorrelation(getValueFn, 'this-test');
      const result = boundFn.call(context);

      expect(result).toBe('test');
    });
  });

  describe('extractCorrelationFromHeaders', () => {
    test('should extract from x-correlation-id', () => {
      const headers = { 'x-correlation-id': 'header-id' };
      const result = extractCorrelationFromHeaders(headers);

      expect(result).toBe('header-id');
    });

    test('should extract from X-Correlation-ID', () => {
      const headers = { 'X-Correlation-ID': 'uppercase-id' };
      const result = extractCorrelationFromHeaders(headers);

      expect(result).toBe('uppercase-id');
    });

    test('should extract from request-id', () => {
      const headers = { 'request-id': 'request-id-value' };
      const result = extractCorrelationFromHeaders(headers);

      expect(result).toBe('request-id-value');
    });

    test('should extract from trace-id', () => {
      const headers = { 'trace-id': 'trace-value' };
      const result = extractCorrelationFromHeaders(headers);

      expect(result).toBe('trace-value');
    });

    test('should return undefined when no correlation header', () => {
      const headers = { 'content-type': 'application/json' };
      const result = extractCorrelationFromHeaders(headers);

      expect(result).toBeUndefined();
    });

    test('should prefer x-correlation-id over other headers', () => {
      const headers = {
        'x-correlation-id': 'preferred',
        'request-id': 'secondary',
        'trace-id': 'tertiary',
      };
      const result = extractCorrelationFromHeaders(headers);

      expect(result).toBe('preferred');
    });
  });

  describe('createCorrelationHeaders', () => {
    test('should create headers with provided ID', () => {
      const headers = createCorrelationHeaders('custom-id');

      expect(headers['x-correlation-id']).toBe('custom-id');
      expect(headers['request-id']).toBe('custom-id');
      expect(headers['trace-id']).toBe('custom-id');
    });

    test('should generate ID if none provided', () => {
      const headers = createCorrelationHeaders();

      expect(headers['x-correlation-id']).toBeDefined();
      expect(isValidCorrelationId(headers['x-correlation-id']!)).toBe(true);
    });

    test('should use current context ID when available', () => {
      const scope = createCorrelationScope('context-id');
      const headers = scope(() => {
        return createCorrelationHeaders();
      });

      expect(headers['x-correlation-id']).toBe('context-id');
    });
  });

  describe('isValidCorrelationId', () => {
    test('should return true for valid correlation IDs', () => {
      expect(isValidCorrelationId('corr-abc123-def456')).toBe(true);
      expect(isValidCorrelationId('corr-xyz789-child-abc')).toBe(true);
    });

    test('should return false for invalid IDs', () => {
      expect(isValidCorrelationId('invalid')).toBe(false);
      expect(isValidCorrelationId('')).toBe(false);
      expect(isValidCorrelationId(123)).toBe(false);
      expect(isValidCorrelationId(null)).toBe(false);
      expect(isValidCorrelationId(undefined)).toBe(false);
    });
  });

  describe('nested scopes', () => {
    test('should maintain separate contexts in nested scopes', () => {
      const ids: string[] = [];

      const scope1 = createCorrelationScope('level-1');
      scope1(() => {
        ids.push(getCurrentCorrelationId() ?? '');

        const scope2 = createCorrelationScope('level-2');
        scope2(() => {
          ids.push(getCurrentCorrelationId() ?? '');
          ids.push(getParentCorrelationId() ?? '');

          const scope3 = createCorrelationScope('level-3');
          scope3(() => {
            ids.push(getCurrentCorrelationId() ?? '');
            ids.push(getParentCorrelationId() ?? '');
          });
        });
      });

      expect(ids).toEqual(['level-1', 'level-2', 'level-1', 'level-3', 'level-2']);
    });

    test('should isolate contexts in parallel operations', async () => {
      const results: string[][] = [];

      await Promise.all([
        createCorrelationScope('parallel-1')(async () => {
          const ids: string[] = [];
          ids.push(getCurrentCorrelationId() ?? '');
          await Promise.resolve();
          ids.push(getCurrentCorrelationId() ?? '');
          results.push(ids);
        }),
        createCorrelationScope('parallel-2')(async () => {
          const ids: string[] = [];
          ids.push(getCurrentCorrelationId() ?? '');
          await Promise.resolve();
          ids.push(getCurrentCorrelationId() ?? '');
          results.push(ids);
        }),
      ]);

      expect(results[0]).toEqual(['parallel-1', 'parallel-1']);
      expect(results[1]).toEqual(['parallel-2', 'parallel-2']);
      expect(results[0][0]).not.toBe(results[1][0]);
    });
  });

  describe('error handling', () => {
    test('should preserve correlation in catch block', async () => {
      let capturedId: string | undefined;

      try {
        const scope = createCorrelationScope('error-scope');
        await scope(async () => {
          capturedId = getCurrentCorrelationId();
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      expect(capturedId).toBe('error-scope');
    });

    test('should preserve correlation in finally block', async () => {
      let capturedId: string | undefined;
      let finallyExecuted = false;

      const scope = createCorrelationScope('finally-scope');
      try {
        await scope(async () => {
          capturedId = getCurrentCorrelationId();
          try {
            throw new Error('Test error');
          } finally {
            finallyExecuted = true;
          }
        });
      } catch {
        // Expected - error from inner throw
      }

      expect(capturedId).toBe('finally-scope');
      expect(finallyExecuted).toBe(true);
    });
  });
});
