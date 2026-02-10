import { ZodError } from 'zod';

/**
 * Classification types for error analysis
 */
export enum ErrorClassification {
  CODE_BUG = 'CODE_BUG',
  USER_ERROR = 'USER_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Result of error classification analysis
 */
export interface ErrorAnalysisResult {
  classification: ErrorClassification;
  isCodeBug: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  shouldAlert: boolean;
  confidence: number;
  reasons: string[];
  suggestions: string[];
}

/**
 * Patterns that indicate a user error rather than a code bug
 */
const USER_ERROR_PATTERNS: RegExp[] = [
  /not found/i,
  /invalid (input|argument|parameter|value)/i,
  /missing (required field|parameter|argument)/i,
  /validation failed/i,
  /authentication required/i,
  /authorization denied/i,
  /permission denied/i,
  /rate limit exceeded/i,
  /too many requests/i,
  /resource already exists/i,
  /conflict/i,
  /bad request/i,
  /unprocessable entity/i,
  /not authorized/i,
  /forbidden/i,
  /access denied/i,
  /incorrect/i,
  /wrong/i,
  /invalid format/i,
  /malformed/i,
  /empty (result|value|data)/i,
  /not implemented/i,
  /deprecated/i,
  /unsupported/i,
  /timeout/i,
];

/**
 * Error codes that indicate user errors
 */
const USER_ERROR_CODES: string[] = [
  'VALIDATION_ERROR',
  'AUTH_ERROR',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'BAD_REQUEST',
  'CONFLICT',
  'RATE_LIMIT',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'INVALID_ARGUMENT',
  'MISSING_FIELD',
  'UNSUPPORTED',
  'DEPRECATED',
  'TIMEOUT',
];

/**
 * Error codes that indicate code bugs
 */
const CODE_BUG_CODES: string[] = [
  'INTERNAL_ERROR',
  'UNEXPECTED_ERROR',
  'NULL_POINTER',
  'UNDEFINED_VALUE',
  'TYPE_ERROR',
  'REFERENCE_ERROR',
  'SYNTAX_ERROR',
  'RANGE_ERROR',
  'URI_ERROR',
  'EVAL_ERROR',
  'CRITICAL_FAILURE',
  'SYSTEM_ERROR',
];

/**
 * External service error indicators
 */
const EXTERNAL_SERVICE_PATTERNS: RegExp[] = [
  /database (error|connection|failure)/i,
  /external service (error|failure|unavailable)/i,
  /third[- ]party (error|service)/i,
  /upstream (error|failure|service)/i,
  /downstream (error|failure|service)/i,
  /service (unavailable|unreachable|timed out)/i,
  /connection (refused|reset|timeout|timed out)/i,
  /network (error|partition|unreachable)/i,
  /socket (error|exception|timeout)/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /EHOSTUNREACH/i,
  /ENETUNREACH/i,
];

/**
 * HTTP status codes mapping
 */
const HTTP_STATUS_ERRORS: Map<number, ErrorClassification> = new Map([
  [400, ErrorClassification.USER_ERROR],
  [401, ErrorClassification.USER_ERROR],
  [403, ErrorClassification.USER_ERROR],
  [404, ErrorClassification.USER_ERROR],
  [409, ErrorClassification.USER_ERROR],
  [422, ErrorClassification.USER_ERROR],
  [429, ErrorClassification.RATE_LIMIT_ERROR],
  [500, ErrorClassification.CODE_BUG],
  [502, ErrorClassification.EXTERNAL_SERVICE],
  [503, ErrorClassification.EXTERNAL_SERVICE],
  [504, ErrorClassification.TIMEOUT_ERROR],
]);

/**
 * Checks if error message matches user error patterns
 */
function matchesUserErrorPattern(message: string): boolean {
  return USER_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Checks if error message indicates external service failure
 */
function matchesExternalServicePattern(message: string): boolean {
  return EXTERNAL_SERVICE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Determines severity based on classification
 */
function getDefaultSeverity(classification: ErrorClassification): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  switch (classification) {
    case ErrorClassification.CODE_BUG:
      return 'high';
    case ErrorClassification.EXTERNAL_SERVICE:
      return 'medium';
    case ErrorClassification.NETWORK_ERROR:
    case ErrorClassification.TIMEOUT_ERROR:
      return 'medium';
    case ErrorClassification.VALIDATION_ERROR:
    case ErrorClassification.PERMISSION_ERROR:
    case ErrorClassification.RATE_LIMIT_ERROR:
      return 'low';
    default:
      return 'info';
  }
}

/**
 * Checks if error is a Zod validation error
 */
function isZodError(error: unknown): error is ZodError<unknown> {
  return error instanceof ZodError ||
    (typeof error === 'object' && error !== null && 'issues' in error && Array.isArray((error as Record<string, unknown>).issues));
}

/**
 * Checks if error is a known error type with a code property
 */
function hasErrorCode(error: unknown): error is { code: string } {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string';
}

/**
 * Extracts error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const errorWithMessage = error as Record<string, unknown>;
    if ('message' in errorWithMessage && typeof errorWithMessage.message === 'string') {
      return errorWithMessage.message;
    }
    if ('reason' in errorWithMessage && typeof errorWithMessage.reason === 'string') {
      return errorWithMessage.reason;
    }
  }
  return String(error);
}

/**
 * Checks if error is a timeout error
 */
function isTimeoutError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('timeout') ||
    message.includes('timed out') ||
    (error instanceof Error && error.name === 'TimeoutError');
}

/**
 * Checks if error is a network-related error
 */
function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('network') ||
    message.includes('connection') ||
    message.includes('socket') ||
    message.includes('econn') ||
    message.includes('enet');
}

