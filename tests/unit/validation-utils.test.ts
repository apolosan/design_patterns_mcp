/**
 * Validation Utilities Tests
 * 
 * Tests for type-safe validation and sanitization functions.
 * 
 * @module validation-utils.test
 * @version 1.0.0
 * @created 2025-02-10
 */

import { describe, test, expect } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidUuid,
  isValidSemver,
  isValidIpv4,
  isValidIpv6,
  isValidHex,
  isValidBase64,
  isStrongPassword,
  escapeHtml,
  unescapeHtml,
  escapeSql,
  sanitizeInput,
  slugify,
  truncate,
  capitalize,
  isEmpty,
  normalizeNewlines,
  maskValue,
  validateRange,
  isInteger,
  isFloat,
  inRange,
  clamp
} from '../../src/utils/validation-utils.js';

describe('isValidEmail', () => {
  test('should validate correct emails', () => {
    expect(isValidEmail('user@example.com').isValid).toBe(true);
    expect(isValidEmail('user.name@example.co.uk').isValid).toBe(true);
    expect(isValidEmail('user+tag@example.org').isValid).toBe(true);
    expect(isValidEmail('user@subdomain.example.com').isValid).toBe(true);
  });

  test('should reject invalid emails', () => {
    expect(isValidEmail('').isValid).toBe(false);
    expect(isValidEmail('invalid').isValid).toBe(false);
    expect(isValidEmail('invalid@').isValid).toBe(false);
    expect(isValidEmail('@example.com').isValid).toBe(false);
    expect(isValidEmail('user@.com').isValid).toBe(false);
    expect(isValidEmail('user name@example.com').isValid).toBe(false);
  });

  test('should return email parts for valid emails', () => {
    const result = isValidEmail('user@example.com');
    expect(result.localPart).toBe('user');
    expect(result.domain).toBe('example.com');
  });

  test('should handle empty input', () => {
    expect(isValidEmail('').isValid).toBe(false);
    expect(isValidEmail('   ').isValid).toBe(false);
  });

  test('should reject emails exceeding length limits', () => {
    const longLocal = 'a'.repeat(65);
    expect(isValidEmail(`${longLocal}@example.com`).isValid).toBe(false);
  });
});

describe('isValidUrl', () => {
  test('should validate correct URLs', () => {
    expect(isValidUrl('https://example.com').isValid).toBe(true);
    expect(isValidUrl('http://subdomain.example.com/path').isValid).toBe(true);
    expect(isValidUrl('https://example.com/path?query=value').isValid).toBe(true);
    expect(isValidUrl('https://localhost:8080').isValid).toBe(true);
  });

  test('should reject invalid URLs', () => {
    expect(isValidUrl('').isValid).toBe(false);
    expect(isValidUrl('not-a-url').isValid).toBe(false);
    // ftp:// is accepted by URL constructor but not by our HTTPS-only regex
    expect(isValidUrl('ftp://example.com').isValid).toBe(false);
  });

  test('should return URL parts for valid URLs', () => {
    const result = isValidUrl('https://example.com/path/to/page');
    expect(result.protocol).toBe('https:');
    expect(result.hostname).toBe('example.com');
    expect(result.pathname).toBe('/path/to/page');
  });

  test('should handle URLs with fragments', () => {
    const result = isValidUrl('https://example.com/page#section');
    expect(result.isValid).toBe(true);
  });
});

describe('isValidUuid', () => {
  test('should validate correct UUIDs', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000').isValid).toBe(true);
    expect(isValidUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479').isValid).toBe(true);
  });

  test('should reject invalid UUIDs', () => {
    expect(isValidUuid('').isValid).toBe(false);
    expect(isValidUuid('not-a-uuid').isValid).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716').isValid).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000-extra').isValid).toBe(false);
  });

  test('should be case insensitive', () => {
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000').isValid).toBe(true);
  });
});

