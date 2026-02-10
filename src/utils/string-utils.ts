/**
 * String Utilities - Common string manipulation utilities
 * 
 * Provides essential string operations: slugify, truncate, capitalize,
 * case conversions, and text transformations.
 */

/**
 * Options for truncate operation
 */
export interface TruncateOptions {
  length?: number;
  ellipsis?: string;
  position?: 'end' | 'middle' | 'start';
}

/**
 * Converts a string to a URL-friendly slug
 * 
 * @param str - String to convert
 * @returns URL-friendly slug string
 * 
 * @example
 * slugify('Hello World!');
 * // Returns: 'hello-world'
 * 
 * slugify('Café & Restaurant ★');
 * // Returns: 'cafe-and-restaurant'
 */
export function slugify(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncates a string to a specified length
 * 
 * @param str - String to truncate
 * @param options - Truncation options
 * @returns Truncated string with optional ellipsis
 * 
 * @example
 * truncate('Hello World', { length: 8 });
 * // Returns: 'Hello...'
 * 
 * truncate('Hello World', { length: 8, position: 'middle' });
 * // Returns: 'He...ld'
 */
export function truncate(
  str: string,
  options: TruncateOptions = {}
): string {
  if (!str) {
    return '';
  }

  const { length = 100, ellipsis = '...', position = 'end' } = options;

  if (str.length <= length) {
    return str;
  }

  const ellipsisLength = ellipsis.length;
  const maxLength = length - ellipsisLength;

  if (maxLength <= 0) {
    return ellipsis.substring(0, length);
  }

  switch (position) {
    case 'start':
      return ellipsis + str.slice(-maxLength);
    case 'middle':
      const halfLength = Math.floor(maxLength / 2);
      return (
        str.slice(0, halfLength) +
        ellipsis +
        str.slice(-(maxLength - halfLength))
      );
    case 'end':
    default:
      return str.slice(0, maxLength) + ellipsis;
  }
}

/**
 * Capitalizes the first letter of a string
 * 
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 * 
 * @example
 * capitalize('hello');
 * // Returns: 'Hello'
 * 
 * capitalize('world');
 * // Returns: 'World'
 */
export function capitalize(str: string): string {
  if (!str) {
    return '';
  }

  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converts a string to camelCase
 * 
 * @param str - String to convert
 * @returns camelCase string
 * 
 * @example
 * camelCase('hello-world');
 * // Returns: 'helloWorld'
 * 
 * camelCase('Hello World');
 * // Returns: 'helloWorld'
 */
export function camelCase(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, chr => chr.toLowerCase());
}

/**
 * Converts a string to kebab-case
 * 
 * @param str - String to convert
 * @returns kebab-case string
 * 
 * @example
 * kebabCase('helloWorld');
 * // Returns: 'hello-world'
 * 
 * kebabCase('Hello World');
 * // Returns: 'hello-world'
 */
export function kebabCase(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/**
 * Converts a string to snake_case
 * 
 * @param str - String to convert
 * @returns snake_case string
 * 
 * @example
 * snakeCase('helloWorld');
 * // Returns: 'hello_world'
 * 
 * snakeCase('Hello World');
 * // Returns: 'hello_world'
 */
export function snakeCase(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/**
 * Converts the first letter of a string to lowercase
 * 
 * @param str - String to uncapitalize
 * @returns String with first letter lowercase
 * 
 * @example
 * uncapitalize('Hello');
 * // Returns: 'hello'
 */
export function uncapitalize(str: string): string {
  if (!str) {
    return '';
  }

  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Repeats a string a specified number of times
 * 
 * @param str - String to repeat
 * @param count - Number of times to repeat
 * @returns Repeated string
 * 
 * @example
 * repeat('a', 3);
 * // Returns: 'aaa'
 */
export function repeat(str: string, count: number): string {
  if (count < 0) {
    throw new Error('Count must be a non-negative number');
  }

  return str.repeat(count);
}

/**
 * Pads a string on both sides to a specified length
 * 
 * @param str - String to pad
 * @param length - Target length
 * @param char - Character to pad with (default: space)
 * @returns Padded string
 * 
 * @example
 * pad('5', 3);
 * // Returns: ' 5 '
 * 
 * pad('5', 3, '0');
 * // Returns: '050'
 */
export function pad(str: string, length: number, char: string = ' '): string {
  if (length <= str.length) {
    return str;
  }

  if (str.length === 0) {
    return char.repeat(length);
  }

  const totalPadding = length - str.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;

  return char.repeat(leftPadding) + str + char.repeat(rightPadding);
}

/**
 * Pads a string on the left to a specified length
 * 
 * @param str - String to pad
 * @param length - Target length
 * @param char - Character to pad with (default: space)
 * @returns Left-padded string
 * 
 * @example
 * padLeft('5', 3, '0');
 * // Returns: '005'
 */
export function padLeft(str: string, length: number, char: string = ' '): string {
  if (length <= str.length) {
    return str;
  }

  return char.repeat(length - str.length) + str;
}

/**
 * Pads a string on the right to a specified length
 * 
 * @param str - String to pad
 * @param length - Target length
 * @param char - Character to pad with (default: space)
 * @returns Right-padded string
 * 
 * @example
 * padRight('5', 3, '0');
 * // Returns: '500'
 */
export function padRight(str: string, length: number, char: string = ' '): string {
  if (length <= str.length) {
    return str;
  }

  return str + char.repeat(length - str.length);
}

/**
 * Reverses a string
 * 
 * @param str - String to reverse
 * @returns Reversed string
 * 
 * @example
 * reverse('hello');
 * // Returns: 'olleh'
 */
export function reverse(str: string): string {
  if (!str) {
    return '';
  }

  return str.split('').reverse().join('');
}

/**
 * Counts the number of occurrences of a substring in a string
 * 
 * @param str - String to search
 * @param substr - Substring to count
 * @returns Number of occurrences
 * 
 * @example
 * countOccurrences('hello world', 'l');
 * // Returns: 3
 */
export function countOccurrences(str: string, substr: string): number {
  if (!str || !substr) {
    return 0;
  }

  let count = 0;
  let index = str.indexOf(substr);

  while (index !== -1) {
    count++;
    index = str.indexOf(substr, index + substr.length);
  }

  return count;
}

/**
 * Checks if a string starts with any of the given prefixes
 * 
 * @param str - String to check
 * @param prefixes - Array of prefixes to check
 * @returns true if string starts with any prefix
 * 
 * @example
 * startsWithAny('hello', ['he', 'wo']);
 * // Returns: true
 */
export function startsWithAny(
  str: string,
  prefixes: string[]
): boolean {
  if (!str || !prefixes || prefixes.length === 0) {
    return false;
  }

  return prefixes.some(prefix => str.startsWith(prefix));
}

/**
 * Checks if a string ends with any of the given suffixes
 * 
 * @param str - String to check
 * @param suffixes - Array of suffixes to check
 * @returns true if string ends with any suffix
 * 
 * @example
 * endsWithAny('hello', ['llo', 'world']);
 * // Returns: true
 */
export function endsWithAny(str: string, suffixes: string[]): boolean {
  if (!str || !suffixes || suffixes.length === 0) {
    return false;
  }

  return suffixes.some(suffix => str.endsWith(suffix));
}

/**
 * Wraps a string to a specified width
 * 
 * @param str - String to wrap
 * @param width - Maximum line width
 * @param breakChar - Character to use for line breaks
 * @returns Wrapped string
 * 
 * @example
 * wrap('hello world', 5);
 * // Returns: 'hello\\nworld'
 */
export function wrap(str: string, width: number, breakChar: string = '\n'): string {
  if (!str || width <= 0) {
    return str;
  }

  const words = str.split(/\s+/);
  let result = '';
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) {
        result += currentLine + breakChar;
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    result += currentLine;
  }

  return result;
}

/**
 * Escapes HTML special characters in a string
 * 
 * @param str - String to escape
 * @returns Escaped string safe for HTML
 * 
 * @example
 * escapeHtml('<div>Hello & World</div>');
 * // Returns: '&lt;div&gt;Hello &amp; World&lt;/div&gt;'
 */
export function escapeHtml(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Unescapes HTML entities in a string
 * 
 * @param str - String to unescape
 * @returns Unescaped string
 * 
 * @example
 * unescapeHtml('&lt;div&gt;Hello &amp; World&lt;/div&gt;');
 * // Returns: '<div>Hello & World</div>'
 */
export function unescapeHtml(str: string): string {
  if (!str) {
    return '';
  }

  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Extracts initials from a string
 * 
 * @param str - String to extract initials from
 * @param maxLength - Maximum number of initials to return
 * @returns Initials string
 * 
 * @example
 * initials('John Doe');
 * // Returns: 'JD'
 * 
 * initials('Johnathan Michael Doe', 2);
 * // Returns: 'JM'
 */
export function initials(str: string, maxLength: number = 2): string {
  if (!str) {
    return '';
  }

  return str
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join('');
}

/**
 * Converts a string to title case
 * 
 * @param str - String to convert
 * @returns Title case string
 * 
 * @example
 * titleCase('hello world');
 * // Returns: 'Hello World'
 */
export function titleCase(str: string): string {
  if (!str) {
    return '';
  }

  const smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by'];

  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (smallWords.includes(word) && index > 0) {
        return word;
      }
      return capitalize(word);
    })
    .join(' ');
}

/**
 * Removes all extra whitespace from a string
 * 
 * @param str - String to normalize
 * @returns String with single spaces and trimmed
 * 
 * @example
 * normalizeWhitespace('Hello    World');
 * // Returns: 'Hello World'
 */
export function normalizeWhitespace(str: string): string {
  if (!str) {
    return '';
  }

  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Checks if a string contains only ASCII characters
 * 
 * @param str - String to check
 * @returns true if string is ASCII only
 * 
 * @example
 * isAscii('Hello World');
 * // Returns: true
 * 
 * isAscii('Héllo');
 * // Returns: false
 */
export function isAscii(str: string): boolean {
  if (!str) {
    return true;
  }

  return /^[\x00-\x7F]*$/.test(str);
}

/**
 * Checks if a string is empty or contains only whitespace
 * 
 * @param str - String to check
 * @returns true if string is blank
 * 
 * @example
 * isBlank('');
 * // Returns: true
 * 
 * isBlank('   ');
 * // Returns: true
 * 
 * isBlank('hello');
 * // Returns: false
 */
export function isBlank(str: string): boolean {
  return !str || str.trim().length === 0;
}