/**
 * Checks if error indicates permission/authorization issue
 */
function isPermissionError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('permission') ||
    message.includes('authorized') ||
    message.includes('forbidden') ||
    message.includes('access denied');
}

/**
 * Determines if error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429');
}

/**
 * Classifies an error and determines if it's a code bug
 *
 * @param error - The error to classify
 * @param context - Optional context about the operation
 * @returns Classification result with details
 *
 * @example
 * ```typescript
 * const result = isCodeBug(new Error('Database connection failed'));
 * console.log(result.classification); // 'EXTERNAL_SERVICE'
 * console.log(result.isCodeBug); // false
 * ```
 */
export function isCodeBug(
  error: unknown,
  context?: { operation?: string; layer?: string }
): ErrorAnalysisResult {
  const message = getErrorMessage(error);
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let classification = ErrorClassification.UNKNOWN;
  let confidence = 0.5;

  // Check for Zod validation errors first
  if (isZodError(error)) {
    classification = ErrorClassification.VALIDATION_ERROR;
    confidence = 0.95;
    reasons.push('Error is a Zod validation error');
    suggestions.push('Review input validation schemas');
    suggestions.push('Add proper validation at API boundaries');

    return {
      classification,
      isCodeBug: false,
      severity: 'low',
      shouldAlert: false,
      confidence,
      reasons,
      suggestions,
    };
  }

  // Check for timeout errors
  if (isTimeoutError(error)) {
    classification = ErrorClassification.TIMEOUT_ERROR;
    confidence = 0.85;
    reasons.push('Error indicates a timeout');
    suggestions.push('Review timeout configurations');
    suggestions.push('Check for performance bottlenecks');
    suggestions.push('Consider implementing retry logic');

    return {
      classification,
      isCodeBug: false,
      severity: getDefaultSeverity(classification),
      shouldAlert: false,
      confidence,
      reasons,
      suggestions,
    };
  }

  // Check for rate limit errors
  if (isRateLimitError(error)) {
    classification = ErrorClassification.RATE_LIMIT_ERROR;
    confidence = 0.9;
    reasons.push('Error indicates rate limiting');
    suggestions.push('Implement backoff strategy');
    suggestions.push('Review rate limit configuration');

    return {
      classification,
      isCodeBug: false,
      severity: 'low',
      shouldAlert: false,
      confidence,
      reasons,
      suggestions,
    };
  }

  // Check for permission errors
  if (isPermissionError(error)) {
    classification = ErrorClassification.PERMISSION_ERROR;
    confidence = 0.85;
    reasons.push('Error indicates permission/authorization issue');
    suggestions.push('Review user permissions');
    suggestions.push('Check API key/token validity');

    return {
      classification,
      isCodeBug: false,
      severity: 'low',
      shouldAlert: false,
      confidence,
      reasons,
      suggestions,
    };
  }

  // Check for network errors
  if (isNetworkError(error)) {
    classification = ErrorClassification.NETWORK_ERROR;
    confidence = 0.8;
    reasons.push('Error indicates network-related issue');
    suggestions.push('Check network connectivity');
    suggestions.push('Review firewall configurations');
    suggestions.push('Implement retry with exponential backoff');

    return {
      classification,
      isCodeBug: false,
      severity: getDefaultSeverity(classification),
      shouldAlert: true,
      confidence,
      reasons,
      suggestions,
    };
  }

  // Check for known error codes
  if (hasErrorCode(error)) {
    const code = (error as { code: string }).code;

    if (USER_ERROR_CODES.includes(code)) {
      classification = ErrorClassification.USER_ERROR;
      confidence = 0.9;
      reasons.push(`Error code '${code}' indicates user error`);
    } else if (CODE_BUG_CODES.includes(code)) {
      classification = ErrorClassification.CODE_BUG;
      confidence = 0.9;
      reasons.push(`Error code '${code}' indicates code bug`);
    } else if (code.includes('TIMEOUT')) {
      classification = ErrorClassification.TIMEOUT_ERROR;
      confidence = 0.85;
      reasons.push(`Error code '${code}' indicates timeout`);
    } else if (code.includes('NETWORK') || code.includes('CONNECTION')) {
      classification = ErrorClassification.NETWORK_ERROR;
      confidence = 0.85;
      reasons.push(`Error code '${code}' indicates network issue`);
    }
  }

  // If classification still unknown, check patterns
  if (classification === ErrorClassification.UNKNOWN) {
    if (matchesUserErrorPattern(message)) {
      classification = ErrorClassification.USER_ERROR;
      confidence = 0.7;
      reasons.push('Error message matches user error patterns');
    } else if (matchesExternalServicePattern(message)) {
      classification = ErrorClassification.EXTERNAL_SERVICE;
      confidence = 0.7;
      reasons.push('Error message indicates external service failure');
      suggestions.push('Check external service status');
      suggestions.push('Review dependency health');
    }
  }

  // Final classification based on heuristics
  if (classification === ErrorClassification.UNKNOWN) {
    // Default to code bug for unknown errors in production code
    classification = ErrorClassification.CODE_BUG;
    confidence = 0.5;
    reasons.push('Unknown error - defaulting to code bug classification');
    suggestions.push('Add specific error handling for this case');
  }

  // Determine if it's a code bug
  let isCodeBugResult = classification === ErrorClassification.CODE_BUG;

  // Determine if should alert
  let shouldAlert = isCodeBugResult;

  // Don't alert for user errors in high volume
  if (classification === ErrorClassification.USER_ERROR) {
    shouldAlert = false;
  }

  // Add context-based suggestions
  if (context?.operation) {
    suggestions.push(`Review ${context.operation} operation logic`);
  }
  if (context?.layer) {
    suggestions.push(`Check ${context.layer} layer implementation`);
  }

  return {
    classification,
    isCodeBug: isCodeBugResult,
    severity: getDefaultSeverity(classification),
    shouldAlert,
    confidence,
    reasons,
    suggestions: [...new Set(suggestions)], // Remove duplicates
  };
}

