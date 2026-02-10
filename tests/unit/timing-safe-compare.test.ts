import { describe, test, expect } from 'vitest';
import {
  timingSafeCompare,
  timingSafeCompareBuffers,
  timingSafeCompareData,
  timingSafeCompareDetailed,
  secureRandom,
  generateSecureToken,
  generateCustomToken,
  constantTimeBoolean,
  constantTimeSelect,
  constantTimeArrayCompare,
  compareSecrets,
  mitigateHashDoS,
  secureTruncate,
  constantTimeLengthCompare
} from '../../src/utils/timing-safe-compare.js';

describe('timingSafeCompare', () => {
  test('should return true for equal strings', () => {
    expect(timingSafeCompare('test', 'test')).toBe(true);
  });

  test('should return false for different strings', () => {
    expect(timingSafeCompare('test', 'TEST')).toBe(false);
    expect(timingSafeCompare('test', 'tes')).toBe(false);
    expect(timingSafeCompare('test', 'testing')).toBe(false);
  });

  test('should return false for different length strings', () => {
    expect(timingSafeCompare('short', 'longerstring')).toBe(false);
  });

  test('should handle empty strings', () => {
    expect(timingSafeCompare('', '')).toBe(true);
    expect(timingSafeCompare('', 'a')).toBe(false);
  });

  test('should handle unicode strings', () => {
    expect(timingSafeCompare('hello', 'hello')).toBe(true);
    expect(timingSafeCompare('héllo', 'héllo')).toBe(true);
    expect(timingSafeCompare('hello', 'héllo')).toBe(false);
  });
});

describe('timingSafeCompareBuffers', () => {
  test('should return true for equal buffers', () => {
    const buf1 = new Uint8Array([1, 2, 3, 4, 5]);
    const buf2 = new Uint8Array([1, 2, 3, 4, 5]);
    expect(timingSafeCompareBuffers(buf1, buf2)).toBe(true);
  });

  test('should return false for different buffers', () => {
    const buf1 = new Uint8Array([1, 2, 3, 4, 5]);
    const buf2 = new Uint8Array([1, 2, 3, 4, 6]);
    expect(timingSafeCompareBuffers(buf1, buf2)).toBe(false);
  });

  test('should return false for different length buffers', () => {
    const buf1 = new Uint8Array([1, 2, 3]);
    const buf2 = new Uint8Array([1, 2, 3, 4]);
    expect(timingSafeCompareBuffers(buf1, buf2)).toBe(false);
  });

  test('should handle empty buffers', () => {
    expect(timingSafeCompareBuffers(new Uint8Array([]), new Uint8Array([]))).toBe(true);
    expect(timingSafeCompareBuffers(new Uint8Array([]), new Uint8Array([1]))).toBe(false);
  });
});

describe('timingSafeCompareData', () => {
  test('should compare strings', () => {
    expect(timingSafeCompareData('test', 'test')).toBe(true);
    expect(timingSafeCompareData('test', 'TEST')).toBe(false);
  });

  test('should compare Uint8Arrays', () => {
    const arr1 = new Uint8Array([1, 2, 3]);
    const arr2 = new Uint8Array([1, 2, 3]);
    const arr3 = new Uint8Array([1, 2, 4]);
    expect(timingSafeCompareData(arr1, arr2)).toBe(true);
    expect(timingSafeCompareData(arr1, arr3)).toBe(false);
  });

  test('should compare ArrayBuffers', () => {
    const buf1 = new ArrayBuffer(4);
    const buf2 = new ArrayBuffer(4);
    const view1 = new Uint8Array(buf1);
    const view2 = new Uint8Array(buf2);
    view1.set([1, 2, 3, 4]);
    view2.set([1, 2, 3, 4]);
    expect(timingSafeCompareData(buf1, buf2)).toBe(true);
  });
});

describe('timingSafeCompareDetailed', () => {
  test('should return detailed result for equal strings', () => {
    const result = timingSafeCompareDetailed('test', 'test');
    expect(result.equal).toBe(true);
    expect(result.timingLeaked).toBe(false);
  });

  test('should return detailed result for different strings', () => {
    const result = timingSafeCompareDetailed('test', 'TEST');
    expect(result.equal).toBe(false);
    expect(result.timingLeaked).toBe(false);
  });
});

