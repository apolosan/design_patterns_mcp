import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../..');

describe('runtime data hygiene', () => {
  it('does not contain accidental git metadata under data/.git', () => {
    expect(existsSync(path.join(projectRoot, 'data', '.git'))).toBe(false);
  });
});
