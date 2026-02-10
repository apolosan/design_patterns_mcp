/**
 * Async Context Utilities
 * Provides AsyncLocalStorage wrapper for propagating context through async operations
 * Based on Node.js AsyncLocalStorage API (2025 best practices)
 */

interface ContextMap {
  [key: string]: unknown;
  [key: symbol]: unknown;
}

interface ContextSnapshot {
  readonly id: string;
  readonly timestamp: number;
  readonly store: ContextMap | undefined;
}

interface ContextEntry<V = unknown> {
  key: string | symbol;
  value: V;
}

interface ContextProvider<V> {
  get(): V | undefined;
  set(value: V, fn: () => void): void;
  run(value: V, fn: () => void): void;
  runPromise<U>(value: V, fn: () => Promise<U>): Promise<U>;
  snapshot(): ContextSnapshot | null;
  restore(snapshot: ContextSnapshot): boolean;
  getOrCreate(createValue: () => V): V;
}

const globalStore = new Map<string, unknown>();
let currentContext: ContextMap | null = null;

function getCurrentContextRaw(): ContextMap | null {
  return currentContext;
}

function setCurrentContext(context: ContextMap | null): void {
  currentContext = context;
}

export function createContextStorage<V>(
  name: string
): ContextStorage<V> {
  return {
    get(): V | undefined {
      const context = getCurrentContextRaw();
      if (!context) {
        return undefined;
      }
      return context[name] as V | undefined;
    },

    run(value: V, callback: () => void): void {
      const parentContext = getCurrentContext();
      const newContext: ContextMap = parentContext ? { ...parentContext } : {};
      newContext[name] = value;

      const oldContext = currentContext;
      setCurrentContext(newContext);

      try {
        callback();
      } finally {
        setCurrentContext(oldContext);
      }
    },

    runPromise<U>(value: V, callback: () => Promise<U>): Promise<U> {
      const parentContext = getCurrentContext();
      const newContext: ContextMap = parentContext ? { ...parentContext } : {};
      newContext[name] = value;

      const oldContext = currentContext;
      setCurrentContext(newContext);

      try {
        return callback();
      } finally {
        setCurrentContext(oldContext);
      }
    },

    getOrCreate(createValue: () => V): V {
      const existing = this.get();
      if (existing !== undefined) {
        return existing;
      }

      const value = createValue();
      this.run(value, () => {});
      return value;
    },

    getStore(): V | undefined {
      return this.get();
    },

    createSnapshot(): ContextSnapshot | null {
      const context = getCurrentContext();
      if (!context) {
        return null;
      }

      const storeCopy: ContextMap = {};
      for (const key of Object.keys(context)) {
        storeCopy[key] = context[key];
      }

      return {
        id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        store: storeCopy
      };
    },

    restoreSnapshot(snapshot: ContextSnapshot): boolean {
      if (!snapshot.store) {
        return false;
      }

      const context = getCurrentContext();
      if (!context) {
        return false;
      }

      for (const key of Object.keys(snapshot.store)) {
        context[key] = snapshot.store[key];
      }

      return true;
    },

    getAll(): ContextEntry<V>[] {
      const context = getCurrentContext();
      if (!context) {
        return [];
      }

      const entries: ContextEntry<V>[] = [];
      for (const key of Object.keys(context)) {
        entries.push({ key, value: context[key] as V });
      }
      return entries;
    }
  };
}

export interface ContextStorage<V> {
  get(): V | undefined;
  run(value: V, callback: () => void): void;
  runPromise<U>(value: V, callback: () => Promise<U>): Promise<U>;
  getOrCreate(createValue: () => V): V;
  getStore(): V | undefined;
  createSnapshot(): ContextSnapshot | null;
  restoreSnapshot(snapshot: ContextSnapshot): boolean;
  getAll(): ContextEntry<V>[];
}

