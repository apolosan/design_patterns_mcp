/**
 * Error Classification Utility
 * Automatically classifies errors into categories for better observability
 * Micro-utility: Smart error categorization with severity and retry hints
 */

/**
 * Categories for classifying errors based on their nature and origin
 */
export enum ErrorCategory {
  /** Input validation failures, malformed data, schema violations */
  VALIDATION = 'validation',
  /** Authentication failures, invalid credentials, expired tokens */
  AUTHENTICATION = 'authentication',
  /** Authorization failures, permission denied, role-based access */
  AUTHORIZATION = 'authorization',
  /** Resource not found, missing entities */
  NOT_FOUND = 'not_found',
  /** Rate limiting, quota exceeded, throttling */
  RATE_LIMIT = 'rate_limit',
  /** Operation timeouts, deadline exceeded */
  TIMEOUT = 'timeout',
  /** Circuit breaker open, service temporarily unavailable */
  CIRCUIT_BREAKER = 'circuit_breaker',
  /** Database errors, query failures, connection issues */
  DATABASE = 'database',
  /** Network connectivity issues, DNS failures */
  NETWORK = 'network',
  /** External service failures, upstream/downstream errors */
  EXTERNAL_SERVICE = 'external_service',
  /** Internal server errors, unexpected conditions */
  INTERNAL = 'internal',
  /** Uncategorized errors */
  UNKNOWN = 'unknown',
}

/**
 * Severity levels for prioritizing error response and alerting
 */
export enum ErrorSeverity {
  /** Critical - immediate attention required, potential system outage */
  CRITICAL = 'critical',
  /** High - significant impact, should be addressed soon */
  HIGH = 'high',
  /** Medium - moderate impact, planned remediation */
  MEDIUM = 'medium',
  /** Low - minor impact, can be addressed in regular maintenance */
  LOW = 'low',
  /** Info - informational, no immediate action needed */
  INFO = 'info',
}

/**
 * Classified error with actionable metadata for monitoring and alerting
 */
export interface ClassifiedError {
  /** Category this error was classified into */
  category: ErrorCategory;
  /** Assessed severity level */
  severity: ErrorSeverity;
  /** Error message (truncated to prevent log overflow) */
  message: string;
  /** Optional error code from the original error */
  code?: string;
  /** Whether the operation can be retried safely */
  isRetryable: boolean;
  /** Whether the error message can be shown to end users */
  isUserFacing: boolean;
  /** Suggested remediation action */
  suggestedAction?: string;
}

/**
 * Configuration for error classification behavior
 */
export interface ErrorClassificationConfig {
  /** Include stack trace in classification output */
  includeStackTrace: boolean;
  /** Include suggested remediation actions */
  includeSuggestions: boolean;
  /** Default category for unrecognized errors */
  defaultCategory: ErrorCategory;
  /** Default severity for unrecognized errors */
  defaultSeverity: ErrorSeverity;
}

/** Pattern definitions for automatic error classification */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  isUserFacing: boolean;
}> = [
  {
    pattern: /validation|invalid|malformed|parse|schema/i,
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    isRetryable: false,
    isUserFacing: true,
  },
  {
    pattern: /auth|unauthorized|credential|token|jwt|session/i,
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
    isRetryable: false,
    isUserFacing: true,
  },
  {
    pattern: /permission|forbidden|access.*denied|role/i,
    category: ErrorCategory.AUTHORIZATION,
    severity: ErrorSeverity.HIGH,
    isRetryable: false,
    isUserFacing: true,
  },
  {
    pattern: /not.*found|does.*not.*exist|missing|no.*such/i,
    category: ErrorCategory.NOT_FOUND,
    severity: ErrorSeverity.MEDIUM,
    isRetryable: false,
    isUserFacing: true,
  },
  {
    pattern: /rate.*limit|too.*many|throttle|quota/i,
    category: ErrorCategory.RATE_LIMIT,
    severity: ErrorSeverity.LOW,
    isRetryable: true,
    isUserFacing: true,
  },
  {
    pattern: /timeout|timed.*out|deadline/i,
    category: ErrorCategory.TIMEOUT,
    severity: ErrorSeverity.MEDIUM,
    isRetryable: true,
    isUserFacing: false,
  },
  {
    pattern: /circuit.*breaker|open.*circuit|breaker.*open/i,
    category: ErrorCategory.CIRCUIT_BREAKER,
    severity: ErrorSeverity.HIGH,
    isRetryable: true,
    isUserFacing: false,
  },
  {
    pattern: /sql|database|query|connection|transaction|rollback/i,
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.HIGH,
    isRetryable: true,
    isUserFacing: false,
  },
  {
    pattern: /network|dns|connection.*refused|econnreset|enet|etimedout/i,
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    isRetryable: true,
    isUserFacing: false,
  },
  {
    pattern: /external|upstream|downstream|3rd.*party|integration/i,
    category: ErrorCategory.EXTERNAL_SERVICE,
    severity: ErrorSeverity.MEDIUM,
    isRetryable: true,
    isUserFacing: false,
  },
  {
    pattern: /internal.*error|unexpected|null.*pointer|undefined|cannot|cannot.*read/i,
    category: ErrorCategory.INTERNAL,
    severity: ErrorSeverity.HIGH,
    isRetryable: false,
    isUserFacing: false,
  },
];

