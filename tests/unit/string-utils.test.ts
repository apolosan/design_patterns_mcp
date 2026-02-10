/**
 * String Utilities Tests
 * 
 * Tests for slugify, truncate, capitalize, and other string utilities
 */

import { describe, test, expect } from 'vitest';
import {
  slugify,
  truncate,
  capitalize,
  camelCase,
  kebabCase,
  snakeCase,
  uncapitalize,
  repeat,
  pad,
  padLeft,
  padRight,
  reverse,
  countOccurrences,
  startsWithAny,
  endsWithAny,
  wrap,
  escapeHtml,
  unescapeHtml,
  initials,
  titleCase,
  normalizeWhitespace,
  isAscii,
  isBlank
} from '../../src/utils/string-utils.js';

describe('slugify', () => {
  test('should convert simple string to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('should remove special characters', () => {
    expect(slugify('Hello @#$% World')).toBe('hello-world');
  });

  test('should handle accented characters', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('Naïve')).toBe('naive');
  });

  test('should handle emojis', () => {
    expect(slugify('Hello ★ World')).toBe('hello-world');
  });

  test('should handle multiple spaces', () => {
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  test('should handle leading and trailing hyphens', () => {
    expect(slugify('-Hello World-')).toBe('hello-world');
  });

  test('should return empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  test('should handle unicode characters', () => {
    expect(slugify('日本')).toBe('');
    expect(slugify('Hello 日本 World')).toBe('hello-world');
  });

  test('should convert to lowercase', () => {
    expect(slugify('HELLO WORLD')).toBe('hello-world');
  });

  test('should handle underscores', () => {
    expect(slugify('hello_world')).toBe('hello-world');
  });
});

describe('truncate', () => {
  test('should truncate string with ellipsis at end', () => {
    expect(truncate('Hello World', { length: 8 })).toBe('Hello...');
  });

  test('should return original string if shorter than length', () => {
    expect(truncate('Hi', { length: 10 })).toBe('Hi');
  });

  test('should truncate at middle when specified', () => {
    expect(truncate('Hello World', { length: 8, position: 'middle' })).toBe('He...rld');
  });

  test('should truncate at start when specified', () => {
    expect(truncate('Hello World', { length: 8, position: 'start' })).toBe('...World');
  });

  test('should use custom ellipsis', () => {
    expect(truncate('Hello World', { length: 8, ellipsis: '***' })).toBe('Hello***');
  });

  test('should handle length smaller than ellipsis', () => {
    expect(truncate('Hello World', { length: 2, ellipsis: '...' })).toBe('..');
  });

  test('should handle empty string', () => {
    expect(truncate('', { length: 5 })).toBe('');
  });

  test('should handle length equal to string length', () => {
    expect(truncate('Hello', { length: 5 })).toBe('Hello');
  });

  test('should handle length of 0', () => {
    expect(truncate('Hello', { length: 0 })).toBe('');
  });
});

describe('capitalize', () => {
  test('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  test('should lowercase the rest', () => {
    expect(capitalize('HELLO')).toBe('Hello');
  });

  test('should handle single character', () => {
    expect(capitalize('h')).toBe('H');
  });

  test('should return empty string for empty input', () => {
    expect(capitalize('')).toBe('');
  });

  test('should handle already capitalized string', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  test('should handle mixed case', () => {
    expect(capitalize('hElLo')).toBe('Hello');
  });
});

describe('camelCase', () => {
  test('should convert kebab-case to camelCase', () => {
    expect(camelCase('hello-world')).toBe('helloWorld');
  });

  test('should convert snake_case to camelCase', () => {
    expect(camelCase('hello_world')).toBe('helloWorld');
  });

  test('should convert space separated to camelCase', () => {
    expect(camelCase('Hello World')).toBe('helloWorld');
  });

  test('should start with lowercase', () => {
    expect(camelCase('Hello')).toBe('hello');
  });

  test('should handle single word', () => {
    expect(camelCase('hello')).toBe('hello');
  });

  test('should handle empty string', () => {
    expect(camelCase('')).toBe('');
  });

  test('should handle multiple consecutive dashes', () => {
    expect(camelCase('hello--world')).toBe('helloWorld');
  });
});

describe('kebabCase', () => {
  test('should convert camelCase to kebab-case', () => {
    expect(kebabCase('helloWorld')).toBe('hello-world');
  });

  test('should convert snake_case to kebab-case', () => {
    expect(kebabCase('hello_world')).toBe('hello-world');
  });

  test('should convert to lowercase', () => {
    expect(kebabCase('HELLO WORLD')).toBe('hello-world');
  });

  test('should handle single word', () => {
    expect(kebabCase('hello')).toBe('hello');
  });

  test('should handle empty string', () => {
    expect(kebabCase('')).toBe('');
  });

  test('should handle spaces', () => {
    expect(kebabCase('Hello World')).toBe('hello-world');
  });
});

