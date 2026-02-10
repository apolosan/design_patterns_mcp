/**
 * Configuration Validator
 *
 * Validates environment variables and configuration settings
 * with type-safe access and comprehensive error reporting.
 */

export type ValidatorFn<T> = (value: unknown) => T;

export interface ValidationRule<T> {
  /**
   * Name of the configuration key
   */
  key: string;

  /**
   * Description of what this configuration controls
   */
  description: string;

  /**
   * Default value if not provided
   */
  defaultValue?: T;

  /**
   * Validator function to transform and validate the value
   */
  validator: ValidatorFn<T>;

  /**
   * Whether this configuration is required
   * @default false
   */
  required?: boolean;

  /**
   * Whether to trim string values
   * @default true
   */
  trim?: boolean;
}

export interface ValidationError {
  /**
   * The configuration key that failed validation
   */
  key: string;

  /**
   * User-friendly error message
   */
  message: string;

  /**
   * The invalid value that was provided
   */
  invalidValue: unknown;

  /**
   * Additional context about the error
   */
  context?: string;
}

export interface ConfigValidationResult<T> {
  /**
   * Whether validation succeeded
   */
  readonly isValid: boolean;

  /**
   * List of validation errors
   */
  readonly errors: ValidationError[];

  /**
   * Validated configuration values
   */
  readonly config: T;

  /**
   * Get a specific configuration value
   */
  get<K extends keyof T>(key: K): T[K];
}

export interface ConfigValidator<T> {
  /**
   * Validate configuration against defined rules
   */
  validate(): ConfigValidationResult<T>;

  /**
   * Get all validation errors without throwing
   */
  getErrors(): ValidationError[];

  /**
   * Check if configuration is valid without throwing
   */
  isValid(): boolean;
}

/**
 * Create a string validator with trimming
 *
 * @param options - Validator options
 */
export function stringValidator(options: {
  required?: boolean;
  trim?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
} = {}): ValidatorFn<string | undefined> {
  const required = options.required ?? false;
  const trim = options.trim ?? true;

  return (value: unknown): string | undefined => {
    if (value === undefined || value === null) {
      if (required) {
        throw new Error('Value is required');
      }
      return undefined;
    }

    let strValue = String(value);

    if (trim) {
      strValue = strValue.trim();
    }

    if (strValue === '') {
      if (required) {
        throw new Error('Value cannot be empty');
      }
      return undefined;
    }

    if (options.minLength !== undefined && strValue.length < options.minLength) {
      throw new Error(`Value must be at least ${options.minLength} characters`);
    }

    if (options.maxLength !== undefined && strValue.length > options.maxLength) {
      throw new Error(`Value must be at most ${options.maxLength} characters`);
    }

    if (options.pattern && !options.pattern.test(strValue)) {
      throw new Error('Value does not match required pattern');
    }

    return strValue;
  };
}

/**
 * Create a number validator with range checking
 *
 * @param options - Validator options
 */
export function numberValidator(options: {
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
} = {}): ValidatorFn<number | undefined> {
  const required = options.required ?? false;

  return (value: unknown): number | undefined => {
    if (value === undefined || value === null) {
      if (required) {
        throw new Error('Value is required');
      }
      return undefined;
    }

    const numValue = Number(value);

    if (isNaN(numValue)) {
      throw new Error('Value is not a valid number');
    }

    if (options.integer && !Number.isInteger(numValue)) {
      throw new Error('Value must be an integer');
    }

    if (options.min !== undefined && numValue < options.min) {
      throw new Error(`Value must be at least ${options.min}`);
    }

    if (options.max !== undefined && numValue > options.max) {
      throw new Error(`Value must be at most ${options.max}`);
    }

    return numValue;
  };
}

/**
 * Create a boolean validator
 *
 * @param options - Validator options
 */
export function booleanValidator(options: {
  required?: boolean;
  trueValues?: string[];
  falseValues?: string[];
} = {}): ValidatorFn<boolean | undefined> {
  const required = options.required ?? false;
  const trueValues = options.trueValues ?? ['true', '1', 'yes'];
  const falseValues = options.falseValues ?? ['false', '0', 'no'];

  return (value: unknown): boolean | undefined => {
    if (value === undefined || value === null) {
      if (required) {
        throw new Error('Value is required');
      }
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();

      if (trueValues.includes(lowerValue)) {
        return true;
      }

      if (falseValues.includes(lowerValue)) {
        return false;
      }
    }

    throw new Error(
      `Value must be one of: ${[...trueValues, ...falseValues].join(', ')}`
    );
  };
}

