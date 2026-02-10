/**
 * Correlation ID Generator for Distributed Tracing
 * Provides unique IDs for tracking requests across async boundaries
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationContext {
  id: string;
  parentId?: string;
  timestamp: number;
  metadata?: ReadonlyMap<string, string>;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `corr-${timestamp}-${randomPart}`;
}

export function generateChildCorrelationId(parentId: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `corr-${timestamp}-${randomPart}-${parentId.substring(parentId.lastIndexOf('-') + 1)}`;
}

export function getCurrentCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

export function getCurrentCorrelationId(): string | undefined {
  const context = getCurrentCorrelationContext();
  return context?.id;
}

export function getParentCorrelationId(): string | undefined {
  const context = getCurrentCorrelationContext();
  return context?.parentId;
}

export interface CorrelationScope {
  <T>(operation: () => Promise<T>): Promise<T>;
  <T>(operation: () => T): T;
}

export function createCorrelationScope(
  correlationId: string,
  metadata?: ReadonlyMap<string, string>
): CorrelationScope {
  return function correlationScope<T>(
    operation: () => Promise<T> | T
  ): Promise<T> | T {
    const parentContext = getCurrentCorrelationContext();
    const newContext: CorrelationContext = {
      id: correlationId,
      parentId: parentContext?.id,
      timestamp: Date.now(),
      metadata,
    };

    const isAsync = typeof operation === 'function' &&
      operation.constructor.name === 'AsyncFunction';

    if (isAsync) {
      return correlationStorage.run(newContext, () =>
        (operation as () => Promise<T>)()
      );
    }

    return correlationStorage.run(newContext, operation);
  };
}

export function withCorrelationId<T>(
  correlationId: string,
  operation: () => T
): T {
  const parentContext = getCurrentCorrelationContext();
  const newContext: CorrelationContext = {
    id: correlationId,
    parentId: parentContext?.id,
    timestamp: Date.now(),
  };

  return correlationStorage.run(newContext, operation);
}

export function withChildCorrelationId<T>(
  parentId: string,
  operation: () => T
): T {
  return withCorrelationId(generateChildCorrelationId(parentId), operation);
}

export function bindToCorrelation<T extends (...args: unknown[]) => unknown>(
  fn: T,
  correlationId?: string
): T {
  const id = correlationId ?? generateCorrelationId();

  function boundFn(this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const parentContext = getCurrentCorrelationContext();
    const newContext: CorrelationContext = {
      id,
      parentId: parentContext?.id,
      timestamp: Date.now(),
    };

    const isAsync = typeof fn === 'function' &&
      fn.constructor.name === 'AsyncFunction';

    if (isAsync) {
      return correlationStorage.run(newContext, () =>
        (fn as (...args: Parameters<T>) => Promise<ReturnType<T>>).apply(this, args)
      ) as ReturnType<T>;
    }

    return correlationStorage.run(newContext, () =>
      fn.apply(this, args)
    ) as ReturnType<T>;
  }

  return boundFn as T;
}

export function extractCorrelationFromHeaders(
  headers: Readonly<Record<string, string | undefined>>
): string | undefined {
  return headers['x-correlation-id'] ??
    headers['X-Correlation-ID'] ??
    headers['correlation-id'] ??
    headers['Correlation-ID'] ??
    headers['request-id'] ??
    headers['Request-ID'] ??
    headers['trace-id'] ??
    headers['Trace-ID'];
}

export function createCorrelationHeaders(
  correlationId?: string
): Record<string, string> {
  const id = correlationId ?? getCurrentCorrelationId() ?? generateCorrelationId();
  return {
    'x-correlation-id': id,
    'X-Correlation-ID': id,
    'request-id': id,
    'Request-ID': id,
    'trace-id': id,
    'Trace-ID': id,
  };
}

export function isValidCorrelationId(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  return /^corr-[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)?$/.test(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
