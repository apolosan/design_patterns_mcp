/**
 * GroupBy utilities for array operations
 */

export function groupBy<T>(
	array: readonly T[],
	keyFn: (value: T, index: number) => string
): Map<string, T[]> {
	const groups = new Map<string, T[]>();

	for (let i = 0; i < array.length; i++) {
		const item = array[i];
		const key = keyFn(item, i);

		const existing = groups.get(key);
		if (existing) {
			existing.push(item);
		} else {
			groups.set(key, [item]);
		}
	}

	return groups;
}

export function groupByKey<T extends Record<string, unknown>>(
	array: readonly T[],
	key: keyof T
): Map<string, T[]> {
	const groups = new Map<string, T[]>();

	for (const item of array) {
		const keyStr = String(item[key]);

		const existing = groups.get(keyStr);
		if (existing) {
			existing.push(item);
		} else {
			groups.set(keyStr, [item]);
		}
	}

	return groups;
}

export function groupByCount<T>(
	array: readonly T[],
	keyFn: (value: T, index: number) => string
): Map<string, number> {
	const counts = new Map<string, number>();

	for (let i = 0; i < array.length; i++) {
		const key = keyFn(array[i], i);
		const existing = counts.get(key);
		if (existing !== undefined) {
			counts.set(key, existing + 1);
		} else {
			counts.set(key, 1);
		}
	}

	return counts;
}

export function chunk<T>(array: readonly T[], size: number): T[][] {
	if (size <= 0) {
		throw new Error("Chunk size must be greater than 0");
	}

	if (array.length === 0) {
		return [];
	}

	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(Array.from(array.slice(i, i + size)));
	}

	return chunks;
}

export function countBy<T>(
	array: readonly T[],
	predicate: (value: T, index: number) => boolean
): number {
	let count = 0;

	for (let i = 0; i < array.length; i++) {
		if (predicate(array[i], i)) {
			count++;
		}
	}

	return count;
}

export function frequency<T>(array: readonly T[]): Map<string, number> {
	return groupByCount(array, (v) => String(v));
}

export function unique<T>(array: readonly T[]): T[] {
	const seen = new Set<T>();
	const result: T[] = [];

	for (const item of array) {
		if (!seen.has(item)) {
			seen.add(item);
			result.push(item);
		}
	}

	return result;
}

export function uniqueBy<T, K>(
	array: readonly T[],
	keyFn: (value: T) => K
): T[] {
	const seen = new Set<K>();
	const result: T[] = [];

	for (const item of array) {
		const key = keyFn(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}

	return result;
}
