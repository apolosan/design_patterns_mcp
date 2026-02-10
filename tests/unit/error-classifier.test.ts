/**
 * Error Classifier Tests
 * Tests for ErrorClassifier
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorClassifier,
  ErrorCategory,
  ErrorSeverity,
} from '../../src/utils/error-classifier.js';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier({
      includeStackTrace: false,
      includeSuggestions: true,
      defaultCategory: ErrorCategory.UNKNOWN,
      defaultSeverity: ErrorSeverity.MEDIUM,
    });
  });

  describe('Validation Errors', () => {
    it('should classify validation errors', () => {
      const error = new Error('Invalid input format');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.isRetryable).toBe(false);
      expect(result.isUserFacing).toBe(true);
    });

    it('should classify schema validation errors', () => {
      const error = new Error('Schema validation failed');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });

    it('should classify malformed data errors', () => {
      const error = new Error('Malformed JSON data');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });
  });

  describe('Authentication Errors', () => {
    it('should classify authentication errors', () => {
      const error = new Error('Unauthorized access token');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.isRetryable).toBe(false);
      expect(result.isUserFacing).toBe(true);
    });

    it('should classify JWT errors', () => {
      const error = new Error('JWT token expired');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should classify credential errors', () => {
      const error = new Error('Wrong credentials provided');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
    });
  });

  describe('Authorization Errors', () => {
    it('should classify authorization errors', () => {
      const error = new Error('Access denied');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.isRetryable).toBe(false);
    });

    it('should classify permission errors', () => {
      const error = new Error('Insufficient permissions');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.AUTHORIZATION);
    });
  });

  describe('Not Found Errors', () => {
    it('should classify not found errors', () => {
      const error = new Error('Resource not found');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NOT_FOUND);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should classify missing resource errors', () => {
      const error = new Error('Pattern does not exist');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NOT_FOUND);
    });
  });

  describe('Rate Limit Errors', () => {
    it('should classify rate limit errors', () => {
      const error = new Error('Too many requests');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(result.severity).toBe(ErrorSeverity.LOW);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify throttling errors', () => {
      const error = new Error('Request throttled');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
    });
  });

  describe('Timeout Errors', () => {
    it('should classify timeout errors', () => {
      const error = new Error('Request timed out');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TIMEOUT);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify deadline errors', () => {
      const error = new Error('Deadline exceeded');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TIMEOUT);
    });
  });

  describe('Circuit Breaker Errors', () => {
    it('should classify circuit breaker errors', () => {
      const error = new Error('Circuit breaker is open');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.CIRCUIT_BREAKER);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('Database Errors', () => {
    it('should classify database errors', () => {
      const error = new Error('Database connection failed');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.DATABASE);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify SQL errors', () => {
      const error = new Error('SQL syntax error');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.DATABASE);
    });

    it('should classify transaction errors', () => {
      const error = new Error('Transaction rollback');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.DATABASE);
    });
  });

  describe('Network Errors', () => {
    it('should classify network errors', () => {
      const error = new Error('Network unreachable');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify DNS errors', () => {
      const error = new Error('DNS lookup failed');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
    });
  });

  describe('External Service Errors', () => {
    it('should classify external service errors', () => {
      const error = new Error('External API returned error');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(result.isRetryable).toBe(true);
    });
  });

  describe('Internal Errors', () => {
    it('should classify internal errors', () => {
      const error = new Error('Unexpected null value');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.INTERNAL);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
      expect(result.isRetryable).toBe(false);
    });

    it('should classify undefined reference errors', () => {
      const error = new Error('Cannot read property of undefined');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.INTERNAL);
    });
  });

  describe('Unknown Errors', () => {
    it('should classify unknown errors with default category', () => {
      const error = new Error('Some obscure error');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should classify string errors', () => {
      const result = classifier.classify('This is a string error');

      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBe('This is a string error');
    });

    it('should classify unknown objects', () => {
      const result = classifier.classify({ code: 'ERR_UNKNOWN' });

      expect(result.category).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('Error Code Extraction', () => {
    it('should extract error code', () => {
      const error = new Error('Database error');
      (error as Error & { code?: string }).code = 'DB_CONNECTION';
      const result = classifier.classify(error);

      expect(result.code).toBe('DB_CONNECTION');
    });
  });

  describe('Message Truncation', () => {
    it('should truncate long messages', () => {
      const longMessage = 'A'.repeat(600);
      const error = new Error(longMessage);
      const result = classifier.classify(error);

      expect(result.message.length).toBe(500);
      expect(result.message.endsWith('...')).toBe(true);
    });
  });

  describe('Classify Many', () => {
    it('should classify multiple errors', () => {
      const errors = [
        new Error('Validation error'),
        new Error('Database error'),
        new Error('Timeout'),
      ];

      const results = classifier.classifyMany(errors);

      expect(results).toHaveLength(3);
      expect(results[0].category).toBe(ErrorCategory.VALIDATION);
      expect(results[1].category).toBe(ErrorCategory.DATABASE);
      expect(results[2].category).toBe(ErrorCategory.TIMEOUT);
    });
  });

  describe('Category Counts', () => {
    it('should count errors by category', () => {
      const errors = [
        new Error('Validation error'),
        new Error('Schema validation error'),
        new Error('Database error'),
        new Error('Timeout'),
      ];

      const counts = classifier.getCategoryCounts(errors);

      expect(counts[ErrorCategory.VALIDATION]).toBe(2);
      expect(counts[ErrorCategory.DATABASE]).toBe(1);
      expect(counts[ErrorCategory.TIMEOUT]).toBe(1);
    });
  });

  describe('Most Common Category', () => {
    it('should identify most common category', () => {
      const errors = [
        new Error('Validation error'),
        new Error('Schema validation error'),
        new Error('Schema validation error'),
        new Error('Database error'),
      ];

      const result = classifier.getMostCommonCategory(errors);

      expect(result).not.toBeNull();
      expect(result?.category).toBe(ErrorCategory.VALIDATION);
      expect(result?.count).toBe(3);
    });

    it('should return null for empty errors', () => {
      const result = classifier.getMostCommonCategory([]);

      expect(result).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should disable suggestions', () => {
      const classifierNoSuggestions = new ErrorClassifier({
        includeSuggestions: false,
      });

      const error = new Error('Validation error');
      const result = classifierNoSuggestions.classify(error);

      expect(result.suggestedAction).toBeUndefined();
    });

    it('should use custom default category', () => {
      const classifierCustom = new ErrorClassifier({
        defaultCategory: ErrorCategory.NETWORK,
      });

      const error = new Error('Unknown error');
      const result = classifierCustom.classify(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
    });
  });
});
