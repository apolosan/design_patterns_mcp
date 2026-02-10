/**
 * Advanced Math Utilities - Statistical and numeric operations
 *
 * Provides statistical functions, precision math, and number formatting
 * utilities not covered by basic range utilities.
 */

export interface PercentileOptions {
  /**
   * Interpolation method (default: linear)
   */
  interpolation?: 'linear' | 'lower' | 'higher' | 'midpoint' | 'nearest';
}

export interface FormatCompactOptions {
  /**
   * Number of decimal places (default: 1)
   */
  decimals?: number;

  /**
   * Locale for formatting (default: en-US)
   */
  locale?: string;
}

/**
 * Calculates the median of a number array
 *
 * @param array - Array of numbers
 * @returns Median value
 *
 * @example
 * median([1, 2, 3, 4, 5]);
 * // Returns: 3
 *
 * median([1, 2, 3, 4]);
 * // Returns: 2.5
 */
export function median(array: readonly number[]): number {
  if (array.length === 0) {
    throw new Error("Cannot calculate median of empty array");
  }

  const sorted = [...array].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculates the mode of a number array
 *
 * @param array - Array of numbers
 * @returns Array of most frequent values
 *
 * @example
 * mode([1, 2, 2, 3, 3, 3]);
 * // Returns: [3]
 *
 * mode([1, 2, 2, 3, 3]);
 * // Returns: [2, 3]
 */
export function mode(array: readonly number[]): number[] {
  if (array.length === 0) {
    throw new Error("Cannot calculate mode of empty array");
  }

  const frequency = new Map<number, number>();

  for (const num of array) {
    frequency.set(num, (frequency.get(num) ?? 0) + 1);
  }

  const maxFrequency = Math.max(...frequency.values());

  return [...frequency.entries()]
    .filter(([, freq]) => freq === maxFrequency)
    .map(([num]) => num);
}

/**
 * Calculates the standard deviation of a number array
 *
 * @param array - Array of numbers
 * @param options - Options for sample vs population
 * @returns Standard deviation
 *
 * @example
 * stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
 * // Returns: 2
 */
export function stdDev(
  array: readonly number[],
  options?: { sample?: boolean }
): number {
  if (array.length === 0) {
    throw new Error("Cannot calculate standard deviation of empty array");
  }

  const sample = options?.sample ?? false;
  const n = sample ? array.length - 1 : array.length;

  if (n <= 0) {
    throw new Error("Insufficient data points for calculation");
  }

  const avg = array.reduce((sum, val) => sum + val, 0) / array.length;
  const squaredDiffs = array.map(val => Math.pow(val - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / n;

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculates the variance of a number array
 *
 * @param array - Array of numbers
 * @param options - Options for sample vs population
 * @returns Variance
 *
 * @example
 * variance([2, 4, 4, 4, 5, 5, 7, 9]);
 * // Returns: 4
 */
export function variance(
  array: readonly number[],
  options?: { sample?: boolean }
): number {
  const sd = stdDev(array, options);
  return Math.pow(sd, 2);
}

/**
 * Calculates a specific percentile of a number array
 *
 * @param array - Array of numbers
 * @param percentile - Percentile to calculate (0-100)
 * @param options - Interpolation options
 * @returns Percentile value
 *
 * @example
 * percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50);
 * // Returns: 5.5
 */
export function percentile(
  array: readonly number[],
  percentile: number,
  options?: PercentileOptions
): number {
  if (array.length === 0) {
    throw new Error("Cannot calculate percentile of empty array");
  }

  if (percentile < 0 || percentile > 100) {
    throw new Error("Percentile must be between 0 and 100");
  }

  const sorted = [...array].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const interpolation = options?.interpolation ?? 'linear';

  switch (interpolation) {
    case 'lower':
      return sorted[lower];
    case 'higher':
      return sorted[upper];
    case 'midpoint':
      return (sorted[lower] + sorted[upper]) / 2;
    case 'nearest':
      return index - lower < 0.5 ? sorted[lower] : sorted[upper];
    case 'linear':
    default:
      const fraction = index - lower;
      return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
  }
}

/**
 * Calculates the greatest common divisor of two or more numbers
 *
 * @param numbers - Two or more numbers
 * @returns Greatest common divisor
 *
 * @example
 * gcd(48, 18);
 * // Returns: 6
 *
 * gcd(48, 18, 12);
 * // Returns: 6
 */
export function gcd(...numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("At least one number required");
  }

  if (numbers.length === 1) {
    return Math.abs(numbers[0]);
  }

  const validNumbers = numbers.map(n => {
    if (!Number.isInteger(n)) {
      throw new Error("GCD requires integer values");
    }
    return Math.abs(n);
  });

  const gcdTwo = (a: number, b: number): number => {
    return b === 0 ? a : gcdTwo(b, a % b);
  };

  return validNumbers.reduce((acc, num) => gcdTwo(acc, num));
}

/**
 * Calculates the least common multiple of two or more numbers
 *
 * @param numbers - Two or more numbers
 * @returns Least common multiple
 *
 * @example
 * lcm(4, 5);
 * // Returns: 20
 *
 * lcm(4, 5, 6);
 * // Returns: 60
 */
export function lcm(...numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("At least one number required");
  }

  if (numbers.length === 1) {
    return Math.abs(numbers[0]);
  }

  const validNumbers = numbers.map(n => {
    if (!Number.isInteger(n)) {
      throw new Error("LCM requires integer values");
    }
    return Math.abs(n);
  });

  const gcdTwo = (a: number, b: number): number => {
    return b === 0 ? a : gcdTwo(b, a % b);
  };

  const lcmTwo = (a: number, b: number): number => {
    return Math.abs((a * b) / gcdTwo(a, b));
  };

  return validNumbers.reduce((acc, num) => lcmTwo(acc, num));
}

/**
 * Rounds a number to a specific precision
 *
 * @param value - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 *
 * @example
 * roundPrecise(3.14159, 2);
 * // Returns: 3.14
 *
 * roundPrecise(3.14159, 4);
 * // Returns: 3.1416
 */
export function roundPrecise(value: number, decimals: number = 0): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot round non-finite number");
  }

  if (decimals < 0) {
    throw new Error("Decimals must be non-negative");
  }

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Formats a number in compact notation (K, M, B, T)
 *
 * @param value - Number to format
 * @param options - Formatting options
 * @returns Compact formatted string
 *
 * @example
 * formatCompact(1500);
 * // Returns: '1.5K'
 *
 * formatCompact(1500000);
 * // Returns: '1.5M'
 */
export function formatCompact(
  value: number,
  options?: FormatCompactOptions
): string {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot format non-finite number");
  }

  const absValue = Math.abs(value);
  const decimals = options?.decimals ?? 1;

  const thresholds: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
    [1, '']
  ];

  for (const [threshold, suffix] of thresholds) {
    if (absValue >= threshold) {
      const formatted = roundPrecise(absValue / threshold, decimals);
      const sign = value < 0 ? '-' : '';
      return `${sign}${formatted}${suffix}`;
    }
  }

  return value < 0 ? '-0' : '0';
}

