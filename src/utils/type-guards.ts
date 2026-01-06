/**
 * Type Guards and Runtime Type Checking Utilities
 * Provides comprehensive type guards for runtime safety
 */

/**
 * Type guard for checking if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for checking if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for checking if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for checking if a value is an array with specific item type
 */
export function isTypedArray<T>(value: unknown, itemGuard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}

/**
 * Type guard for Pattern objects
 */
export interface PatternData {
  id: string;
  name: string;
  category: string;
  description: string;
  complexity?: string;
  tags?: string[];
  when_to_use?: string[];
  benefits?: string[];
  drawbacks?: string[];
  use_cases?: string[];
}

export function isPatternData(value: unknown): value is PatternData {
  return isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.category) &&
    isString(value.description) &&
    (value.complexity === undefined || isString(value.complexity)) &&
    (value.tags === undefined || isTypedArray(value.tags, isString)) &&
    (value.when_to_use === undefined || isTypedArray(value.when_to_use, isString)) &&
    (value.benefits === undefined || isTypedArray(value.benefits, isString)) &&
    (value.drawbacks === undefined || isTypedArray(value.drawbacks, isString)) &&
    (value.use_cases === undefined || isTypedArray(value.use_cases, isString));
}

/**
 * Type guard for database row validation
 */
export function isDatabaseRow(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

/**
 * Type guard for SQL.js Database instance
 */
export function isSqlJsDatabase(value: unknown): boolean {
  return isObject(value) &&
    typeof value.exec === 'function' &&
    typeof value.prepare === 'function';
}

/**
 * Type guard for MCP CallToolResult
 */
export interface CallToolResultData {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export function isCallToolResult(value: unknown): value is CallToolResultData {
  return isObject(value) &&
    isTypedArray(value.content, (item): item is { type: 'text'; text: string } =>
      isObject(item) &&
      item.type === 'text' &&
      isString(item.text)
    ) &&
    (value.isError === undefined || isBoolean(value.isError));
}

/**
 * Safe type assertion with runtime checking
 */
export function assertType<T>(value: unknown, guard: (v: unknown) => v is T, errorMessage?: string): T {
  if (!guard(value)) {
    throw new Error(errorMessage ?? `Type assertion failed: expected ${guard.name}, got ${typeof value}`);
  }
  return value;
}

/**
 * Safe property access with type checking
 */
export function safeGet<T>(
  obj: unknown,
  key: string,
  guard: (v: unknown) => v is T,
  defaultValue?: T
): T | undefined {
  if (!isObject(obj)) {
    return defaultValue;
  }

  const value = obj[key];
  if (guard(value)) {
    return value;
  }

  return defaultValue;
}

/**
 * Safe array access with bounds checking
 */
export function safeArrayGet<T>(
  arr: unknown,
  index: number,
  guard: (v: unknown) => v is T,
  defaultValue?: T
): T | undefined {
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
    return defaultValue;
  }

  const value = arr[index] as T;
  if (guard(value)) {
    return value;
  }

  return defaultValue;
}

/**
 * Type guard for JSON-parsable strings
 */
export function isJsonString(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe JSON parsing with type validation
 */
export function safeJsonParse<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  defaultValue?: T
): T | undefined {
  if (!isString(value)) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(value) as T;
    if (guard(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore parsing errors
  }

  return defaultValue;
}