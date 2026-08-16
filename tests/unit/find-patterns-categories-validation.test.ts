/**
 * RED test for IMPROVEMENTS_03.md BUG-011.
 *
 * Bug: src/utils/input-validation.ts line 458 uses
 * `categoriesResult.sanitized as string[] ?? []` — a type-only cast
 * that bypasses TypeScript's structural check at the public boundary.
 * If validateCategories were ever changed to a payload containing
 * non-string elements (regression of the validateString per-item
 * contract), the cast would silently hide the runtime violation.
 *
 * Domain contract: the boundary MUST NOT contain an `as string[]` cast
 * for the categories field. Type narrowing must be explicit (an
 * `asserts v is string[]` predicate or an explicit narrowing function).
 *
 * Behavioural guard: non-string items are still rejected at runtime
 * via the per-item validateString call. This is asserted separately.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InputValidator } from '../../src/utils/input-validation.js';

describe('find_patterns categories validation (BUG-011)', () => {
  it('does NOT contain the unsafe "sanitized as string[]" cast at the boundary', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/utils/input-validation.ts'),
      'utf-8'
    );
    // Locate the boundary return for the categories field of
    // validateFindPatternsArgs and assert no cast.
    expect(source).not.toMatch(/sanitized as string\[\]/);
  });

  it('rejects categories containing non-string items at runtime', () => {
    expect(() =>
      InputValidator.validateFindPatternsArgs({
        query: 'factory',
        categories: ['valid', 123, 'also-valid'],
      })
    ).toThrow();
  });

  it('accepts valid string arrays', () => {
    const result = InputValidator.validateFindPatternsArgs({
      query: 'factory',
      categories: ['Creational', 'Gang of Four'],
    });
    expect(result.categories).toEqual(['Creational', 'Gang of Four']);
  });
});
