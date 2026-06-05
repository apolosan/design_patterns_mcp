import { describe, expect, it } from 'vitest';
import { MCPServerConfigBuilder } from '../../src/core/config-builder.js';

describe('MCPServerConfigBuilder.fromEnvironment — httpPort=0 is rejected', () => {
  it('does not set httpPort when HTTP_PORT=0 (port-0 means random in Bun)', () => {
    const previous = process.env.HTTP_PORT;
    process.env.HTTP_PORT = '0';
    try {
      const config = MCPServerConfigBuilder.fromEnvironment().build();
      // httpPort should remain at the default (3000), not 0
      expect(config.httpPort).toBe(3000);
    } finally {
      if (previous === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = previous;
    }
  });

  it('accepts valid HTTP_PORT values', () => {
    const previous = process.env.HTTP_PORT;
    process.env.HTTP_PORT = '8080';
    try {
      const config = MCPServerConfigBuilder.fromEnvironment().build();
      expect(config.httpPort).toBe(8080);
    } finally {
      if (previous === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = previous;
    }
  });

  it('rejects negative HTTP_PORT', () => {
    const previous = process.env.HTTP_PORT;
    process.env.HTTP_PORT = '-1';
    try {
      const config = MCPServerConfigBuilder.fromEnvironment().build();
      expect(config.httpPort).not.toBe(-1);
    } finally {
      if (previous === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = previous;
    }
  });
});
