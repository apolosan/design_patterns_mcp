/**
 * Input Validation Tests
 * Comprehensive tests for input validation, sanitization, and security
 */

import { describe, it, expect } from 'vitest';
import { InputValidator } from '../../src/utils/input-validation.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

describe('InputValidator', () => {
  describe('validateString', () => {
    it('should validate required string successfully', () => {
      const result = InputValidator.validateString('test', 'field', { required: true });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBe('test');
    });

    it('should reject missing required string', () => {
      const result = InputValidator.validateString('', 'field', { required: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field is required');
    });

    it('should enforce max length', () => {
      const result = InputValidator.validateString('a'.repeat(101), 'field', { maxLength: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field must not exceed 100 characters');
    });

    it('should enforce min length', () => {
      const result = InputValidator.validateString('ab', 'field', { minLength: 3 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field must be at least 3 characters');
    });

    it('should validate pattern', () => {
      const result = InputValidator.validateString('INVALID', 'field', { pattern: /^[a-z]+$/ });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field format is invalid');
    });

    it('should validate allowed values', () => {
      const result = InputValidator.validateString('invalid', 'field', {
        allowedValues: ['valid1', 'valid2'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field must be one of: valid1, valid2');
    });

    it('should sanitize XSS content', () => {
      const result = InputValidator.validateString('<script>alert("xss")</script>', 'field', {
        sanitize: true,
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(''); // Script tags are completely removed
    });
  });

  describe('validateNumber', () => {
    it('should validate number successfully', () => {
      const result = InputValidator.validateNumber(42, 'field');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(42);
    });

    it('should parse string numbers', () => {
      const result = InputValidator.validateNumber('42', 'field');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(42);
    });

    it('should enforce min value', () => {
      const result = InputValidator.validateNumber(5, 'field', { min: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field must be at least 10');
    });

    it('should enforce max value', () => {
      const result = InputValidator.validateNumber(15, 'field', { max: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field must not exceed 10');
    });
  });

  describe('validateArray', () => {
    it('should validate array successfully', () => {
      const result = InputValidator.validateArray(['a', 'b'], 'field');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toEqual(['a', 'b']);
    });

    it('should enforce max length', () => {
      const result = InputValidator.validateArray(['a', 'b', 'c'], 'field', { maxLength: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field must not exceed 2 items');
    });

    it('should validate item constraints', () => {
      const result = InputValidator.validateArray(['valid', 'invalid!'], 'field', {
        itemValidator: item => InputValidator.validateString(item, 'item', { pattern: /^[a-z]+$/ }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('field[1]: item format is invalid');
    });
  });

  describe('validateBoolean', () => {
    it('should validate boolean successfully', () => {
      const result = InputValidator.validateBoolean(true, 'field');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(true);
    });

    it('should parse string booleans', () => {
      const result = InputValidator.validateBoolean('true', 'field');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(true);
    });

    it('should reject invalid boolean strings', () => {
      const result = InputValidator.validateBoolean('notboolean', 'field');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("field must be a boolean or 'true'/'false'");
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML entities', () => {
      const result = InputValidator.sanitizeString('<>&"\'/');
      expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;');
    });

    it('should remove script tags', () => {
      const result = InputValidator.sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should remove javascript URLs', () => {
      const result = InputValidator.sanitizeString('javascript:alert("xss")');
      expect(result).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const result = InputValidator.sanitizeString('<div onclick="alert()">test</div>');
      expect(result).not.toContain('onclick');
    });
  });

  describe('validatePatternId', () => {
    it('should validate valid pattern ID', () => {
      const result = InputValidator.validatePatternId('valid-pattern_123');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('valid-pattern_123');
    });

    it('should reject invalid pattern ID', () => {
      const result = InputValidator.validatePatternId('invalid@pattern');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('patternId format is invalid');
    });
  });

  describe('validateSearchQuery', () => {
    it('should validate valid search query', () => {
      const result = InputValidator.validateSearchQuery('design patterns');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('design patterns');
    });

    it('should reject empty query', () => {
      const result = InputValidator.validateSearchQuery('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('query is required');
    });

    it('should sanitize XSS in query', () => {
      const result = InputValidator.validateSearchQuery('<script>alert("xss")</script>');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(''); // Script tags are completely removed
    });
  });

  describe('validateProgrammingLanguage', () => {
    it('should validate valid programming language', () => {
      const result = InputValidator.validateProgrammingLanguage('typescript');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('typescript');
    });

    it('should reject invalid programming language', () => {
      const result = InputValidator.validateProgrammingLanguage('invalidlang');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'programmingLanguage must be one of: javascript, typescript, python, java, csharp, cpp, c, go, rust, php, ruby, swift, kotlin, scala, clojure, haskell, erlang, elixir, dart, lua, perl, r, matlab, sql, bash, powershell, html, css'
      );
    });
  });

  describe('validateLimit', () => {
    it('should validate valid limit', () => {
      const result = InputValidator.validateLimit(50);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(50);
    });

    it('should reject limit below minimum', () => {
      const result = InputValidator.validateLimit(0);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be at least 1');
    });

    it('should reject limit above maximum', () => {
      const result = InputValidator.validateLimit(101);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must not exceed 100');
    });
  });

  describe('validateMaxResults', () => {
    it('should validate valid max results', () => {
      const result = InputValidator.validateMaxResults(25);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(25);
    });

    it('should reject max results above limit', () => {
      const result = InputValidator.validateMaxResults(51);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxResults must not exceed 50');
    });
  });

  describe('validateCategories', () => {
    it('should validate valid categories', () => {
      const result = InputValidator.validateCategories(['category1', 'category2']);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toEqual(['category1', 'category2']);
    });

    it('should reject too many categories', () => {
      const categories = Array.from({ length: 21 }, (_, i) => `category${i}`);
      const result = InputValidator.validateCategories(categories);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('categories must not exceed 20 items');
    });
  });

  describe('Tool argument validation', () => {
    describe('validateFindPatternsArgs', () => {
      it('should validate valid find patterns args', () => {
        const args = {
          query: 'design patterns',
          categories: ['creational'],
          maxResults: 10,
          programmingLanguage: 'typescript',
        };
        const result = InputValidator.validateFindPatternsArgs(args);
        expect(result).toEqual({
          query: 'design patterns',
          categories: ['creational'],
          maxResults: 10,
          programmingLanguage: 'typescript',
        });
      });

      it('should throw on invalid args', () => {
        const args = { query: '' }; // Invalid empty query
        expect(() => InputValidator.validateFindPatternsArgs(args)).toThrow(McpError);
      });
    });

    describe('validateSearchPatternsArgs', () => {
      it('should validate valid search patterns args', () => {
        const args = {
          query: 'singleton',
          searchType: 'semantic',
          limit: 25,
        };
        const result = InputValidator.validateSearchPatternsArgs(args);
        expect(result).toEqual({
          query: 'singleton',
          searchType: 'semantic',
          limit: 25,
        });
      });
    });

    describe('validateGetPatternDetailsArgs', () => {
      it('should validate valid pattern details args', () => {
        const args = { patternId: 'singleton-pattern' };
        const result = InputValidator.validateGetPatternDetailsArgs(args);
        expect(result).toEqual({ patternId: 'singleton-pattern' });
      });
    });

    describe('validateCountPatternsArgs', () => {
      it('should validate valid count patterns args', () => {
        const args = { includeDetails: true };
        const result = InputValidator.validateCountPatternsArgs(args);
        expect(result).toEqual({ includeDetails: true });
      });
    });
  });

  describe('throwIfInvalid', () => {
    it('should not throw on valid result', () => {
      const result = { valid: true, errors: [], sanitized: 'test' };
      expect(() => InputValidator.throwIfInvalid(result)).not.toThrow();
    });

    it('should throw on invalid result', () => {
      const result = { valid: false, errors: ['Test error'], sanitized: undefined };
      expect(() => InputValidator.throwIfInvalid(result)).toThrow(McpError);
      expect(() => InputValidator.throwIfInvalid(result)).toThrow('Validation failed: Test error');
    });
  });
});
