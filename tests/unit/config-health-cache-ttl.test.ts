import { describe, expect, it } from 'vitest';
import { MCPServerConfigBuilder } from '../../src/core/config-builder.js';

describe('MCPServerConfigBuilder.fromEnvironment — healthCacheTtlMs', () => {
  it('reads HEALTH_CACHE_TTL_MS env var as number', () => {
    const previous = process.env.HEALTH_CACHE_TTL_MS;
    process.env.HEALTH_CACHE_TTL_MS = '12345';
    try {
      const config = MCPServerConfigBuilder.fromEnvironment().build();
      expect(config.healthCacheTtlMs).toBe(12345);
    } finally {
      if (previous === undefined) delete process.env.HEALTH_CACHE_TTL_MS;
      else process.env.HEALTH_CACHE_TTL_MS = previous;
    }
  });

  it('uses default 5000 when env var is missing', () => {
    const previous = process.env.HEALTH_CACHE_TTL_MS;
    delete process.env.HEALTH_CACHE_TTL_MS;
    try {
      const config = MCPServerConfigBuilder.fromEnvironment().build();
      expect(config.healthCacheTtlMs).toBe(5000);
    } finally {
      if (previous !== undefined) process.env.HEALTH_CACHE_TTL_MS = previous;
    }
  });

  it('falls back to default when env var is non-numeric', () => {
    const previous = process.env.HEALTH_CACHE_TTL_MS;
    process.env.HEALTH_CACHE_TTL_MS = 'not-a-number';
    try {
      const config = MCPServerConfigBuilder.fromEnvironment().build();
      expect(typeof config.healthCacheTtlMs).toBe('number');
    } finally {
      if (previous === undefined) delete process.env.HEALTH_CACHE_TTL_MS;
      else process.env.HEALTH_CACHE_TTL_MS = previous;
    }
  });
});