/**
 * Simplified version - just checks if error is a code bug
 *
 * @param error - The error to analyze
 * @returns true if the error is likely a code bug, false otherwise
 *
 * @example
 * ```typescript
 * if (isCodeBugSimple(error)) {
 *   alertEngineering(error);
 * }
 * ```
 */
export function isCodeBugSimple(error: unknown): boolean {
  const result = isCodeBug(error);
  return result.isCodeBug;
}

/**
 * Creates a filtered error message for user display
 * Removes sensitive information and internal details
 *
 * @param error - The error to sanitize
 * @returns Sanitized error message safe for user display
 */
export function sanitizeErrorForUser(error: unknown): string {
  const message = getErrorMessage(error);

  // Patterns that should be hidden from users
  const sensitivePatterns = [
    /password[:\s]*\S+/i,
    /token[:\s]*\S+/i,
    /api[_-]?key[:\s]*\S+/i,
    /secret[:\s]*\S+/i,
    /credential[s]?[:\s]*\S+/i,
    /connection[_-]?string[:\s]*\S+/i,
    /database[_-]?url[:\s]*\S+/i,
    /private[_-]?key[:\s]*\S+/i,
  ];

  let sanitized = message;

  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // Truncate stack traces
  if (sanitized.includes('at ')) {
    sanitized = sanitized.split('\n')[0];
  }

  return sanitized;
}

/**
 * Wraps a function to classify any errors it throws
 *
 * @param fn - The function to wrap
 * @param context - Optional context for error classification
 * @returns Wrapped function that classifies errors
 *
 * @example
 * ```typescript
 * const safeOperation = withErrorClassification(
 *   () => someRiskyOperation(),
 *   { operation: 'userSave' }
 * );
 * ```
 */
export function withErrorClassification<T, Args extends unknown[], R>(
  fn: (...args: Args) => R,
  context?: { operation?: string; layer?: string }
): (...args: Args) => R {
  return (...args: Args): R => {
    try {
      return fn(...args);
    } catch (error) {
      const result = isCodeBug(error, context);
      (error as { _classification?: ErrorClassification })._classification = result.classification;
      (error as { _isCodeBug?: boolean })._isCodeBug = result.isCodeBug;
      throw error;
    }
  };
}

/**
 * Async version of withErrorClassification
 */
export function withErrorClassificationAsync<T, Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  context?: { operation?: string; layer?: string }
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const result = isCodeBug(error, context);
      (error as { _classification?: ErrorClassification })._classification = result.classification;
      (error as { _isCodeBug?: boolean })._isCodeBug = result.isCodeBug;
      throw error;
    }
  };
}