describe('secureRandom', () => {
  test('should generate random bytes', () => {
    const random1 = secureRandom(32);
    const random2 = secureRandom(32);

    expect(random1).toBeInstanceOf(Uint8Array);
    expect(random1.length).toBe(32);
    expect(random2.length).toBe(32);
  });

  test('should generate different values', () => {
    const random1 = secureRandom(16);
    const random2 = secureRandom(16);
    
    let different = false;
    for (let i = 0; i < 16; i++) {
      if (random1[i] !== random2[i]) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });

  test('should handle size 0', () => {
    const random = secureRandom(0);
    expect(random).toBeInstanceOf(Uint8Array);
    expect(random.length).toBe(0);
  });
});

describe('generateSecureToken', () => {
  test('should generate token of specified length', () => {
    const token = generateSecureToken(16);
    expect(token.length).toBe(16);
  });

  test('should use default length', () => {
    const token = generateSecureToken();
    expect(token.length).toBe(32);
  });

  test('should only use allowed characters', () => {
    const token = generateSecureToken(100);
    const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (const char of token) {
      expect(allowedChars.includes(char)).toBe(true);
    }
  });
});

describe('generateCustomToken', () => {
  test('should generate token using custom alphabet', () => {
    const token = generateCustomToken(10, 'ab');
    expect(token.length).toBe(10);
    for (const char of token) {
      expect(['a', 'b'].includes(char)).toBe(true);
    }
  });

  test('should throw for empty alphabet', () => {
    expect(() => generateCustomToken(10, '')).toThrow('Alphabet cannot be empty');
  });
});

describe('constantTimeBoolean', () => {
  test('should return 1 for true', () => {
    expect(constantTimeBoolean(true)).toBe(1);
  });

  test('should return 0 for false', () => {
    expect(constantTimeBoolean(false)).toBe(0);
  });
});

describe('constantTimeSelect', () => {
  test('should return trueValue when condition is true', () => {
    expect(constantTimeSelect(true, 'a', 'b')).toBe('a');
    expect(constantTimeSelect(true, 1, 2)).toBe(1);
  });

  test('should return falseValue when condition is false', () => {
    expect(constantTimeSelect(false, 'a', 'b')).toBe('b');
    expect(constantTimeSelect(false, 1, 2)).toBe(2);
  });
});

describe('constantTimeArrayCompare', () => {
  test('should return true for equal arrays', () => {
    expect(constantTimeArrayCompare([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(constantTimeArrayCompare(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  test('should return false for different arrays', () => {
    expect(constantTimeArrayCompare([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(constantTimeArrayCompare(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  test('should return false for different length arrays', () => {
    expect(constantTimeArrayCompare([1, 2, 3], [1, 2])).toBe(false);
    expect(constantTimeArrayCompare([1], [1, 2, 3])).toBe(false);
  });

  test('should handle empty arrays', () => {
    expect(constantTimeArrayCompare([], [])).toBe(true);
    expect(constantTimeArrayCompare([], [1])).toBe(false);
  });
});

describe('compareSecrets', () => {
  test('should return true for matching secrets', () => {
    expect(compareSecrets('secret123', 'secret123')).toBe(true);
  });

  test('should return false for non-matching secrets', () => {
    expect(compareSecrets('secret123', 'secret456')).toBe(false);
  });

  test('should return false for empty inputs', () => {
    expect(compareSecrets('', 'secret')).toBe(false);
    expect(compareSecrets('secret', '')).toBe(false);
    expect(compareSecrets('', '')).toBe(false);
  });
});

describe('mitigateHashDoS', () => {
  test('should return valid input', () => {
    expect(mitigateHashDoS('test', 100)).toBe('test');
  });

  test('should throw for input exceeding max length', () => {
    expect(() => mitigateHashDoS('a'.repeat(1001), 1000)).toThrow('exceeds maximum length');
  });

  test('should throw for non-string input', () => {
    expect(() => mitigateHashDoS(123 as unknown as string, 100)).toThrow('must be a string');
  });

  test('should use default max length', () => {
    expect(mitigateHashDoS('test')).toBe('test');
    expect(() => mitigateHashDoS('a'.repeat(1001))).toThrow('exceeds maximum length');
  });
});

describe('secureTruncate', () => {
  test('should return original string if shorter than max', () => {
    expect(secureTruncate('test', 10)).toBe('test');
  });

  test('should truncate string to max length', () => {
    expect(secureTruncate('hello world', 5)).toBe('hello');
  });

  test('should throw for negative max length', () => {
    expect(() => secureTruncate('test', -1)).toThrow('must be non-negative');
  });
});

describe('constantTimeLengthCompare', () => {
  test('should return 0 for equal lengths', () => {
    expect(constantTimeLengthCompare('abc', 'xyz')).toBe(0);
  });

  test('should return -1 when a is shorter', () => {
    expect(constantTimeLengthCompare('a', 'abc')).toBe(-1);
  });

  test('should return 1 when a is longer', () => {
    expect(constantTimeLengthCompare('abc', 'a')).toBe(1);
  });
});