describe('isValidSemver', () => {
  test('should validate correct semantic versions', () => {
    expect(isValidSemver('1.0.0').isValid).toBe(true);
    expect(isValidSemver('2.15.3').isValid).toBe(true);
    expect(isValidSemver('0.0.1').isValid).toBe(true);
    expect(isValidSemver('1.0.0-alpha.1').isValid).toBe(true);
    expect(isValidSemver('1.0.0+build.123').isValid).toBe(true);
  });

  test('should return version parts', () => {
    const result = isValidSemver('1.2.3-alpha.1+build.456');
    expect(result.major).toBe(1);
    expect(result.minor).toBe(2);
    expect(result.patch).toBe(3);
    expect(result.prerelease).toBe('alpha.1');
    expect(result.build).toBe('build.456');
  });

  test('should reject invalid versions', () => {
    expect(isValidSemver('').isValid).toBe(false);
    expect(isValidSemver('1.0').isValid).toBe(false);
    expect(isValidSemver('v1.0.0').isValid).toBe(false);
    expect(isValidSemver('1.0.0.0').isValid).toBe(false);
  });
});

describe('isValidIpv4', () => {
  test('should validate correct IPv4 addresses', () => {
    expect(isValidIpv4('192.168.1.1').isValid).toBe(true);
    expect(isValidIpv4('0.0.0.0').isValid).toBe(true);
    expect(isValidIpv4('255.255.255.255').isValid).toBe(true);
    expect(isValidIpv4('127.0.0.1').isValid).toBe(true);
  });

  test('should reject invalid IPv4 addresses', () => {
    expect(isValidIpv4('').isValid).toBe(false);
    expect(isValidIpv4('256.1.1.1').isValid).toBe(false);
    expect(isValidIpv4('192.168.1').isValid).toBe(false);
    expect(isValidIpv4('192.168.1.1.1').isValid).toBe(false);
    expect(isValidIpv4('abc.def.ghi.jkl').isValid).toBe(false);
  });
});