describe('snakeCase', () => {
  test('should convert camelCase to snake_case', () => {
    expect(snakeCase('helloWorld')).toBe('hello_world');
  });

  test('should convert kebab-case to snake_case', () => {
    expect(snakeCase('hello-world')).toBe('hello_world');
  });

  test('should convert to lowercase', () => {
    expect(snakeCase('HELLO WORLD')).toBe('hello_world');
  });

  test('should handle single word', () => {
    expect(snakeCase('hello')).toBe('hello');
  });

  test('should handle empty string', () => {
    expect(snakeCase('')).toBe('');
  });

  test('should handle spaces', () => {
    expect(snakeCase('Hello World')).toBe('hello_world');
  });
});

describe('uncapitalize', () => {
  test('should make first letter lowercase', () => {
    expect(uncapitalize('Hello')).toBe('hello');
  });

  test('should keep rest as is', () => {
    expect(uncapitalize('HELLO')).toBe('hELLO');
  });

  test('should handle single character', () => {
    expect(uncapitalize('H')).toBe('h');
  });

  test('should return empty string for empty input', () => {
    expect(uncapitalize('')).toBe('');
  });

  test('should handle already lowercase string', () => {
    expect(uncapitalize('hello')).toBe('hello');
  });
});

describe('repeat', () => {
  test('should repeat string', () => {
    expect(repeat('a', 3)).toBe('aaa');
  });

  test('should repeat empty string', () => {
    expect(repeat('', 5)).toBe('');
  });

  test('should return empty string for 0 count', () => {
    expect(repeat('hello', 0)).toBe('');
  });

  test('should throw for negative count', () => {
    expect(() => repeat('a', -1)).toThrow('Count must be a non-negative number');
  });

  test('should handle multi-character string', () => {
    expect(repeat('ab', 3)).toBe('ababab');
  });
});

describe('pad', () => {
  test('should pad string to specified length', () => {
    expect(pad('5', 3)).toBe(' 5 ');
  });

  test('should use custom padding character', () => {
    expect(pad('5', 3, '0')).toBe('050');
  });

  test('should return original if longer than length', () => {
    expect(pad('hello', 3)).toBe('hello');
  });

  test('should handle empty string', () => {
    expect(pad('', 3)).toBe('   ');
  });

  test('should handle odd length differences', () => {
    expect(pad('5', 4)).toBe(' 5  ');
  });

  test('should handle even length differences', () => {
    expect(pad('5', 5)).toBe('  5  ');
  });
});

describe('padLeft', () => {
  test('should pad left side', () => {
    expect(padLeft('5', 3, '0')).toBe('005');
  });

  test('should use space by default', () => {
    expect(padLeft('5', 3)).toBe('  5');
  });

  test('should return original if longer than length', () => {
    expect(padLeft('hello', 3)).toBe('hello');
  });
});

describe('padRight', () => {
  test('should pad right side', () => {
    expect(padRight('5', 3, '0')).toBe('500');
  });

  test('should use space by default', () => {
    expect(padRight('5', 3)).toBe('5  ');
  });

  test('should return original if longer than length', () => {
    expect(padRight('hello', 3)).toBe('hello');
  });
});

describe('reverse', () => {
  test('should reverse string', () => {
    expect(reverse('hello')).toBe('olleh');
  });

  test('should handle empty string', () => {
    expect(reverse('')).toBe('');
  });

  test('should handle single character', () => {
    expect(reverse('a')).toBe('a');
  });

  test('should reverse unicode characters', () => {
    expect(reverse('日本')).toBe('本日');
  });

});

describe('countOccurrences', () => {
  test('should count occurrences of substring', () => {
    expect(countOccurrences('hello world', 'l')).toBe(3);
  });

  test('should return 0 for no matches', () => {
    expect(countOccurrences('hello', 'z')).toBe(0);
  });

  test('should handle empty substring', () => {
    expect(countOccurrences('hello', '')).toBe(0);
  });

  test('should handle empty string', () => {
    expect(countOccurrences('', 'l')).toBe(0);
  });

  test('should count non-overlapping occurrences', () => {
    expect(countOccurrences('aaa', 'aa')).toBe(1);
  });

  test('should be case sensitive', () => {
    expect(countOccurrences('Hello hello', 'hello')).toBe(1);
  });
});

describe('startsWithAny', () => {
  test('should return true if starts with any prefix', () => {
    expect(startsWithAny('hello', ['he', 'wo'])).toBe(true);
  });

  test('should return false if starts with none', () => {
    expect(startsWithAny('hello', ['wo', 'xy'])).toBe(false);
  });

  test('should return false for empty prefixes', () => {
    expect(startsWithAny('hello', [])).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(startsWithAny('', ['he'])).toBe(false);
  });

  test('should return true for exact match', () => {
    expect(startsWithAny('hello', ['hello'])).toBe(true);
  });
});

