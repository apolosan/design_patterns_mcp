/**
 * T11: Pattern matcher must not contain fuzzy code — RED test.
 * Asserts that src/services/pattern-matcher.ts does not reference the
 * fuzzy engine symbols (applyFuzzyRefinement, fuzzyInferenceEngine,
 * fuzzyDefuzzificationEngine) since the canonical fuzzy pipeline lives
 * in SearchMediator. Pattern-matcher is dead in production routing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('pattern-matcher.ts has no fuzzy code', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/services/pattern-matcher.ts'),
    'utf-8',
  );

  it('has no applyFuzzyRefinement method', () => {
    expect(src).not.toMatch(/applyFuzzyRefinement/);
  });

  it('has no fuzzyInferenceEngine import or field', () => {
    expect(src).not.toMatch(/fuzzyInferenceEngine|FuzzyInferenceEngine/);
  });

  it('has no fuzzyDefuzzificationEngine import or field', () => {
    expect(src).not.toMatch(/fuzzyDefuzzificationEngine|FuzzyDefuzzificationEngine/);
  });
});