/** Suggested remediation actions per error category */
const ERROR_SUGGESTIONS: Record<ErrorCategory, string> = {
  [ErrorCategory.VALIDATION]: 'Check input parameters and ensure they meet the required format',
  [ErrorCategory.AUTHENTICATION]: 'Verify credentials and ensure authentication token is valid',
  [ErrorCategory.AUTHORIZATION]: 'Check user permissions and role assignments',
  [ErrorCategory.NOT_FOUND]: 'Verify the resource exists and the identifier is correct',
  [ErrorCategory.RATE_LIMIT]: 'Wait before retrying or implement exponential backoff',
  [ErrorCategory.TIMEOUT]: 'Retry with longer timeout or check service availability',
  [ErrorCategory.CIRCUIT_BREAKER]: 'Service is temporarily unavailable, retry later',
  [ErrorCategory.DATABASE]: 'Check database connectivity and query syntax',
  [ErrorCategory.NETWORK]: 'Check network connectivity and service endpoints',
  [ErrorCategory.EXTERNAL_SERVICE]: 'External service may be experiencing issues',
  [ErrorCategory.INTERNAL]: 'Contact support or check server logs',
  [ErrorCategory.UNKNOWN]: 'Review error details and contact support if persistent',
};

/**
 * Classifies errors into categories based on message patterns
 * Provides severity assessment and retry recommendations
 */
export class ErrorClassifier {
  private config: ErrorClassificationConfig;

  constructor(config?: Partial<ErrorClassificationConfig>) {
    this.config = {
      includeStackTrace: config?.includeStackTrace ?? false,
      includeSuggestions: config?.includeSuggestions ?? true,
      defaultCategory: config?.defaultCategory ?? ErrorCategory.UNKNOWN,
      defaultSeverity: config?.defaultSeverity ?? ErrorSeverity.MEDIUM,
    };
  }

  /**
   * Classify a single error into a structured format
   * @param error - Error object, string message, or unknown value
   * @returns Classified error with category, severity, and metadata
   */
  classify(error: Error | string | unknown): ClassifiedError {
    const message = this.extractMessage(error);
    const stack = this.extractStack(error);
    const code = this.extractCode(error);

    const patternMatch = this.findMatchingPattern(message);

    const result: ClassifiedError = {
      category: patternMatch.category,
      severity: patternMatch.severity,
      message: this.truncateMessage(message, 500),
      code,
      isRetryable: patternMatch.isRetryable,
      isUserFacing: patternMatch.isUserFacing,
    };

    if (this.config.includeSuggestions) {
      result.suggestedAction = ERROR_SUGGESTIONS[patternMatch.category];
    }

    return result;
  }

  /**
   * Classify multiple errors efficiently
   * @param errors - Array of errors to classify
   * @returns Array of classified errors
   */
  classifyMany(errors: Array<Error | string | unknown>): ClassifiedError[] {
    return errors.map(e => this.classify(e));
  }

  /**
   * Get counts of errors by category
   * @param errors - Array of errors to analyze
   * @returns Object mapping category to count
   */
  getCategoryCounts(errors: Array<Error | string | unknown>): Record<ErrorCategory, number> {
    const counts = {} as Record<ErrorCategory, number>;

    for (const error of errors) {
      const classified = this.classify(error);
      counts[classified.category] = (counts[classified.category] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * Find the most common error category
   * @param errors - Array of errors to analyze
   * @returns Category with highest count, or null if empty
   */
  getMostCommonCategory(errors: Array<Error | string | unknown>): {
    category: ErrorCategory;
    count: number;
  } | null {
    const counts = this.getCategoryCounts(errors);

    let maxCategory: ErrorCategory | null = null;
    let maxCount = 0;

    for (const [category, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxCategory = category as ErrorCategory;
      }
    }

    return maxCategory ? { category: maxCategory, count: maxCount } : null;
  }

  private findMatchingPattern(message: string): {
    category: ErrorCategory;
    severity: ErrorSeverity;
    isRetryable: boolean;
    isUserFacing: boolean;
  } {
    for (const patternDef of ERROR_PATTERNS) {
      if (patternDef.pattern.test(message)) {
        return {
          category: patternDef.category,
          severity: patternDef.severity,
          isRetryable: patternDef.isRetryable,
          isUserFacing: patternDef.isUserFacing,
        };
      }
    }

    return {
      category: this.config.defaultCategory,
      severity: this.config.defaultSeverity,
      isRetryable: false,
      isUserFacing: false,
    };
  }

  private extractMessage(error: Error | string | unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private extractStack(error: Error | string | unknown): string | undefined {
    if (error instanceof Error && this.config.includeStackTrace) {
      return error.stack;
    }
    return undefined;
  }

  private extractCode(error: Error | string | unknown): string | undefined {
    if (error instanceof Error && 'code' in error) {
      return (error as Error & { code?: string }).code;
    }
    return undefined;
  }

  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }
}

/** Global singleton instance for convenient error classification */
export const errorClassifier = new ErrorClassifier();