/**
 * Calculates percentage of a value relative to a total
 *
 * @param value - The value
 * @param total - The total
 * @param decimals - Decimal places for result
 * @returns Percentage (0-100)
 *
 * @example
 * percentage(25, 100);
 * // Returns: 25
 *
 * percentage(1, 3);
 * // Returns: 33.3
 */
export function percentage(
  value: number,
  total: number,
  decimals: number = 1
): number {
  if (total === 0) {
    throw new Error("Total cannot be zero");
  }

  return roundPrecise((value / total) * 100, decimals);
}

/**
 * Maps a value from one range to another
 *
 * @param value - Value to map
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value
 *
 * @example
 * mapRange(0.5, 0, 1, 0, 100);
 * // Returns: 50
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (inMin === inMax) {
    throw new Error("Input range cannot have same min and max");
  }

  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Checks if a number is even
 *
 * @param value - Number to check
 * @returns True if even
 *
 * @example
 * isEven(4);
 * // Returns: true
 */
export function isEven(value: number): boolean {
  if (!Number.isInteger(value)) {
    throw new Error("isEven requires integer value");
  }

  return value % 2 === 0;
}

/**
 * Checks if a number is odd
 *
 * @param value - Number to check
 * @returns True if odd
 *
 * @example
 * isOdd(5);
 * // Returns: true
 */
export function isOdd(value: number): boolean {
  if (!Number.isInteger(value)) {
    throw new Error("isOdd requires integer value");
  }

  return value % 2 !== 0;
}

/**
 * Calculates the factorial of a non-negative integer
 *
 * @param value - Non-negative integer
 * @returns Factorial result
 *
 * @example
 * factorial(5);
 * // Returns: 120
 */
export function factorial(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error("Factorial requires integer value");
  }

  if (value < 0) {
    throw new Error("Factorial requires non-negative integer");
  }

  if (value > 170) {
    return Infinity;
  }

  let result = 1;

  for (let i = 2; i <= value; i++) {
    result *= i;
  }

  return result;
}

/**
 * Calculates the nth root of a number
 *
 * @param value - The number
 * @param root - The root degree (default: 2 for square root)
 * @returns nth root result
 *
 * @example
 * nthRoot(16, 2);
 * // Returns: 4
 */
export function nthRoot(value: number, root: number = 2): number {
  if (root <= 0) {
    throw new Error("Root must be positive");
  }

  if (value < 0 && root % 2 === 0) {
    throw new Error("Cannot calculate even root of negative number");
  }

  return Math.pow(Math.abs(value), 1 / root) * (value < 0 ? -1 : 1);
}

/**
 * Formats a number with thousands separators
 *
 * @param value - Number to format
 * @param locale - Locale for formatting
 * @returns Formatted string
 *
 * @example
 * formatNumber(1000000);
 * // Returns: '1,000,000'
 */
export function formatNumber(value: number, locale: string = 'en-US'): string {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot format non-finite number");
  }

  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Calculates the geometric mean of a number array
 *
 * @param array - Array of positive numbers
 * @returns Geometric mean
 *
 * @example
 * geometricMean([4, 9]);
 * // Returns: 6
 */
export function geometricMean(array: readonly number[]): number {
  if (array.length === 0) {
    throw new Error("Cannot calculate geometric mean of empty array");
  }

  const hasNegative = array.some(n => n <= 0);

  if (hasNegative) {
    throw new Error("Geometric mean requires positive numbers");
  }

  const product = array.reduce((prod, n) => prod * n, 1);
  return Math.pow(product, 1 / array.length);
}

/**
 * Calculates the harmonic mean of a number array
 *
 * @param array - Array of non-zero numbers
 * @returns Harmonic mean
 *
 * @example
 * harmonicMean([2, 4]);
 * // Returns: 2.67
 */
export function harmonicMean(array: readonly number[]): number {
  if (array.length === 0) {
    throw new Error("Cannot calculate harmonic mean of empty array");
  }

  const hasZero = array.some(n => n === 0);

  if (hasZero) {
    throw new Error("Harmonic mean requires non-zero numbers");
  }

  const sumReciprocals = array.reduce((sum, n) => sum + 1 / n, 0);
  return array.length / sumReciprocals;
}
