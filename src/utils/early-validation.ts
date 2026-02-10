/**
 * Input Validation Layer for MCP Server
 * Provides early validation for search queries and tool arguments
 * Rejects invalid requests before processing to save resources
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SearchQueryValidation {
  query: string;
  minLength: number;
  maxLength: number;
  allowEmpty: boolean;
}

export interface ToolArgsValidation {
  toolName: string;
  requiredFields: string[];
  optionalFields: Record<string, { type: string; min?: number; max?: number; enum?: string[] }>;
}

/**
 * Early Input Validator
 * Provides fast validation before expensive operations
 */
export class EarlyInputValidator {
  private static readonly SEARCH_QUERY_MIN_LENGTH = 2;
  private static readonly SEARCH_QUERY_MAX_LENGTH = 500;
  private static readonly CODE_MIN_LENGTH = 10;
  private static readonly CODE_MAX_LENGTH = 50000;

  /**
   * Validate search query early
   */
  static validateSearchQuery(query: unknown): ValidationResult {
    if (typeof query !== 'string') {
      return { valid: false, error: 'Query must be a string' };
    }

    const q = query as string;
    if (q.length === 0 && !q.trim()) {
      return { valid: false, error: 'Query cannot be empty' };
    }

    if (q.length < this.SEARCH_QUERY_MIN_LENGTH) {
      return { valid: false, error: `Query must be at least ${this.SEARCH_QUERY_MIN_LENGTH} characters` };
    }

    if (q.length > this.SEARCH_QUERY_MAX_LENGTH) {
      return { valid: false, error: `Query must not exceed ${this.SEARCH_QUERY_MAX_LENGTH} characters` };
    }

    return { valid: true };
  }

  /**
   * Validate code context early
   */
  static validateCodeContext(code: unknown): ValidationResult {
    if (typeof code !== 'string') {
      return { valid: false, error: 'Code context must be a string' };
    }

    const c = code as string;
    if (c.length === 0) {
      return { valid: true };
    }

    if (c.length < this.CODE_MIN_LENGTH) {
      return { valid: false, error: `Code context must be at least ${this.CODE_MIN_LENGTH} characters` };
    }

    if (c.length > this.CODE_MAX_LENGTH) {
      return { valid: false, error: `Code context must not exceed ${this.CODE_MAX_LENGTH} characters` };
    }

    return { valid: true };
  }

  /**
   * Validate tool arguments early
   */
  static validateToolArgs(args: unknown, _toolName: string, requiredFields: string[]): ValidationResult {
    if (typeof args !== 'object' || args === null) {
      return { valid: false, error: 'Arguments must be an object' };
    }

    const a = args as Record<string, unknown>;

    for (const field of requiredFields) {
      if (!(field in a) || a[field] === null || a[field] === undefined) {
        return { valid: false, error: `Required field '${field}' is missing` };
      }
    }

    return { valid: true };
  }

  /**
   * Validate limit parameter
   */
  static validateLimit(limit: unknown, defaultMax = 50): ValidationResult {
    if (limit === undefined || limit === null) {
      return { valid: true };
    }

    if (typeof limit !== 'number') {
      return { valid: false, error: 'Limit must be a number' };
    }

    const l = limit as number;
    if (!Number.isInteger(l) || l < 1) {
      return { valid: false, error: 'Limit must be a positive integer' };
    }

    if (l > defaultMax) {
      return { valid: false, error: `Limit cannot exceed ${defaultMax}` };
    }

    return { valid: true };
  }

  /**
   * Validate category parameter
   */
  static validateCategory(category: unknown, validCategories: string[]): ValidationResult {
    if (category === undefined || category === null) {
      return { valid: true };
    }

    if (typeof category !== 'string') {
      return { valid: false, error: 'Category must be a string' };
    }

    if (!validCategories.includes(category as string)) {
      return { valid: false, error: `Invalid category. Valid categories: ${validCategories.join(', ')}` };
    }

    return { valid: true };
  }
}