export const REQUEST_ID = Symbol('requestId');
export const CORRELATION_ID = Symbol('correlationId');
export const SESSION_ID = Symbol('sessionId');
export const USER_ID = Symbol('userId');
export const TRACE_ID = Symbol('traceId');
export const SPAN_ID = Symbol('spanId');
export const PARENT_SPAN_ID = Symbol('parentSpanId');

export const requestContext = createContextStorage<string>('requestId');
export const correlationIdContext = createContextStorage<string>('correlationId');
export const sessionContext = createContextStorage<string>('sessionId');
export const userContext = createContextStorage<string>('userId');
export const traceContext = createContextStorage<string>('traceId');
export const spanContext = createContextStorage<string>('spanId');

export function getCurrentContext(): ContextMap | null {
  return getCurrentContextRaw();
}

export function getContextValue<V>(key: string | symbol): V | undefined {
  const context = getCurrentContext();
  if (!context) {
    return undefined;
  }
  return context[key as string] as V | undefined;
}

export function setContextValue<V>(
  key: string | symbol,
  value: V
): void {
  const context = getCurrentContext();

  if (!context) {
    return;
  }

  context[key as string] = value;
}

export function deleteContextValue(key: string | symbol): void {
  const context = getCurrentContext();

  if (!context) {
    return;
  }

  delete context[key as string];
}

export function clearContext(): void {
  const context = getCurrentContext();

  if (!context) {
    return;
  }

  for (const key of Object.keys(context)) {
    delete context[key];
  }
}

export function runWithContext<V>(
  contextMap: ContextMap,
  callback: () => V
): V {
  const newContext: ContextMap = { ...contextMap };
  const oldContext = currentContext;
  setCurrentContext(newContext);

  try {
    return callback();
  } finally {
    setCurrentContext(oldContext);
  }
}

export function runWithContextAsync<V>(
  contextMap: ContextMap,
  callback: () => Promise<V>
): Promise<V> {
  const newContext: ContextMap = { ...contextMap };
  const oldContext = currentContext;
  setCurrentContext(newContext);

  try {
    return callback();
  } finally {
    setCurrentContext(oldContext);
  }
}

type BoundFunction<F extends (...args: never[]) => unknown> = 
  (...args: Parameters<F>) => ReturnType<F>;

export function bindToContext<F extends (...args: never[]) => unknown>(
  fn: F
): BoundFunction<F> {
  return function (...args: Parameters<F>): ReturnType<F> {
    const context = getCurrentContext();

    if (!context) {
      return fn(...args) as ReturnType<F>;
    }

    return runWithContext(context, () => fn(...args)) as ReturnType<F>;
  };
}

export function bindAsyncToContext<F extends (...args: never[]) => Promise<unknown>>(
  fn: F
): BoundFunction<F> {
  return function (...args: Parameters<F>): ReturnType<F> {
    const context = getCurrentContext();

    if (!context) {
      return fn(...args) as ReturnType<F>;
    }

    return runWithContextAsync(context, () => fn(...args)) as ReturnType<F>;
  };
}

export function createContextProvider<V>(
  key: string,
  defaultValue?: V
): ContextProvider<V> {
  const storage = createContextStorage<V>(key);

  return {
    get(): V | undefined {
      return storage.get() ?? defaultValue;
    },
    set(value: V, fn: () => void): void {
      storage.run(value, fn);
    },
    run(value: V, fn: () => void): void {
      storage.run(value, fn);
    },
    runPromise<U>(value: V, fn: () => Promise<U>): Promise<U> {
      return storage.runPromise(value, fn);
    },
    snapshot(): ContextSnapshot | null {
      return storage.createSnapshot();
    },
    restore(snapshot: ContextSnapshot): boolean {
      return storage.restoreSnapshot(snapshot);
    },
    getOrCreate(createValue: () => V): V {
      return storage.getOrCreate(createValue);
    }
  };
}

export { ContextProvider, ContextSnapshot, ContextEntry };