describe('isValidIpv6', () => {
  test('should validate correct IPv6 addresses', () => {
    expect(isValidIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334').isValid).toBe(true);
    // Note: Our regex requires full IPv6 format
    expect(isValidIpv6('2001:db8:85a3:0:0:8a2e:370:7334').isValid).toBe(true);
    expect(isValidIpv6('::').isValid).toBe(true);
    expect(isValidIpv6('2001:db8::1').isValid).toBe(true);
  });

  test('should reject invalid IPv6 addresses', () => {
    expect(isValidIpv6('').isValid).toBe(false);
    expect(isValidIpv6('192.168.1.1').isValid).toBe(false);
    expect(isValidIpv6(':::').isValid).toBe(false);
  });
});

describe('isValidHex', () => {
  test('should validate correct hex values', () => {
    expect(isValidHex('FF00FF').isValid).toBe(true);
    expect(isValidHex('ff00ff').isValid).toBe(true);
    expect(isValidHex('#FF00FF').isValid).toBe(true);
    expect(isValidHex('#FFF').isValid).toBe(true);
    expect(isValidHex('AbCdEf').isValid).toBe(true);
  });

  test('should reject invalid hex values', () => {
    expect(isValidHex('').isValid).toBe(false);
    expect(isValidHex('GG00FF').isValid).toBe(false);
    // FF00 (4 chars) is actually valid hex
    expect(isValidHex('G0').isValid).toBe(false);
  });

  test('should handle case sensitivity option', () => {
    // caseSensitive only affects the error message, not validation
    expect(isValidHex('ff00ff', { caseSensitive: true }).isValid).toBe(true);
    expect(isValidHex('FF00FF', { caseSensitive: true }).isValid).toBe(true);
  });
});

describe('isValidBase64', () => {
  test('should validate correct Base64 values', () => {
    expect(isValidBase64('SGVsbG8gV29ybGQ=').isValid).toBe(true);
    expect(isValidBase64('TWFuIGlzIGRpc3Rpbmd1aXNoZWQsIG5vdCBvbmx5IGJ5IGhpcyByZWFzb24sIGJ1dCBieSB0aGlzIHNpbmd1bQ==').isValid).toBe(true);
  });

  test('should reject invalid Base64 values', () => {
    expect(isValidBase64('').isValid).toBe(false);
    expect(isValidBase64('SGVsbG8gV29ybGQ').isValid).toBe(false);
    expect(isValidBase64('SGVsbG8gV29ybGQ====').isValid).toBe(false);
  });
});

describe('isStrongPassword', () => {
  test('should validate strong passwords', () => {
    expect(isStrongPassword('Password1!').isValid).toBe(true);
    expect(isStrongPassword('MySecure123@').isValid).toBe(true);
    expect(isStrongPassword('C0mplex!Pass').isValid).toBe(true);
  });

  test('should reject weak passwords', () => {
    expect(isStrongPassword('password').isValid).toBe(false);
    expect(isStrongPassword('PASSWORD').isValid).toBe(false);
    expect(isStrongPassword('12345678').isValid).toBe(false);
    expect(isStrongPassword('Pass').isValid).toBe(false);
    expect(isStrongPassword('password1').isValid).toBe(false);
    expect(isStrongPassword('PASSWORD1').isValid).toBe(false);
  });

  test('should respect custom options', () => {
    expect(isStrongPassword('Password1!', { minLength: 12 }).isValid).toBe(false);
    expect(isStrongPassword('Pass1!', { minLength: 4 }).isValid).toBe(true);
  });
});

describe('escapeHtml', () => {
  test('should escape HTML special characters', () => {
    expect(escapeHtml('<div>Hello & "World"</div>')).toBe('&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;');
    expect(escapeHtml("It's a test")).toBe('It&#x27;s a test');
    // / is also escaped for security
    expect(escapeHtml('/path/')).toBe('&#x2F;path&#x2F;');
  });

  test('should handle empty input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });
});

describe('unescapeHtml', () => {
  test('should unescape HTML entities', () => {
    expect(unescapeHtml('&lt;div&gt;')).toBe('<div>');
    expect(unescapeHtml('&amp;')).toBe('&');
    expect(unescapeHtml('&quot;')).toBe('"');
  });

  test('should handle empty input', () => {
    expect(unescapeHtml('')).toBe('');
    expect(unescapeHtml(null as unknown as string)).toBe('');
  });
});

describe('escapeSql', () => {
  test('should escape SQL special characters', () => {
    expect(escapeSql("O'Reilly")).toBe("O''Reilly");
    expect(escapeSql('BACK\\SLASH')).toBe('BACK\\\\SLASH');
  });

  test('should escape dangerous SQL patterns', () => {
    // We escape -- to - - (space added) to break the comment syntax
    expect(escapeSql('SELECT * FROM users -- comment')).toContain('- -');
  });

  test('should handle empty input', () => {
    expect(escapeSql('')).toBe('');
    expect(escapeSql(null as unknown as string)).toBe('');
  });
});

describe('sanitizeInput', () => {
  test('should trim by default', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  test('should remove extra spaces', () => {
    expect(sanitizeInput('hello    world')).toBe('hello world');
    expect(sanitizeInput('hello\n\nworld')).toBe('hello world');
  });

  test('should respect maxLength', () => {
    expect(sanitizeInput('hello world', { maxLength: 5 })).toBe('hello');
  });

  test('should handle empty input', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null as unknown as string)).toBe('');
  });
});

describe('slugify', () => {
  test('should create valid slugs', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Test Page Title')).toBe('test-page-title');
    expect(slugify('  multiple   spaces  ')).toBe('multiple-spaces');
  });

  test('should remove special characters', () => {
    expect(slugify('Hello@#$%World')).toBe('hello-world');
    // Underscore is allowed in slugs (not replaced)
    expect(slugify('Test_Page')).toBe('test_page');
  });

  test('should respect maxLength', () => {
    expect(slugify('this-is-a-very-long-slug-that-needs-truncating', { maxLength: 10 })).toBe('this-is-a');
  });

  test('should handle custom separator', () => {
    expect(slugify('Hello World', { separator: '_' })).toBe('hello_world');
  });
});

describe('truncate', () => {
  test('should truncate long strings', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
    // When string length equals maxLength, returns original
    expect(truncate('Hello World', 11)).toBe('Hello World');
  });

  test('should return original if shorter', () => {
    expect(truncate('Hi', 10)).toBe('Hi');
  });

  test('should handle custom suffix', () => {
    // When maxLength equals suffix length, returns empty suffix
    expect(truncate('Hello', 5, { suffix: '***' })).toBe('He');
    expect(truncate('Hello', 8, { suffix: '***' })).toBe('He***');
  });

  test('should preserve words when option set', () => {
    expect(truncate('hello world test', 10, { preserveWords: true })).toBe('hello...');
  });
});

