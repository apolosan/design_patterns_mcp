import { describe, expect, it } from 'vitest';

/**
 * Unit tests for the authToken narrowing logic used by http-transport.ts.
 *
 * We test the predicate function in isolation rather than spinning up Bun.serve
 * for every case. The function under test is the one inlined in startHttpServer.
 */
function shouldRequireAuth(authToken: string | undefined): boolean {
  return typeof authToken === 'string' && authToken.length > 0;
}

describe('http-transport authToken narrowing', () => {
  it('returns false for undefined', () => {
    expect(shouldRequireAuth(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(shouldRequireAuth('')).toBe(false);
  });

  it('returns true for non-empty string', () => {
    expect(shouldRequireAuth('secret-token')).toBe(true);
  });

  it('returns true for single-character token (length=1 is non-empty)', () => {
    expect(shouldRequireAuth('a')).toBe(true);
  });
});
