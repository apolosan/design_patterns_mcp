import { isPlainObject } from './type-guards.js';

type DeepMergeStrategy = 'overwrite' | 'concat' | 'merge';

interface DeepMergeOptions {
  strategy?: DeepMergeStrategy;
  treatArraysAsObjects?: boolean;
  maxDepth?: number;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type DeepRequired<T> = {
  [P in keyof T]: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

function getType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return 'Date';
  if (value instanceof RegExp) return 'RegExp';
  if (value instanceof Error) return 'Error';
  if (value instanceof Set) return 'Set';
  if (value instanceof Map) return 'Map';
  if (value instanceof ArrayBuffer) return 'ArrayBuffer';
  if (
    value instanceof Uint8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint32Array ||
    value instanceof Int8Array ||
    value instanceof Int16Array ||
    value instanceof Int32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  ) {
    return 'TypedArray';
  }
  if (Array.isArray(value)) return 'Array';
  if (isPlainObject(value)) return 'Object';
  return typeof value;
}

function cloneValue(value: unknown, depth: number, maxDepth: number): unknown {
  if (depth > maxDepth) {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  const type = getType(value);

  if (type === 'Date') {
    return new Date((value as Date).getTime());
  }

  if (type === 'RegExp') {
    return new RegExp((value as RegExp).source, (value as RegExp).flags);
  }

  if (type === 'Error') {
    const err = value as Error;
    const error = new Error(err.message);
    error.name = err.name;
    error.stack = err.stack;
    return error;
  }

  if (type === 'Set') {
    const set = new Set<unknown>();
    (value as Set<unknown>).forEach((item) => {
      set.add(cloneValue(item, depth + 1, maxDepth));
    });
    return set;
  }

  if (type === 'Map') {
    const map = new Map<unknown, unknown>();
    (value as Map<unknown, unknown>).forEach((val, key) => {
      map.set(cloneValue(key, depth + 1, maxDepth), cloneValue(val, depth + 1, maxDepth));
    });
    return map;
  }

  if (type === 'ArrayBuffer' || type === 'TypedArray') {
    return (value as ArrayBuffer).slice();
  }

  if (type === 'Array') {
    return (value as unknown[]).map((item) => cloneValue(item, depth + 1, maxDepth));
  }

  if (type === 'Object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as object)) {
      result[key] = cloneValue(val, depth + 1, maxDepth);
    }
    return result;
  }

  return value;
}

export function deepMerge<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  target: T,
  source: U,
  options: DeepMergeOptions = {}
): T & U {
  const { strategy = 'overwrite', treatArraysAsObjects = false, maxDepth = 100 } = options;

  const result: Record<string, unknown> = { ...(cloneValue(target, 0, maxDepth) as Record<string, unknown>) };
  const sourceClone = cloneValue(source, 0, maxDepth) as Record<string, unknown>;

  for (const key of Object.keys(sourceClone)) {
    const targetValue = result[key];
    const sourceValue = sourceClone[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (targetValue === undefined || targetValue === null) {
      result[key] = sourceValue;
      continue;
    }

    const targetType = getType(targetValue);
    const sourceType = getType(sourceValue);

    if (targetType !== sourceType) {
      if (treatArraysAsObjects && targetType === 'Array' && sourceType === 'Object') {
        result[key] = sourceValue;
        continue;
      }
      if (treatArraysAsObjects && targetType === 'Object' && sourceType === 'Array') {
        result[key] = sourceValue;
        continue;
      }
      result[key] = sourceValue;
      continue;
    }

    if (targetType === 'Array' && sourceType === 'Array') {
      if (strategy === 'concat') {
        result[key] = [...(targetValue as unknown[]), ...(sourceValue as unknown[])];
      } else {
        result[key] = sourceValue;
      }
      continue;
    }

    if (targetType === 'Object' && sourceType === 'Object') {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        { strategy, treatArraysAsObjects, maxDepth: maxDepth - 1 }
      );
      continue;
    }

    result[key] = sourceValue;
  }

  return result as T & U;
}