/**
 * Create a string array validator
 *
 * @param options - Validator options
 */
export function stringArrayValidator(options: {
  required?: boolean;
  delimiter?: string;
  minItems?: number;
  maxItems?: number;
  unique?: boolean;
} = {}): ValidatorFn<string[] | undefined> {
  const required = options.required ?? false;
  const delimiter = options.delimiter ?? ',';
  const unique = options.unique ?? false;

  return (value: unknown): string[] | undefined => {
    if (value === undefined || value === null) {
      if (required) {
        throw new Error('Value is required');
      }
      return undefined;
    }

    if (typeof value === 'string' && value.trim() === '') {
      if (required) {
        throw new Error('Value cannot be empty');
      }
      return [];
    }

    let arrayValue: unknown[];

    if (typeof value === 'string') {
      arrayValue = value.split(delimiter).map((item) => item.trim());
    } else if (Array.isArray(value)) {
      arrayValue = value;
    } else {
      throw new Error('Value must be a string or array');
    }

    if (arrayValue.length === 0) {
      if (required) {
        throw new Error('Value cannot be empty');
      }
      return [];
    }

    if (options.minItems !== undefined && arrayValue.length < options.minItems) {
      throw new Error(`Value must have at least ${options.minItems} items`);
    }

    if (options.maxItems !== undefined && arrayValue.length > options.maxItems) {
      throw new Error(`Value must have at most ${options.maxItems} items`);
    }

    const stringArray = arrayValue.map((item) => String(item).trim());

    if (unique && new Set(stringArray).size !== stringArray.length) {
      throw new Error('Value must contain unique items');
    }

    return stringArray;
  };
}

/**
 * Create a configuration validator instance
 *
 * @example
 * ```typescript
 * interface ServerConfig {
 *   PORT: number;
 *   HOST: string;
 *   LOG_LEVEL: string;
 *   ENABLE_METRICS: boolean;
 * }
 *
 * const validator = createConfigValidator<ServerConfig>({
 *   PORT: {
 *     key: 'PORT',
 *     description: 'Server port number',
 *     defaultValue: 3000,
 *     validator: numberValidator({ required: false, min: 1, max: 65535 }),
 *   },
 *   HOST: {
 *     key: 'HOST',
 *     description: 'Server host address',
 *     defaultValue: '0.0.0.0',
 *     validator: stringValidator({ required: false, minLength: 1 }),
 *   },
 *   LOG_LEVEL: {
 *     key: 'LOG_LEVEL',
 *     description: 'Logging level',
 *     defaultValue: 'info',
 *     validator: stringValidator({
 *       required: false,
 *       pattern: /^(debug|info|warn|error)$/,
 *     }),
 *   },
 *   ENABLE_METRICS: {
 *     key: 'ENABLE_METRICS',
 *     description: 'Whether to enable metrics collection',
 *     defaultValue: true,
 *     validator: booleanValidator({ required: false }),
 *   },
 * });
 *
 * const result = validator.validate();
 *
 * if (!result.isValid) {
 *   console.error('Configuration errors:', result.errors);
 *   process.exit(1);
 * }
 *
 * const config = result.config;
 * ```
 */