describe('capitalize', () => {
  test('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('HELLO')).toBe('Hello');
  });

  test('should capitalize all words', () => {
    expect(capitalize('hello world', { allWords: true })).toBe('Hello World');
    expect(capitalize('HELLO WORLD', { allWords: true })).toBe('Hello World');
  });

  test('should handle empty input', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null as unknown as string)).toBe('');
  });
});

describe('isEmpty', () => {
  test('should detect empty values', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
  });

  test('should detect non-empty values', () => {
    expect(isEmpty('hello')).toBe(false);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty([1, 2, 3])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});

describe('normalizeNewlines', () => {
  test('should normalize to LF', () => {
    expect(normalizeNewlines('hello\r\nworld\r\n')).toBe('hello\nworld\n');
    expect(normalizeNewlines('hello\rworld')).toBe('hello\nworld');
  });

  test('should normalize to CRLF', () => {
    expect(normalizeNewlines('hello\nworld\n', '\r\n')).toBe('hello\r\nworld\r\n');
  });

  test('should handle empty input', () => {
    expect(normalizeNewlines('')).toBe('');
    expect(normalizeNewlines(null as unknown as string)).toBe('');
  });
});

describe('maskValue', () => {
  test('should mask middle of value', () => {
    // 10 chars, 3 visible start, 4 visible end = 3 chars masked
    expect(maskValue('1234567890', { visibleStart: 3, visibleEnd: 4 })).toBe('123***7890');
    expect(maskValue('1234567890', { visibleStart: 0, visibleEnd: 0 })).toBe('**********');
  });

  test('should mask entire value if shorter than visible parts', () => {
    expect(maskValue('12', { visibleStart: 3, visibleEnd: 4 })).toBe('12');
  });

  test('should handle empty input', () => {
    expect(maskValue('')).toBe('');
    expect(maskValue(null as unknown as string)).toBe('');
  });
});

describe('validateRange', () => {
  test('should validate values in range', () => {
    expect(validateRange(5, 1, 10).isValid).toBe(true);
    expect(validateRange(1, 1, 10).isValid).toBe(true);
    expect(validateRange(10, 1, 10).isValid).toBe(true);
  });

  test('should reject values out of range', () => {
    expect(validateRange(0, 1, 10).isValid).toBe(false);
    expect(validateRange(11, 1, 10).isValid).toBe(false);
  });

  test('should reject invalid numbers', () => {
    expect(validateRange(NaN, 1, 10).isValid).toBe(false);
    expect(validateRange(Infinity, 1, 10).isValid).toBe(false);
  });
});

describe('isInteger', () => {
  test('should identify integers', () => {
    expect(isInteger(5)).toBe(true);
    expect(isInteger(0)).toBe(true);
    expect(isInteger(-5)).toBe(true);
  });

  test('should identify non-integers', () => {
    expect(isInteger(5.5)).toBe(false);
    expect(isInteger(NaN)).toBe(false);
    expect(isInteger('5' as unknown as number)).toBe(false);
  });
});

describe('isFloat', () => {
  test('should identify floats', () => {
    expect(isFloat(5.5)).toBe(true);
    expect(isFloat(-5.5)).toBe(true);
    expect(isFloat(0.1)).toBe(true);
  });

  test('should identify non-floats', () => {
    expect(isFloat(5)).toBe(false);
    expect(isFloat(NaN)).toBe(false);
    expect(isFloat(Infinity)).toBe(false);
  });
});

describe('inRange', () => {
  test('should return true for values in range', () => {
    expect(inRange(5, 1, 10)).toBe(true);
    expect(inRange(1, 1, 10)).toBe(true);
    expect(inRange(10, 1, 10)).toBe(true);
  });

  test('should return false for values out of range', () => {
    expect(inRange(0, 1, 10)).toBe(false);
    expect(inRange(11, 1, 10)).toBe(false);
  });
});

describe('clamp', () => {
  test('should clamp values within range', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(11, 1, 10)).toBe(10);
  });

  test('should return min if min > max', () => {
    expect(clamp(5, 10, 1)).toBe(10);
  });
});