export function deepMergeAll<T extends Record<string, unknown>>(
  objects: T[],
  options: DeepMergeOptions = {}
): T {
  if (objects.length === 0) {
    return {} as T;
  }

  let result: Record<string, unknown> = cloneValue(objects[0], 0, options.maxDepth ?? 100) as Record<string, unknown>;

  for (let i = 1; i < objects.length; i++) {
    result = deepMerge(result, objects[i], options);
  }

  return result as T;
}

function deepOmitInternal(
  obj: unknown,
  keysToOmit: Set<string>,
  depth: number,
  maxDepth: number
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (depth > maxDepth) {
    return obj;
  }

  const type = getType(obj);

  if (type === 'Array') {
    return (obj as unknown[]).map((item) => deepOmitInternal(item, keysToOmit, depth + 1, maxDepth));
  }

  if (type !== 'Object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as object)) {
    if (keysToOmit.has(key)) {
      continue;
    }

    result[key] = deepOmitInternal(value, keysToOmit, depth + 1, maxDepth);
  }

  return result;
}

export function deepOmit<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  keys: (keyof T)[]
): Omit<T, keyof T> | null | undefined {
  if (obj === null) {
    return null;
  }
  if (obj === undefined) {
    return undefined;
  }

  const keysToOmit = new Set(keys.map(String));
  return deepOmitInternal(obj, keysToOmit, 0, 100) as Omit<T, keyof T>;
}

function deepPickInternal(
  obj: unknown,
  keysToPick: Set<string>,
  currentPath: string[],
  depth: number,
  maxDepth: number
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (depth > maxDepth) {
    return obj;
  }

  const type = getType(obj);

  if (type === 'Array') {
    return (obj as unknown[]).map((item) => deepPickInternal(item, keysToPick, currentPath, depth + 1, maxDepth));
  }

  if (type !== 'Object') {
    return keysToPick.has(currentPath[currentPath.length - 1] ?? '') ? obj : {};
  }

  const result: Record<string, unknown> = {};
  const objRecord = obj as Record<string, unknown>;

  for (const [key, value] of Object.entries(objRecord)) {
    const newPath = [...currentPath, key];

    if (keysToPick.has(key)) {
      if (typeof value === 'object' && value !== null && getType(value) === 'Object') {
        result[key] = deepPickInternal(value, keysToPick, newPath, depth + 1, maxDepth);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      const picked = deepPickInternal(value, keysToPick, newPath, depth + 1, maxDepth);
      if (picked && typeof picked === 'object' && Object.keys(picked).length > 0) {
        result[key] = picked;
      }
    }
  }

  return result;
}

export function deepPick<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  keys: (keyof T)[]
): Pick<T, keyof T> | null | undefined {
  if (obj === null) {
    return null;
  }
  if (obj === undefined) {
    return undefined;
  }

  const keysToPick = new Set(keys.map(String));
  return deepPickInternal(obj, keysToPick, [], 0, 100) as Pick<T, keyof T>;
}

function deepFreezeInternal(
  obj: unknown,
  depth: number,
  maxDepth: number
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (depth > maxDepth) {
    return obj;
  }

  const type = getType(obj);

  if (type === 'Date') {
    Object.freeze(obj);
    return obj;
  }

  if (type === 'Set' || type === 'Map' || type === 'RegExp' || type === 'Error' || type === 'ArrayBuffer' || type === 'TypedArray') {
    return obj;
  }

  if (type === 'Array') {
    const arr = obj as unknown[];
    for (let i = 0; i < arr.length; i++) {
      arr[i] = deepFreezeInternal(arr[i], depth + 1, maxDepth);
    }
    Object.freeze(arr);
    return arr;
  }

  if (type === 'Object') {
    const keys = Object.getOwnPropertyNames(obj);

    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      if (value && typeof value === 'object') {
        (obj as Record<string, unknown>)[key] = deepFreezeInternal(value, depth + 1, maxDepth);
      }
    }

    Object.freeze(obj);
    return obj;
  }

  return obj;
}

export function deepFreeze<T extends object>(obj: T, options: { maxDepth?: number } = {}): DeepRequired<T> {
  const { maxDepth = 100 } = options;
  return deepFreezeInternal(obj, 0, maxDepth) as DeepRequired<T>;
}

export type { DeepMergeOptions, DeepPartial };