export function createConfigValidator<T extends Record<string, unknown>>(
  rules: Record<keyof T, ValidationRule<T[keyof T]>>
): ConfigValidator<T> {
  const configValues: Map<string, unknown> = new Map();

  const validateValue = <V>(
    rule: ValidationRule<V>,
    envValue: string | undefined
  ): V | undefined => {
    const rawValue = envValue ?? process.env[rule.key];

    if (rawValue === undefined) {
      if (rule.required) {
        throw new Error(`Missing required environment variable: ${rule.key}`);
      }
      return rule.defaultValue as V;
    }

    try {
      const validator = rule.validator as ValidatorFn<V>;
      return validator(rawValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Invalid value for ${rule.key}: ${message} (received: "${rawValue}")`
      );
    }
  };

  const buildResult = (errors: ValidationError[], config: T): ConfigValidationResult<T> => {
    return {
      get isValid() {
        return errors.length === 0;
      },
      get errors() {
        return errors;
      },
      get config() {
        return config;
      },
      get<K extends keyof T>(key: K): T[K] {
        return config[key];
      },
    };
  };

  return {
    validate(): ConfigValidationResult<T> {
      const errors: ValidationError[] = [];
      const config: T = {} as T;

      for (const key of Object.keys(rules) as (keyof T)[]) {
        const rule = rules[key];
        const envValue = process.env[rule.key];

        try {
          const value = validateValue(rule, envValue);
          (config as Record<string, unknown>)[key as string] = value;
          configValues.set(key as string, value);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          errors.push({
            key: rule.key,
            message,
            invalidValue: envValue ?? rule.defaultValue,
            context: rule.description,
          });
        }
      }

      return buildResult(errors, config);
    },

    getErrors(): ValidationError[] {
      const errors: ValidationError[] = [];

      for (const key of Object.keys(rules) as (keyof T)[]) {
        const rule = rules[key];
        const envValue = process.env[rule.key];

        try {
          validateValue(rule, envValue);
        } catch {
          errors.push({
            key: rule.key,
            message: `Invalid value for ${rule.key}`,
            invalidValue: envValue,
            context: rule.description,
          });
        }
      }

      return errors;
    },

    isValid(): boolean {
      return this.getErrors().length === 0;
    },
  };
}

/**
 * Predefined validation rules for common MCP server configuration
 */
export const mcpServerRules = {
  /**
   * Server port number
   */
  PORT: {
    key: 'PORT',
    description: 'Server port number',
    defaultValue: 3000,
    validator: numberValidator({ required: false, min: 1, max: 65535 }),
  },

  /**
   * Server host address
   */
  HOST: {
    key: 'HOST',
    description: 'Server host address',
    defaultValue: '0.0.0.0',
    validator: stringValidator({ required: false, minLength: 1 }),
  },

  /**
   * Logging level
   */
  LOG_LEVEL: {
    key: 'LOG_LEVEL',
    description: 'Logging level (debug, info, warn, error)',
    defaultValue: 'info',
    validator: stringValidator({
      required: false,
      pattern: /^(debug|info|warn|error)$/,
    }),
  },

  /**
   * Database path
   */
  DATABASE_PATH: {
    key: 'DATABASE_PATH',
    description: 'Path to SQLite database',
    defaultValue: './data/design-patterns.db',
    validator: stringValidator({ required: false, minLength: 1 }),
  },

  /**
   * Whether to enable hybrid search
   */
  ENABLE_HYBRID_SEARCH: {
    key: 'ENABLE_HYBRID_SEARCH',
    description: 'Enable hybrid search functionality',
    defaultValue: true,
    validator: booleanValidator({ required: false }),
  },

  /**
   * Whether to enable graph augmentation
   */
  ENABLE_GRAPH_AUGMENTATION: {
    key: 'ENABLE_GRAPH_AUGMENTATION',
    description: 'Enable graph-based pattern relationships',
    defaultValue: true,
    validator: booleanValidator({ required: false }),
  },

  /**
   * Whether to enable telemetry
   */
  ENABLE_TELEMETRY: {
    key: 'ENABLE_TELEMETRY',
    description: 'Enable performance telemetry',
    defaultValue: true,
    validator: booleanValidator({ required: false }),
  },

  /**
   * Maximum concurrent requests
   */
  MAX_CONCURRENT_REQUESTS: {
    key: 'MAX_CONCURRENT_REQUESTS',
    description: 'Maximum number of concurrent requests',
    defaultValue: 10,
    validator: numberValidator({ required: false, min: 1, max: 100 }),
  },

  /**
   * Cache maximum size
   */
  CACHE_MAX_SIZE: {
    key: 'CACHE_MAX_SIZE',
    description: 'Maximum number of items in cache',
    defaultValue: 1000,
    validator: numberValidator({ required: false, min: 1, max: 10000 }),
  },

  /**
   * Transport mode
   */
  TRANSPORT_MODE: {
    key: 'TRANSPORT_MODE',
    description: 'Transport mode (stdio, http)',
    defaultValue: 'stdio',
    validator: stringValidator({
      required: false,
      pattern: /^(stdio|http)$/,
    }),
  },
};
