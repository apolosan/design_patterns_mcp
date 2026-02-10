/**
 * Range Utilities - Generate number ranges and sequences
 *
 * Provides utilities for generating numeric ranges, sequences,
 * and random number generation.
 */

/**
 * Options for range generation
 */
export interface RangeOptions {
  /**
   * Step between values (default: 1)
   */
  step?: number;

  /**
   * Whether to include end value (default: false)
   */
  inclusive?: boolean;
}

/**
 * Generates a range of numbers from start to end
 *
 * @param start - Starting value
 * @param end - Ending value
 * @param options - Optional configuration
 * @returns Array of numbers in the range
 *
 * @example
 * range(1, 5);
 * // Returns: [1, 2, 3, 4]
 *
 * range(0, 10, { step: 2 });
 * // Returns: [0, 2, 4, 6, 8]
 *
 * range(1, 5, { inclusive: true });
 * // Returns: [1, 2, 3, 4, 5]
 */
export function range(start: number, end: number, options?: RangeOptions): number[] {
  const step = Math.abs(options?.step ?? 1);
  const inclusive = options?.inclusive ?? false;

  if (step === 0) {
    throw new Error("Step cannot be zero");
  }

  const result: number[] = [];

  if (end >= start) {
    let current = start;
    const limit = inclusive ? end + step : end;

    while (current < limit) {
      result.push(current);
      current += step;
    }
  } else {
    let current = start;
    const limit = inclusive ? end - step : end;

    while (current > limit) {
      result.push(current);
      current -= step;
    }
  }

  return result;
}

/**
 * Generates a range from 0 to end
 *
 * @param end - Ending value
 * @param options - Optional configuration
 * @returns Array of numbers from 0 to end
 *
 * @example
 * rangeTo(5);
 * // Returns: [0, 1, 2, 3, 4]
 */
export function rangeTo(end: number, options?: RangeOptions): number[] {
  return range(0, end, options);
}

/**
 * Creates an array of a specific length with a mapper function
 *
 * @param length - Length of the array
 * @param mapper - Function to generate each element
 * @returns Array of generated values
 *
 * @example
 * times(5, i => i * 2);
 * // Returns: [0, 2, 4, 6, 8]
 */
export function times<T>(length: number, mapper: (index: number) => T): T[] {
  if (length < 0) {
    throw new Error("Length cannot be negative");
  }

  return Array.from({ length }, (_, i) => mapper(i));
}

/**
 * Generates random integer between min and max (inclusive)
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 *
 * @example
 * randomInt(1, 10);
 * // Returns: random number between 1 and 10
 */
export function randomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error("Min cannot be greater than max");
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates random float between min and max
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random float
 *
 * @example
 * randomFloat(0, 1);
 * // Returns: random number between 0 and 1
 */
export function randomFloat(min: number, max: number): number {
  if (min > max) {
    throw new Error("Min cannot be greater than max");
  }

  return Math.random() * (max - min) + min;
}

/**
 * Clamps a number between min and max values
 *
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 *
 * @example
 * clamp(5, 0, 10);
 * // Returns: 5
 *
 * clamp(-5, 0, 10);
 * // Returns: 0
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new Error("Min cannot be greater than max");
  }

  return Math.min(Math.max(value, min), max);
}

/**
 * Linearly interpolates between two values
 *
 * @param start - Starting value
 * @param end - Ending value
 * @param t - Interpolation factor (0 to 1)
 * @returns Interpolated value
 *
 * @example
 * lerp(0, 100, 0.5);
 * // Returns: 50
 */
export function lerp(start: number, end: number, t: number): number {
  if (t < 0 || t > 1) {
    throw new Error("Interpolation factor must be between 0 and 1");
  }

  return start + (end - start) * t;
}

/**
 * Generates a random element from an array
 *
 * @param array - Array to pick from
 * @returns Random element
 *
 * @example
 * randomPick(['a', 'b', 'c']);
 * // Returns: random element from array
 */
export function randomPick<T>(array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error("Cannot pick from empty array");
  }

  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 *
 * @param array - Array to shuffle
 * @returns Shuffled array
 *
 * @example
 * const arr = [1, 2, 3, 4, 5];
 * shuffle(arr);
 * // Returns: shuffled array
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/**
 * Generates a shuffled copy of an array
 *
 * @param array - Array to shuffle
 * @returns New shuffled array
 *
 * @example
 * const shuffled = shuffledCopy([1, 2, 3, 4, 5]);
 * // Returns: new shuffled array
 */
export function shuffledCopy<T>(array: readonly T[]): T[] {
  return shuffle([...array]);
}

/**
 * Checks if a number is within a range
 *
 * @param value - Value to check
 * @param min - Minimum value
 * @param max - Maximum value
 * @param options - Options for inclusive/exclusive
 * @returns True if value is in range
 *
 * @example
 * inRange(5, 1, 10);
 * // Returns: true
 */
export function inRange(
  value: number,
  min: number,
  max: number,
  options?: { inclusive?: boolean }
): boolean {
  if (min > max) {
    throw new Error("Min cannot be greater than max");
  }

  const inclusive = options?.inclusive ?? false;

  if (inclusive) {
    return value >= min && value <= max;
  }

  return value > min && value < max;
}

/**
 * Sums an array of numbers
 *
 * @param array - Array to sum
 * @returns Sum of all values
 *
 * @example
 * sum([1, 2, 3, 4, 5]);
 * // Returns: 15
 */
export function sum(array: readonly number[]): number {
  return array.reduce((acc, val) => acc + val, 0);
}

/**
 * Calculates the average of an array of numbers
 *
 * @param array - Array to average
 * @returns Average value
 *
 * @example
 * avg([1, 2, 3, 4, 5]);
 * // Returns: 3
 */
export function avg(array: readonly number[]): number {
  if (array.length === 0) {
    throw new Error("Cannot average empty array");
  }

  return sum(array) / array.length;
}
