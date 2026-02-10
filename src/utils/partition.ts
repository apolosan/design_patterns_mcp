/**
 * Partition utility for splitting arrays into two groups based on a predicate
 */

export interface PartitionResult<T> {
	matching: T[];
	nonMatching: T[];
}

export function partition<T>(
	array: readonly T[],
	predicate: (value: T, index: number, array: readonly T[]) => boolean
): PartitionResult<T>;

export function partition<T>(
	array: T[],
	predicate: (value: T, index: number, array: readonly T[]) => boolean
): PartitionResult<T>;

export function partition<T>(
	array: readonly T[],
	predicate: (value: T, index: number, array: readonly T[]) => boolean
): PartitionResult<T> {
	const matching: T[] = [];
	const nonMatching: T[] = [];

	for (let i = 0; i < array.length; i++) {
		const value = array[i];
		if (predicate(value, i, array)) {
			matching.push(value);
		} else {
			nonMatching.push(value);
		}
	}

	return { matching, nonMatching };
}

export function partitionByKey<T, K extends keyof T>(
	array: readonly T[],
	key: K,
	value: T[K]
): PartitionResult<T>;

export function partitionByKey<T, K extends keyof T>(
	array: T[],
	key: K,
	value: T[K]
): PartitionResult<T>;

export function partitionByKey<T, K extends keyof T>(
	array: readonly T[],
	key: K,
	value: T[K]
): PartitionResult<T> {
	const matching: T[] = [];
	const nonMatching: T[] = [];

	for (const item of array) {
		if (item[key] === value) {
			matching.push(item);
		} else {
			nonMatching.push(item);
		}
	}

	return { matching, nonMatching };
}

export function partitionByType<T extends { type: string }>(
	array: readonly T[],
	type: string
): PartitionResult<T> {
	const matching: T[] = [];
	const nonMatching: T[] = [];

	for (const item of array) {
		if (item.type === type) {
			matching.push(item);
		} else {
			nonMatching.push(item);
		}
	}

	return { matching, nonMatching };
}

export function partitionStrings(
	array: readonly string[],
	condition: "empty" | "nonEmpty" | "numeric" | "alphabetic"
): PartitionResult<string> {
	const matching: string[] = [];
	const nonMatching: string[] = [];

	for (const value of array) {
		let shouldMatch = false;

		switch (condition) {
			case "empty":
				shouldMatch = value.length === 0;
				break;
			case "nonEmpty":
				shouldMatch = value.length > 0;
				break;
			case "numeric":
				shouldMatch = value.length > 0 && !isNaN(Number(value));
				break;
			case "alphabetic":
				shouldMatch = /^[a-zA-Z]+$/.test(value);
				break;
		}

		if (shouldMatch) {
			matching.push(value);
		} else {
			nonMatching.push(value);
		}
	}

	return { matching, nonMatching };
}

export function partitionNumbers(
	array: readonly number[],
	condition: "positive" | "negative" | "zero" | "even" | "odd"
): PartitionResult<number> {
	const matching: number[] = [];
	const nonMatching: number[] = [];

	for (const value of array) {
		let shouldMatch = false;

		switch (condition) {
			case "positive":
				shouldMatch = value > 0;
				break;
			case "negative":
				shouldMatch = value < 0;
				break;
			case "zero":
				shouldMatch = value === 0;
				break;
			case "even":
				shouldMatch = value % 2 === 0;
				break;
			case "odd":
				shouldMatch = value % 2 !== 0;
				break;
		}

		if (shouldMatch) {
			matching.push(value);
		} else {
			nonMatching.push(value);
		}
	}

	return { matching, nonMatching };
}

export function partitionByRange<T extends number>(
	array: readonly T[],
	range: { min?: T; max?: T }
): PartitionResult<T> {
	const matching: T[] = [];
	const nonMatching: T[] = [];

	for (const value of array) {
		const aboveMin = range.min === undefined || value >= range.min;
		const belowMax = range.max === undefined || value <= range.max;

		if (aboveMin && belowMax) {
			matching.push(value);
		} else {
			nonMatching.push(value);
		}
	}

	return { matching, nonMatching };
}
