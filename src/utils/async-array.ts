/**
 * Async Array Utilities - Async operations for arrays
 *
 * Provides mapAsync, filterAsync, reduceAsync, and other async array operations.
 */

async function mapAsync<T, U>(
  array: T[],
  mapper: (item: T, index: number, array: T[]) => Promise<U>
): Promise<U[]> {
  const results: U[] = new Array(array.length);

  await Promise.all(
    array.map(async (item, index) => {
      results[index] = await mapper(item, index, array);
    })
  );

  return results;
}

async function filterAsync<T>(
  array: T[],
  predicate: (item: T, index: number, array: T[]) => Promise<boolean>
): Promise<T[]> {
  const results: T[] = [];

  await Promise.all(
    array.map(async (item, index) => {
      if (await predicate(item, index, array)) {
        results.push(item);
      }
    })
  );

  return results;
}

async function reduceAsync<T, U>(
  array: T[],
  reducer: (accumulator: U, item: T, index: number, array: T[]) => Promise<U>,
  initialValue: U
): Promise<U> {
  let accumulator = initialValue;

  for (let i = 0; i < array.length; i++) {
    accumulator = await reducer(accumulator, array[i], i, array);
  }

  return accumulator;
}

async function findAsync<T>(
  array: T[],
  predicate: (item: T, index: number, array: T[]) => Promise<boolean>
): Promise<T | undefined> {
  for (let i = 0; i < array.length; i++) {
    if (await predicate(array[i], i, array)) {
      return array[i];
    }
  }

  return undefined;
}

async function findIndexAsync<T>(
  array: T[],
  predicate: (item: T, index: number, array: T[]) => Promise<boolean>
): Promise<number> {
  for (let i = 0; i < array.length; i++) {
    if (await predicate(array[i], i, array)) {
      return i;
    }
  }

  return -1;
}

async function everyAsync<T>(
  array: T[],
  predicate: (item: T, index: number, array: T[]) => Promise<boolean>
): Promise<boolean> {
  for (let i = 0; i < array.length; i++) {
    if (!(await predicate(array[i], i, array))) {
      return false;
    }
  }

  return true;
}

async function someAsync<T>(
  array: T[],
  predicate: (item: T, index: number, array: T[]) => Promise<boolean>
): Promise<boolean> {
  for (let i = 0; i < array.length; i++) {
    if (await predicate(array[i], i, array)) {
      return true;
    }
  }

  return false;
}

async function flatMapAsync<T, U>(
  array: T[],
  mapper: (item: T, index: number, array: T[]) => Promise<U[]>
): Promise<U[]> {
  const results: U[] = [];

  await Promise.all(
    array.map(async (item, index) => {
      const mapped = await mapper(item, index, array);
      results.push(...mapped);
    })
  );

  return results;
}

async function forEachAsync<T>(
  array: T[],
  callback: (item: T, index: number, array: T[]) => Promise<void>
): Promise<void> {
  await Promise.all(
    array.map(async (item, index) => {
      await callback(item, index, array);
    })
  );
}

interface AsyncGroupByOptions<T> {
  key: (item: T) => Promise<string>;
}

async function groupByAsync<T>(
  array: T[],
  keyFn: (item: T) => Promise<string>
): Promise<Map<string, T[]>> {
  const groups = new Map<string, T[]>();

  await Promise.all(
    array.map(async (item) => {
      const key = await keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    })
  );

  return groups;
}

async function chunkAsync<T>(
  array: T[],
  size: number
): Promise<T[][]> {
  if (size <= 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

async function uniqueAsync<T>(
  array: T[],
  keyFn?: (item: T) => Promise<string | number>
): Promise<T[]> {
  if (!keyFn) {
    return Array.from(new Set(array));
  }

  const seen = new Set<string | number>();
  const results: T[] = [];

  await Promise.all(
    array.map(async (item) => {
      const key = await keyFn(item);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    })
  );

  return results;
}

async function sortAsync<T>(
  array: T[],
  compareFn: (a: T, b: T) => Promise<number>
): Promise<T[]> {
  const indexed = await Promise.all(
    array.map(async (item, index) => {
      return { item, index, keys: [await compareFn(item, item)] };
    })
  );

  indexed.sort((a, b) => {
    for (const keyA of a.keys) {
      for (const keyB of b.keys) {
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
      }
    }
    return a.index - b.index;
  });

  return indexed.map((entry) => entry.item);
}

export {
  mapAsync,
  filterAsync,
  reduceAsync,
  findAsync,
  findIndexAsync,
  everyAsync,
  someAsync,
  flatMapAsync,
  forEachAsync,
  groupByAsync,
  chunkAsync,
  uniqueAsync,
};
