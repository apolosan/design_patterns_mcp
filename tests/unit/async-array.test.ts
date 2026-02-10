/**
 * Async Array Utilities Tests
 */

import { describe, test, expect } from 'vitest';
import {
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
} from '../../src/utils/async-array.js';

describe('mapAsync', () => {
  test('should map array async', async () => {
    const result = await mapAsync([1, 2, 3], async (x) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  test('should handle empty array', async () => {
    const result = await mapAsync([], async (x) => x * 2);
    expect(result).toEqual([]);
  });
});

describe('filterAsync', () => {
  test('should filter array async', async () => {
    const result = await filterAsync([1, 2, 3, 4], async (x) => x > 2);
    expect(result).toEqual([3, 4]);
  });

  test('should handle empty array', async () => {
    const result = await filterAsync([], async (x) => x > 0);
    expect(result).toEqual([]);
  });
});

describe('reduceAsync', () => {
  test('should reduce array async', async () => {
    const result = await reduceAsync([1, 2, 3], async (acc, x) => acc + x, 0);
    expect(result).toBe(6);
  });

  test('should handle empty array with initial value', async () => {
    const result = await reduceAsync([], async (acc, x) => acc + x, 10);
    expect(result).toBe(10);
  });
});

describe('findAsync', () => {
  test('should find item async', async () => {
    const result = await findAsync([1, 2, 3], async (x) => x > 1);
    expect(result).toBe(2);
  });

  test('should return undefined when not found', async () => {
    const result = await findAsync([1, 2, 3], async (x) => x > 10);
    expect(result).toBeUndefined();
  });
});

describe('findIndexAsync', () => {
  test('should find index async', async () => {
    const result = await findIndexAsync([1, 2, 3], async (x) => x > 1);
    expect(result).toBe(1);
  });

  test('should return -1 when not found', async () => {
    const result = await findIndexAsync([1, 2, 3], async (x) => x > 10);
    expect(result).toBe(-1);
  });
});

describe('everyAsync', () => {
  test('should return true when all pass', async () => {
    const result = await everyAsync([2, 4, 6], async (x) => x % 2 === 0);
    expect(result).toBe(true);
  });

  test('should return false when some fail', async () => {
    const result = await everyAsync([1, 2, 3], async (x) => x % 2 === 0);
    expect(result).toBe(false);
  });
});

describe('someAsync', () => {
  test('should return true when some pass', async () => {
    const result = await someAsync([1, 2, 3], async (x) => x > 2);
    expect(result).toBe(true);
  });

  test('should return false when none pass', async () => {
    const result = await someAsync([1, 3, 5], async (x) => x % 2 === 0);
    expect(result).toBe(false);
  });
});

describe('flatMapAsync', () => {
  test('should flatMap array async', async () => {
    const result = await flatMapAsync([1, 2, 3], async (x) => [x, x * 2]);
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });
});

describe('forEachAsync', () => {
  test('should forEach array async', async () => {
    const items: number[] = [];
    await forEachAsync([1, 2, 3], async (x) => {
      items.push(x);
    });
    expect(items).toEqual([1, 2, 3]);
  });
});

describe('groupByAsync', () => {
  test('should groupBy array async', async () => {
    const result = await groupByAsync([1, 2, 3, 4], async (x) =>
      x % 2 === 0 ? 'even' : 'odd'
    );
    expect(result.get('even')).toEqual([2, 4]);
    expect(result.get('odd')).toEqual([1, 3]);
  });
});

describe('chunkAsync', () => {
  test('should chunk array async', async () => {
    const result = await chunkAsync([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('should handle size 0', async () => {
    const result = await chunkAsync([1, 2, 3], 0);
    expect(result).toEqual([]);
  });
});

describe('uniqueAsync', () => {
  test('should remove duplicates', async () => {
    const result = await uniqueAsync([1, 2, 2, 3, 3, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('should work with key function', async () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 1 }];
    const result = await uniqueAsync(items, async (x) => x.id);
    expect(result).toHaveLength(2);
  });
});
