import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  createContextStorage,
  requestContext,
  correlationIdContext,
  sessionContext,
  userContext,
  traceContext,
  spanContext,
  bindToContext,
  bindAsyncToContext,
  createContextProvider
} from '../../src/utils/async-context.js';

describe('createContextStorage', () => {
  beforeEach(() => {
    clearContext();
  });

  afterEach(() => {
    clearContext();
  });

  test('should return undefined when no context exists', () => {
    const storage = createContextStorage<string>('test');
    expect(storage.get()).toBeUndefined();
  });

  test('should run callback with context value', () => {
    const storage = createContextStorage<string>('test');
    let capturedValue: string | undefined;

    storage.run('test-value', () => {
      capturedValue = storage.get();
    });

    expect(capturedValue).toBe('test-value');
  });

  test('should isolate contexts', () => {
    const storage1 = createContextStorage<string>('context1');
    const storage2 = createContextStorage<number>('context2');

    storage1.run('value1', () => {
      expect(storage1.get()).toBe('value1');
      expect(storage2.get()).toBeUndefined();

      storage2.run(42, () => {
        expect(storage1.get()).toBe('value1');
        expect(storage2.get()).toBe(42);
      });

      expect(storage2.get()).toBeUndefined();
    });

    expect(storage1.get()).toBeUndefined();
  });

  test('should restore context after run', () => {
    const storage = createContextStorage<string>('test');
    const outerValue = 'outer';

    storage.run(outerValue, () => {
      expect(storage.get()).toBe(outerValue);

      const innerValue = 'inner';
      storage.run(innerValue, () => {
        expect(storage.get()).toBe(innerValue);
      });

      expect(storage.get()).toBe(outerValue);
    });
  });

  test('should runPromise work with async operations', async () => {
    const storage = createContextStorage<string>('async');

    await storage.runPromise('async-value', async () => {
      expect(storage.get()).toBe('async-value');
    });
  });

  test('should getOrCreate create value if not exists', () => {
    const storage = createContextStorage<string>('auto');

    const value = storage.getOrCreate(() => 'created');

    expect(value).toBe('created');
  });

  test('should createSnapshot return valid snapshot', () => {
    const storage = createContextStorage<string>('snapshot');

    const snapshot = storage.createSnapshot();
    expect(snapshot).toBeNull();
  });
});

describe('Pre-defined Contexts', () => {
  beforeEach(() => {
    clearContext();
  });

  afterEach(() => {
    clearContext();
  });

  test('requestContext should store and retrieve request ID', () => {
    requestContext.run('req-123', () => {
      expect(requestContext.get()).toBe('req-123');
    });
  });

  test('correlationIdContext should store correlation ID', () => {
    correlationIdContext.run('corr-456', () => {
      expect(correlationIdContext.get()).toBe('corr-456');
    });
  });

  test('sessionContext should store session ID', () => {
    sessionContext.run('sess-789', () => {
      expect(sessionContext.get()).toBe('sess-789');
    });
  });

  test('userContext should store user ID', () => {
    userContext.run('user-abc', () => {
      expect(userContext.get()).toBe('user-abc');
    });
  });

  test('traceContext should store trace ID', () => {
    traceContext.run('trace-xyz', () => {
      expect(traceContext.get()).toBe('trace-xyz');
    });
  });

  test('spanContext should store span ID', () => {
    spanContext.run('span-001', () => {
      expect(spanContext.get()).toBe('span-001');
    });
  });
});

describe('bindToContext', () => {
  beforeEach(() => {
    clearContext();
  });

  afterEach(() => {
    clearContext();
  });

  test('should bind function to current context', () => {
    const storage = createContextStorage<string>('bound');

    storage.run('boundValue', () => {
      const fn = bindToContext(() => {
        return storage.get();
      });

      const result = fn();
      expect(result).toBe('boundValue');
    });
  });

  test('should preserve context across multiple calls', () => {
    const storage = createContextStorage<string>('persistent');

    storage.run('data', () => {
      const fn = bindToContext(() => {
        return storage.get();
      });

      expect(fn()).toBe('data');
      expect(fn()).toBe('data');
    });
  });
});

describe('createContextProvider', () => {
  beforeEach(() => {
    clearContext();
  });

  afterEach(() => {
    clearContext();
  });

  test('should run callback with context', () => {
    const provider = createContextProvider<string>('provider');

    let captured: string | undefined;
    provider.run('test', () => {
      captured = provider.get();
    });

    expect(captured).toBe('test');
  });

  test('should create context provider', () => {
    const provider = createContextProvider<string>('custom', 'default');

    provider.run('value', () => {
      expect(provider.get()).toBe('value');
    });
  });
});

function clearContext(): void {
  const storage = createContextStorage<unknown>('clear');
  storage.run({}, () => {});
}
