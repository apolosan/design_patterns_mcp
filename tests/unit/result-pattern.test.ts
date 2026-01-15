/**
 * Tests for Result Pattern (Either/Result)
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  tryCatch,
  tryCatchAsync,
  combine,
  match,
  Result,
} from '../../src/types/result.js';

describe('Result Pattern', () => {
  describe('ok', () => {
    it('should create a success result', () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should work with objects', () => {
      const data = { name: 'test', value: 123 };
      const result = ok(data);
      expect(result.success).toBe(true);
      expect(result.value).toEqual(data);
    });

    it('should work with arrays', () => {
      const data = [1, 2, 3];
      const result = ok(data);
      expect(result.success).toBe(true);
      expect(result.value).toEqual(data);
    });
  });

  describe('err', () => {
    it('should create a failure result', () => {
      const error = new Error('test error');
      const result = err(error);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    it('should work with custom error types', () => {
      const customError = { code: 'E001', message: 'Custom error' };
      const result = err(customError);
      expect(result.success).toBe(false);
      expect(result.error).toEqual(customError);
    });
  });

  describe('isOk', () => {
    it('should return true for success results', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it('should return false for failure results', () => {
      const result = err(new Error('test'));
      expect(isOk(result)).toBe(false);
    });
  });

  describe('isErr', () => {
    it('should return true for failure results', () => {
      const result = err(new Error('test'));
      expect(isErr(result)).toBe(true);
    });

    it('should return false for success results', () => {
      const result = ok(42);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('map', () => {
    it('should transform the value of a success result', () => {
      const result = ok(5);
      const mapped = map(result, (x) => x * 2);
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should not transform failure results', () => {
      const error = new Error('test');
      const result = err(error);
      const mapped = map(result, (x: number) => x * 2);
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });
  });

  describe('mapErr', () => {
    it('should transform the error of a failure result', () => {
      const result = err(new Error('original'));
      const mapped = mapErr(result, (e) => new Error(`Wrapped: ${e.message}`));
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error.message).toBe('Wrapped: original');
      }
    });

    it('should not transform success results', () => {
      const result = ok(42);
      const mapped = mapErr(result, (e: Error) => new Error(`Wrapped: ${e.message}`));
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(42);
      }
    });
  });

  describe('flatMap', () => {
    it('should chain success results', () => {
      const result = ok(5);
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(isOk(chained)).toBe(true);
      if (isOk(chained)) {
        expect(chained.value).toBe(10);
      }
    });

    it('should propagate failure results', () => {
      const error = new Error('test');
      const result = err(error);
      const chained = flatMap(result, (x: number) => ok(x * 2));
      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe(error);
      }
    });

    it('should handle failures returned by the function', () => {
      const result = ok(5);
      const chained = flatMap(result, () => err(new Error('chain error')));
      expect(isErr(chained)).toBe(true);
    });
  });

  describe('unwrap', () => {
    it('should return the value of a success result', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw for failure results', () => {
      const error = new Error('test error');
      const result = err(error);
      expect(() => unwrap(result)).toThrow(error);
    });
  });

  describe('unwrapOr', () => {
    it('should return the value of a success result', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return the default value for failure results', () => {
      const result = err(new Error('test'));
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('unwrapOrElse', () => {
    it('should return the value of a success result', () => {
      const result = ok(42);
      expect(unwrapOrElse(result, () => 0)).toBe(42);
    });

    it('should return the computed value for failure results', () => {
      const result = err(new Error('test error'));
      expect(unwrapOrElse(result, (e) => e.message.length)).toBe(10);
    });
  });

  describe('tryCatch', () => {
    it('should wrap successful function execution', () => {
      const result = tryCatch(() => 42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should wrap thrown errors', () => {
      const result = tryCatch(() => {
        throw new Error('test error');
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('test error');
      }
    });

    it('should convert non-Error throws to Error', () => {
      const result = tryCatch(() => {
        throw 'string error';
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('string error');
      }
    });
  });

  describe('tryCatchAsync', () => {
    it('should wrap successful async function execution', async () => {
      const result = await tryCatchAsync(() => Promise.resolve(42));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should wrap async errors', async () => {
      const result = await tryCatchAsync(() => {
        return Promise.reject(new Error('async error'));
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('async error');
      }
    });
  });

  describe('combine', () => {
    it('should combine all success results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = combine(results);
      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should return the first error', () => {
      const error1 = new Error('first');
      const error2 = new Error('second');
      const results = [ok(1), err(error1), err(error2)];
      const combined = combine(results);
      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe(error1);
      }
    });

    it('should handle empty arrays', () => {
      const combined = combine([]);
      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual([]);
      }
    });
  });

  describe('match', () => {
    it('should call ok handler for success results', () => {
      const result = ok(42);
      const matched = match(result, {
        ok: (v: number) => `Value: ${v}`,
        err: (e: Error) => `Error: ${e.message}`,
      });
      expect(matched).toBe('Value: 42');
    });

    it('should call err handler for failure results', () => {
      const result = err(new Error('test'));
      const matched = match(result, {
        ok: (v: number) => `Value: ${v}`,
        err: (e: Error) => `Error: ${e.message}`,
      });
      expect(matched).toBe('Error: test');
    });
  });

  describe('Result namespace', () => {
    it('should export all functions', () => {
      expect(Result.ok).toBeDefined();
      expect(Result.err).toBeDefined();
      expect(Result.isOk).toBeDefined();
      expect(Result.isErr).toBeDefined();
      expect(Result.map).toBeDefined();
      expect(Result.mapErr).toBeDefined();
      expect(Result.flatMap).toBeDefined();
      expect(Result.unwrap).toBeDefined();
      expect(Result.unwrapOr).toBeDefined();
      expect(Result.unwrapOrElse).toBeDefined();
      expect(Result.tryCatch).toBeDefined();
      expect(Result.tryCatchAsync).toBeDefined();
      expect(Result.combine).toBeDefined();
      expect(Result.match).toBeDefined();
    });
  });
});