describe('endsWithAny', () => {
  test('should return true if ends with any suffix', () => {
    expect(endsWithAny('hello', ['llo', 'world'])).toBe(true);
  });

  test('should return false if ends with none', () => {
    expect(endsWithAny('hello', ['wo', 'xy'])).toBe(false);
  });

  test('should return false for empty suffixes', () => {
    expect(endsWithAny('hello', [])).toBe(false);
  });

  test('should return false for empty string', () => {
    expect(endsWithAny('', ['llo'])).toBe(false);
  });

  test('should return true for exact match', () => {
    expect(endsWithAny('hello', ['hello'])).toBe(true);
  });
});

describe('wrap', () => {
  test('should wrap text at specified width', () => {
    expect(wrap('hello world', 5)).toBe('hello\nworld');
  });

  test('should handle strings shorter than width', () => {
    expect(wrap('hi', 5)).toBe('hi');
  });

  test('should use custom break character', () => {
    expect(wrap('hello world', 5, '|')).toBe('hello|world');
  });

  test('should handle empty string', () => {
    expect(wrap('', 5)).toBe('');
  });

  test('should handle width of 0', () => {
    expect(wrap('hello', 0)).toBe('hello');
  });

  test('should handle multiple words', () => {
    expect(wrap('the quick brown fox', 5)).toBe('the\nquick\nbrown\nfox');
  });
});

describe('escapeHtml', () => {
  test('should escape HTML entities', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  test('should escape ampersand', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  test('should escape quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  test('should handle mixed content', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  test('should return empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('unescapeHtml', () => {
  test('should unescape HTML entities', () => {
    expect(unescapeHtml('&lt;div&gt;')).toBe('<div>');
  });

  test('should unescape ampersand', () => {
    expect(unescapeHtml('A &amp; B')).toBe('A & B');
  });

  test('should unescape quotes', () => {
    expect(unescapeHtml('&quot;quoted&quot;')).toBe('"quoted"');
  });

  test('should handle mixed content', () => {
    expect(unescapeHtml('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')).toBe(
      '<script>alert("XSS")</script>'
    );
  });

  test('should return empty string for empty input', () => {
    expect(unescapeHtml('')).toBe('');
  });
});

describe('initials', () => {
  test('should extract initials from name', () => {
    expect(initials('John Doe')).toBe('JD');
  });

  test('should limit to maxLength', () => {
    expect(initials('Johnathan Michael Doe', 2)).toBe('JM');
  });

  test('should handle single word', () => {
    expect(initials('John')).toBe('J');
  });

  test('should handle empty string', () => {
    expect(initials('')).toBe('');
  });

  test('should handle multiple spaces', () => {
    expect(initials('John   Doe')).toBe('JD');
  });

  test('should use default maxLength of 2', () => {
    expect(initials('A B C D')).toBe('AB');
  });
});

describe('titleCase', () => {
  test('should convert to title case', () => {
    expect(titleCase('hello world')).toBe('Hello World');
  });


  test('should capitalize first word regardless', () => {
    expect(titleCase('the test')).toBe('The Test');
  });

  test('should handle empty string', () => {
    expect(titleCase('')).toBe('');
  });

  test('should handle single word', () => {
    expect(titleCase('hello')).toBe('Hello');
  });
});

describe('normalizeWhitespace', () => {
  test('should collapse multiple spaces', () => {
    expect(normalizeWhitespace('Hello    World')).toBe('Hello World');
  });

  test('should trim string', () => {
    expect(normalizeWhitespace('  Hello  ')).toBe('Hello');
  });

  test('should handle tabs and newlines', () => {
    expect(normalizeWhitespace('Hello\t\nWorld')).toBe('Hello World');
  });

  test('should return empty string for empty input', () => {
    expect(normalizeWhitespace('')).toBe('');
  });

  test('should handle only whitespace', () => {
    expect(normalizeWhitespace('   \t\n   ')).toBe('');
  });
});

describe('isAscii', () => {
  test('should return true for ASCII only', () => {
    expect(isAscii('Hello World')).toBe(true);
    expect(isAscii('123')).toBe(true);
    expect(isAscii('')).toBe(true);
  });

  test('should return false for non-ASCII', () => {
    expect(isAscii('Héllo')).toBe(false);
    expect(isAscii('日本')).toBe(false);
  });
});

describe('isBlank', () => {
  test('should return true for empty string', () => {
    expect(isBlank('')).toBe(true);
  });

  test('should return true for whitespace only', () => {
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('\t\n')).toBe(true);
  });

  test('should return false for non-empty string', () => {
    expect(isBlank('hello')).toBe(false);
    expect(isBlank(' hello ')).toBe(false);
  });

  test('should return true for null', () => {
    expect(isBlank(null as unknown as string)).toBe(true);
  });

  test('should return true for undefined', () => {
    expect(isBlank(undefined as unknown as string)).toBe(true);
  });
});
