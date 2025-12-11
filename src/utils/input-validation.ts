/**
 * Input Validation and Sanitization Utilities
 * Provides comprehensive validation for user inputs to prevent security vulnerabilities
 * Implements guard clauses, type checking, and sanitization patterns
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: unknown;
}

interface ValidationOptions {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedValues?: (string | number | boolean)[];
  required?: boolean;
  sanitize?: boolean;
}

export class InputValidator {
  /**
   * Validates a string input with comprehensive checks
   */
  static validateString(
    value: unknown,
    fieldName: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];

    // Type checking
    if (value !== undefined && value !== null && typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return { valid: false, errors };
    }

    // Required check
    if (options.required && (!value || value.trim() === '')) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    // Skip further validation if value is empty and not required
    if (!value || value.trim() === '') {
      return { valid: true, errors: [], sanitized: value };
    }

    const trimmed = value.trim();

    // Length checks
    if (options.maxLength && trimmed.length > options.maxLength) {
      errors.push(`${fieldName} must not exceed ${options.maxLength} characters`);
    }

    if (options.minLength && trimmed.length < options.minLength) {
      errors.push(`${fieldName} must be at least ${options.minLength} characters`);
    }

    // Pattern validation
    if (options.pattern && !options.pattern.test(trimmed)) {
      errors.push(`${fieldName} format is invalid`);
    }

    // Allowed values check
    if (options.allowedValues && !options.allowedValues.includes(trimmed)) {
      errors.push(`${fieldName} must be one of: ${options.allowedValues.join(', ')}`);
    }

    // Sanitization
    let sanitized = trimmed;
    if (options.sanitize) {
      sanitized = this.sanitizeString(trimmed);
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  /**
   * Validates a number input
   */
  static validateNumber(
    value: unknown,
    fieldName: string,
    options: ValidationOptions & { min?: number; max?: number } = {}
  ): ValidationResult {
    const errors: string[] = [];

    // Type checking
    if (value !== undefined && value !== null && typeof value !== 'number') {
      // Try to parse string numbers
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
          errors.push(`${fieldName} must be a valid number`);
          return { valid: false, errors };
        }
        value = parsed;
      } else {
        errors.push(`${fieldName} must be a number`);
        return { valid: false, errors };
      }
    }

    // Required check
    if (options.required && (value === undefined || value === null || (typeof value === 'number' && isNaN(value)))) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    // Skip further validation if value is undefined/null and not required
    if (value === undefined || value === null) {
      return { valid: true, errors: [], sanitized: value };
    }

    // Ensure value is a number for further checks
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(`${fieldName} must be a valid number`);
      return { valid: false, errors };
    }

    // Range checks
    if (options.min !== undefined && value < options.min) {
      errors.push(`${fieldName} must be at least ${options.min}`);
    }

    if (options.max !== undefined && value > options.max) {
      errors.push(`${fieldName} must not exceed ${options.max}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: value,
    };
  }

  /**
   * Validates an array input
   */
  static validateArray(
    value: unknown,
    fieldName: string,
    options: ValidationOptions & { itemValidator?: (item: unknown) => ValidationResult } = {}
  ): ValidationResult {
    const errors: string[] = [];

    // Type checking
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`);
      return { valid: false, errors };
    }

    // Required check
    if (options.required && (!value || value.length === 0)) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    // Skip further validation if value is empty and not required
    if (!value || value.length === 0) {
      return { valid: true, errors: [], sanitized: value };
    }

    // Length checks
    if (options.maxLength && value.length > options.maxLength) {
      errors.push(`${fieldName} must not exceed ${options.maxLength} items`);
    }

    if (options.minLength && value.length < options.minLength) {
      errors.push(`${fieldName} must have at least ${options.minLength} items`);
    }

    // Item validation
    if (options.itemValidator) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = options.itemValidator(value[i]);
        if (!itemResult.valid) {
          errors.push(`${fieldName}[${i}]: ${itemResult.errors.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: value,
    };
  }

  /**
   * Validates a boolean input
   */
  static validateBoolean(
    value: unknown,
    fieldName: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];

    // Type checking and conversion
    if (value !== undefined && value !== null) {
      if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') {
          value = true;
        } else if (value.toLowerCase() === 'false') {
          value = false;
        } else {
          errors.push(`${fieldName} must be a boolean or 'true'/'false'`);
          return { valid: false, errors };
        }
      } else if (typeof value !== 'boolean') {
        errors.push(`${fieldName} must be a boolean`);
        return { valid: false, errors };
      }
    }

    // Required check
    if (options.required && value === undefined) {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: value,
    };
  }

  /**
   * Sanitizes a string to prevent XSS and injection attacks
   */
  static sanitizeString(value: string): string {
    if (!value) return value;

    return (
      value
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove potential script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<script\b[^>]*>.*?<\/script>/gi, '')
        // Remove javascript: URLs
        .replace(/javascript:/gi, '')
        // Remove data: URLs that might contain scripts
        .replace(/data:\s*text\/html/gi, 'data:text/plain')
        // Remove event handlers
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        // Escape HTML entities
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        // Trim whitespace
        .trim()
    );
  }

  /**
   * Sanitizes SQL-like inputs by escaping wildcards
   */
  static sanitizeSqlWildcards(value: string): string {
    if (!value) return value;

    return value
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * Validates and sanitizes pattern ID
   */
  static validatePatternId(id: unknown): ValidationResult {
    return this.validateString(id, 'patternId', {
      required: true,
      maxLength: 255,
      pattern: /^[a-zA-Z0-9_-]+$/,
      sanitize: true,
    });
  }

  /**
   * Validates and sanitizes search query
   */
  static validateSearchQuery(query: unknown): ValidationResult {
    return this.validateString(query, 'query', {
      required: true,
      maxLength: 1000,
      minLength: 1,
      sanitize: true,
    });
  }

  /**
   * Validates programming language
   */
  static validateProgrammingLanguage(lang: unknown): ValidationResult {
    const allowedLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'csharp',
      'cpp',
      'c',
      'go',
      'rust',
      'php',
      'ruby',
      'swift',
      'kotlin',
      'scala',
      'clojure',
      'haskell',
      'erlang',
      'elixir',
      'dart',
      'lua',
      'perl',
      'r',
      'matlab',
      'sql',
      'bash',
      'powershell',
      'html',
      'css',
    ];

    // Convert to lowercase for case-insensitive validation
    const normalizedLang = typeof lang === 'string' ? lang.toLowerCase() : lang;

    const result = this.validateString(normalizedLang, 'programmingLanguage', {
      maxLength: 50,
      allowedValues: allowedLanguages,
      sanitize: true,
    });

    // Return the original value if valid, normalized if sanitization occurred
    if (result.valid && result.sanitized) {
      return {
        ...result,
        sanitized: typeof lang === 'string' ? lang.trim() : result.sanitized,
      };
    }

    return result;
  }

  /**
   * Validates search type
   */
  static validateSearchType(type: unknown): ValidationResult {
    return this.validateString(type, 'searchType', {
      allowedValues: ['keyword', 'semantic', 'hybrid'],
      sanitize: true,
    });
  }

  /**
   * Validates limit parameter
   */
  static validateLimit(limit: unknown): ValidationResult {
    return this.validateNumber(limit, 'limit', {
      min: 1,
      max: 100,
      sanitize: true,
    });
  }

  /**
   * Validates max results parameter
   */
  static validateMaxResults(maxResults: unknown): ValidationResult {
    return this.validateNumber(maxResults, 'maxResults', {
      min: 1,
      max: 50,
      sanitize: true,
    });
  }

  /**
   * Validates categories array
   */
  static validateCategories(categories: unknown): ValidationResult {
    return this.validateArray(categories, 'categories', {
      maxLength: 20,
      itemValidator: item =>
        this.validateString(item, 'category', {
          maxLength: 100,
          sanitize: true,
        }),
    });
  }

  /**
   * Validates include details boolean
   */
  static validateIncludeDetails(includeDetails: unknown): ValidationResult {
    return this.validateBoolean(includeDetails, 'includeDetails', {
      sanitize: true,
    });
  }

  /**
   * Throws an MCP error if validation fails
   */
  static throwIfInvalid(
    result: ValidationResult,
    errorCode: ErrorCode = ErrorCode.InvalidRequest
  ): void {
    if (!result.valid) {
      throw new McpError(errorCode, `Validation failed: ${result.errors.join(', ')}`);
    }
  }

  /**
   * Validates all inputs for find_patterns tool
   */
  static validateFindPatternsArgs(args: unknown): {
    query: string;
    categories: string[];
    maxResults: number;
    programmingLanguage?: string;
  } {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: expected object');
    }
    const obj = args as Record<string, unknown>;
    const queryResult = this.validateSearchQuery(obj.query);
    this.throwIfInvalid(queryResult);

    const categoriesResult = this.validateCategories(obj.categories);
    this.throwIfInvalid(categoriesResult);

    const maxResultsResult = this.validateMaxResults(obj.maxResults);
    this.throwIfInvalid(maxResultsResult);

    const langResult = this.validateProgrammingLanguage(obj.programmingLanguage);
    this.throwIfInvalid(langResult);

    return {
      query: queryResult.sanitized as string,
      categories: (categoriesResult.sanitized as string[]) ?? [],
      maxResults: (maxResultsResult.sanitized as number) ?? 5,
      programmingLanguage: langResult.sanitized as string | undefined,
    };
  }

  /**
   * Validates all inputs for search_patterns tool
   */
  static validateSearchPatternsArgs(args: unknown): {
    query: string;
    searchType: string;
    limit: number;
  } {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: expected object');
    }
    const obj = args as Record<string, unknown>;
    const queryResult = this.validateSearchQuery(obj.query);
    this.throwIfInvalid(queryResult);

    const searchTypeResult = this.validateSearchType(obj.searchType);
    this.throwIfInvalid(searchTypeResult);

    const limitResult = this.validateLimit(obj.limit);
    this.throwIfInvalid(limitResult);

    return {
      query: queryResult.sanitized as string,
      searchType: (searchTypeResult.sanitized as string) ?? 'hybrid',
      limit: (limitResult.sanitized as number) ?? 10,
    };
  }

  /**
   * Validates all inputs for get_pattern_details tool
   */
  static validateGetPatternDetailsArgs(args: unknown): {
    patternId: string;
  } {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: expected object');
    }
    const obj = args as Record<string, unknown>;
    const patternIdResult = this.validatePatternId(obj.patternId);
    this.throwIfInvalid(patternIdResult);

    return {
      patternId: patternIdResult.sanitized as string,
    };
  }

  /**
   * Validates all inputs for count_patterns tool
   */
  static validateCountPatternsArgs(args: unknown): {
    includeDetails: boolean;
  } {
    if (typeof args !== 'object' || args === null) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: expected object');
    }
    const obj = args as Record<string, unknown>;
    const includeDetailsResult = this.validateIncludeDetails(obj.includeDetails);
    this.throwIfInvalid(includeDetailsResult);

    return {
      includeDetails: (includeDetailsResult.sanitized as boolean) ?? false,
    };
  }
}
