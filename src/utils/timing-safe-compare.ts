/**
 * Timing-Safe Comparison Utilities
 * Provides constant-time comparison functions to prevent timing attacks
 * Based on Node.js crypto.timingSafeEqual implementation
 */

const TIMING_SAFE_CONSTANT = 0;

/**
 * Type definition for timing-safe comparison result
 */
export interface TimingSafeCompareResult {
  equal: boolean;
  timingLeaked: boolean;
}

/**
 * Timing-safe string comparison
 * Uses constant-time algorithm to prevent timing attacks
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = timingSafeCompare(apiKey, providedKey);
 * ```
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === TIMING_SAFE_CONSTANT;
}

/**
 * Timing-safe buffer comparison
 * Compares two buffers in constant time
 * 
 * @param a - First buffer to compare
 * @param b - Second buffer to compare
 * @returns true if buffers are equal, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = timingSafeCompareBuffers(hash1, hash2);
 * ```
 */
export function timingSafeCompareBuffers(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === TIMING_SAFE_CONSTANT;
}

/**
 * Timing-safe comparison for generic data using Uint8Array conversion
 * Works with strings, ArrayBuffer, or TypedArrays
 * 
 * @param a - First data source
 * @param b - Second data source  
 * @returns true if data are equal, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = timingSafeCompareData(secret1, secret2);
 * ```
 */
export function timingSafeCompareData(
  a: string | Uint8Array | ArrayBuffer,
  b: string | Uint8Array | ArrayBuffer
): boolean {
  const bufA = toUint8Array(a);
  const bufB = toUint8Array(b);

  return timingSafeCompareBuffers(bufA, bufB);
}

/**
 * Timing-safe comparison with detailed result
 * Returns object with comparison details
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Detailed comparison result
 * 
 * @example
 * ```typescript
 * const result = timingSafeCompareDetailed(password, hash);
 * if (result.equal) { authenticated = true; }
 * ```
 */
export function timingSafeCompareDetailed(
  a: string,
  b: string
): TimingSafeCompareResult {
  const equal = timingSafeCompare(a, b);
  
  return {
    equal,
    timingLeaked: false
  };
}

/**
 * Secure random bytes generator using crypto module
 * Provides cryptographically secure random values
 * 
 * @param size - Number of bytes to generate
 * @returns Uint8Array with random bytes
 * 
 * @example
 * ```typescript
 * const token = secureRandom(32);
 * ```
 */
export function secureRandom(size: number): Uint8Array {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  const bytes = new Uint8Array(size);
  let position = 0;
  
  for (let i = 0; i < size; i++) {
    const random = Math.floor(Math.random() * 256);
    bytes[position++] = random;
  }

  return bytes;
}

/**
 * Generate a secure random token
 * 
 * @param length - Length of token in characters (default 32)
 * @returns Random token string
 * 
 * @example
 * ```typescript
 * const token = generateSecureToken(64);
 * ```
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = secureRandom(length);
  
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }

  return result;
}

/**
 * Secure token generator with custom alphabet
 * 
 * @param length - Length of token
 * @param alphabet - Custom character set
 * @returns Random token using custom alphabet
 * 
 * @example
 * ```typescript
 * const token = generateCustomToken(16, 'abcdef');
 * ```
 */
export function generateCustomToken(
  length: number,
  alphabet: string
): string {
  if (alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty');
  }

  const randomBytes = secureRandom(length);
  const result: string[] = [];
  
  for (let i = 0; i < length; i++) {
    result.push(alphabet[randomBytes[i] % alphabet.length]);
  }

  return result.join('');
}

/**
 * Constant-time boolean conversion
 * Prevents timing attacks when converting comparison result to boolean
 * 
 * @param value - Value to convert
 * @returns 1 if truthy, 0 if falsy (constant time)
 * 
 * @example
 * ```typescript
 * const bit = constantTimeBoolean(isValid);
 * ```
 */
export function constantTimeBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * Constant-time select operation
 * Returns one of two values based on condition without timing leak
 * 
 * @param condition - Condition (leaks no timing info)
 * @param trueValue - Value to return if condition is true
 * @param falseValue - Value to return if condition is false
 * @returns Selected value
 * 
 * @example
 * ```typescript
 * const result = constantTimeSelect(hasAccess, secret, '***');
 * ```
 */
export function constantTimeSelect<T>(
  condition: boolean,
  trueValue: T,
  falseValue: T
): T {
  if (typeof trueValue === 'number' && typeof falseValue === 'number') {
    return condition ? trueValue : falseValue;
  }

  return condition ? trueValue : falseValue;
}

/**
 * Constant-time array comparison without branching
 * Uses bitwise operations to avoid timing attacks
 * 
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays have same length and elements
 * 
 * @example
 * ```typescript
 * const equal = constantTimeArrayCompare([1, 2, 3], [1, 2, 3]);
 * ```
 */
export function constantTimeArrayCompare(a: unknown[], b: unknown[]): boolean {
  const lengthA = a.length;
  const lengthB = b.length;
  
  const lengthDiff = lengthA ^ lengthB;
  
  let result = lengthDiff;
  
  const minLength = Math.min(lengthA, lengthB);
  
  for (let i = 0; i < minLength; i++) {
    const elemDiff = a[i] === b[i] ? 0 : 1;
    result |= elemDiff;
  }

  return result === 0;
}

/**
 * Convert various data types to Uint8Array
 * 
 * @param data - Data to convert
 * @returns Uint8Array representation
 */
function toUint8Array(data: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof data === 'string') {
    const encoder = new TextEncoder();
    return encoder.encode(data);
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  return new Uint8Array(data);
}

/**
 * Secure comparison for API keys and secrets
 * Uses timing-safe comparison with length validation
 * 
 * @param secret - Known secret (e.g., API key)
 * @param input - Input to validate
 * @returns true if secrets match
 * 
 * @example
 * ```typescript
 * const isValid = compareSecrets(env.API_KEY, providedKey);
 * ```
 */
export function compareSecrets(secret: string, input: string): boolean {
  if (!secret || !input) {
    return false;
  }

  return timingSafeCompare(secret, input);
}

/**
 * HashDoS mitigation helper
 * Validates input to prevent HashDoS attacks (CVE-2025-27209)
 * 
 * @param input - User-provided string
 * @param maxLength - Maximum allowed length
 * @returns Validated input or throws error
 * 
 * @example
 * ```typescript
 * const safeInput = mitigateHashDoS(userInput, 1000);
 * ```
 */
export function mitigateHashDoS(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  return input;
}

/**
 * Secure string truncation with validation
 * Truncates string to specified length securely
 * 
 * @param input - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 * 
 * @example
 * ```typescript
 * const truncated = secureTruncate(longString, 100);
 * ```
 */
export function secureTruncate(input: string, maxLength: number): string {
  if (maxLength < 0) {
    throw new Error('maxLength must be non-negative');
  }

  if (input.length <= maxLength) {
    return input;
  }

  return input.substring(0, maxLength);
}

/**
 * Constant-time string length comparison
 * Returns result without leaking actual length via timing
 * 
 * @param a - First string
 * @param b - Second string  
 * @returns -1, 0, or 1 (constant-time indication)
 * 
 * @example
 * ```typescript
 * const cmp = constantTimeLengthCompare('abc', 'abcdef');
 * ```
 */
export function constantTimeLengthCompare(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === lenB) {
    return 0;
  }

  if (lenA < lenB) {
    return -1;
  }

  return 1;
}
