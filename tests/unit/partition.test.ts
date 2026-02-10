import { describe, expect, test } from "vitest";
import {
	partition,
	partitionByKey,
	partitionByType,
	partitionStrings,
	partitionNumbers,
	partitionByRange,
} from "../../src/utils/partition.js";

describe("partition", () => {
	describe("partition (generic)", () => {
		test("splits array by predicate", () => {
			const numbers = [1, 2, 3, 4, 5, 6];
			const result = partition(numbers, (n) => n % 2 === 0);

			expect(result.matching).toEqual([2, 4, 6]);
			expect(result.nonMatching).toEqual([1, 3, 5]);
		});

		test("handles all matching", () => {
			const numbers = [2, 4, 6];
			const result = partition(numbers, (n) => n % 2 === 0);

			expect(result.matching).toEqual([2, 4, 6]);
			expect(result.nonMatching).toEqual([]);
		});

		test("handles none matching", () => {
			const numbers = [1, 3, 5];
			const result = partition(numbers, (n) => n % 2 === 0);

			expect(result.matching).toEqual([]);
			expect(result.nonMatching).toEqual([1, 3, 5]);
		});

		test("handles empty array", () => {
			const result = partition<number>([], (n) => n > 0);

			expect(result.matching).toEqual([]);
			expect(result.nonMatching).toEqual([]);
		});

		test("passes index to predicate", () => {
			const indices: number[] = [];
			partition([1, 2, 3], (_v, i) => {
				indices.push(i);
				return true;
			});

			expect(indices).toEqual([0, 1, 2]);
		});

		test("passes array to predicate", () => {
			let receivedArray: number[] = [];
			const original = [1, 2, 3];
			partition(original, (v, _i, arr) => {
				receivedArray = [...arr];
				return true;
			});

			expect(receivedArray).toEqual([1, 2, 3]);
		});

		test("works with string predicate", () => {
			const words = ["apple", "banana", "cherry", "date"];
			const result = partition(words, (w) => w.length > 5);

			expect(result.matching).toEqual(["banana", "cherry"]);
			expect(result.nonMatching).toEqual(["apple", "date"]);
		});

		test("works with object predicate", () => {
			type Item = { name: string; active: boolean };
			const items: Item[] = [
				{ name: "a", active: true },
				{ name: "b", active: false },
				{ name: "c", active: true },
			];
			const result = partition(items, (item) => item.active);

			expect(result.matching).toEqual([
				{ name: "a", active: true },
				{ name: "c", active: true },
			]);
			expect(result.nonMatching).toEqual([{ name: "b", active: false }]);
		});
	});

	describe("partitionByKey", () => {
		test("splits by key-value match", () => {
			type Item = { id: number; name: string };
			const items: Item[] = [
				{ id: 1, name: "a" },
				{ id: 2, name: "b" },
				{ id: 1, name: "c" },
				{ id: 3, name: "d" },
			];
			const result = partitionByKey(items, "id", 1);

			expect(result.matching).toEqual([
				{ id: 1, name: "a" },
				{ id: 1, name: "c" },
			]);
			expect(result.nonMatching).toEqual([
				{ id: 2, name: "b" },
				{ id: 3, name: "d" },
			]);
		});

		test("handles string keys", () => {
			type Item = { type: string; value: number };
			const items: Item[] = [
				{ type: "A", value: 1 },
				{ type: "B", value: 2 },
				{ type: "A", value: 3 },
			];
			const result = partitionByKey(items, "type", "A");

			expect(result.matching).toEqual([
				{ type: "A", value: 1 },
				{ type: "A", value: 3 },
			]);
			expect(result.nonMatching).toEqual([{ type: "B", value: 2 }]);
		});

		test("handles boolean keys", () => {
			type Item = { enabled: boolean; name: string };
			const items: Item[] = [
				{ enabled: true, name: "a" },
				{ enabled: false, name: "b" },
				{ enabled: true, name: "c" },
			];
			const result = partitionByKey(items, "enabled", true);

			expect(result.matching).toEqual([
				{ enabled: true, name: "a" },
				{ enabled: true, name: "c" },
			]);
			expect(result.nonMatching).toEqual([{ enabled: false, name: "b" }]);
		});
	});

	describe("partitionByType", () => {
		test("splits objects by type property", () => {
			type TypedItem = { type: string; value: number };
			const items: TypedItem[] = [
				{ type: "A", value: 1 },
				{ type: "B", value: 2 },
				{ type: "A", value: 3 },
				{ type: "C", value: 4 },
			];
			const result = partitionByType(items, "A");

			expect(result.matching).toEqual([
				{ type: "A", value: 1 },
				{ type: "A", value: 3 },
			]);
			expect(result.nonMatching).toEqual([
				{ type: "B", value: 2 },
				{ type: "C", value: 4 },
			]);
		});

		test("handles empty array", () => {
			const result = partitionByType<
				{ type: string; value: number }
			>([], "A");

			expect(result.matching).toEqual([]);
			expect(result.nonMatching).toEqual([]);
		});
	});

	describe("partitionStrings", () => {
		test("partitions by empty condition", () => {
			const strings = ["", "hello", "", "world", ""];
			const result = partitionStrings(strings, "empty");

			expect(result.matching).toEqual(["", "", ""]);
			expect(result.nonMatching).toEqual(["hello", "world"]);
		});

		test("partitions by nonEmpty condition", () => {
			const strings = ["", "hello", "", "world", "test"];
			const result = partitionStrings(strings, "nonEmpty");

			expect(result.matching).toEqual(["hello", "world", "test"]);
			expect(result.nonMatching).toEqual(["", ""]);
		});

		test("partitions by numeric condition", () => {
			const strings = ["123", "abc", "456", "12abc", ""];
			const result = partitionStrings(strings, "numeric");

			expect(result.matching).toEqual(["123", "456"]);
			expect(result.nonMatching).toEqual(["abc", "12abc", ""]);
		});

		test("partitions by alphabetic condition", () => {
			const strings = ["abc", "123", "hello", "a1b2", "world"];
			const result = partitionStrings(strings, "alphabetic");

			expect(result.matching).toEqual(["abc", "hello", "world"]);
			expect(result.nonMatching).toEqual(["123", "a1b2"]);
		});

		test("handles empty array", () => {
			const result = partitionStrings([], "nonEmpty");

			expect(result.matching).toEqual([]);
			expect(result.nonMatching).toEqual([]);
		});
	});

	describe("partitionNumbers", () => {
		test("partitions by positive condition", () => {
			const numbers = [-2, -1, 0, 1, 2, 3];
			const result = partitionNumbers(numbers, "positive");

			expect(result.matching).toEqual([1, 2, 3]);
			expect(result.nonMatching).toEqual([-2, -1, 0]);
		});

		test("partitions by negative condition", () => {
			const numbers = [-3, -2, -1, 0, 1, 2];
			const result = partitionNumbers(numbers, "negative");

			expect(result.matching).toEqual([-3, -2, -1]);
			expect(result.nonMatching).toEqual([0, 1, 2]);
		});

		test("partitions by zero condition", () => {
			const numbers = [-1, 0, 1, 0, 2];
			const result = partitionNumbers(numbers, "zero");

			expect(result.matching).toEqual([0, 0]);
			expect(result.nonMatching).toEqual([-1, 1, 2]);
		});

		test("partitions by even condition", () => {
			const numbers = [1, 2, 3, 4, 5, 6];
			const result = partitionNumbers(numbers, "even");

			expect(result.matching).toEqual([2, 4, 6]);
			expect(result.nonMatching).toEqual([1, 3, 5]);
		});

		test("partitions by odd condition", () => {
			const numbers = [1, 2, 3, 4, 5, 6];
			const result = partitionNumbers(numbers, "odd");

			expect(result.matching).toEqual([1, 3, 5]);
			expect(result.nonMatching).toEqual([2, 4, 6]);
		});

		test("handles empty array", () => {
			const result = partitionNumbers([], "positive");

			expect(result.matching).toEqual([]);
			expect(result.nonMatching).toEqual([]);
		});
	});

	describe("partitionByRange", () => {
		test("partitions with min and max", () => {
			const numbers = [1, 2, 3, 4, 5, 6, 7, 8];
			const result = partitionByRange(numbers, { min: 3, max: 6 });

			expect(result.matching).toEqual([3, 4, 5, 6]);
			expect(result.nonMatching).toEqual([1, 2, 7, 8]);
		});

		test("partitions with only min", () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = partitionByRange(numbers, { min: 3 });

			expect(result.matching).toEqual([3, 4, 5]);
			expect(result.nonMatching).toEqual([1, 2]);
		});

		test("partitions with only max", () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = partitionByRange(numbers, { max: 3 });

			expect(result.matching).toEqual([1, 2, 3]);
			expect(result.nonMatching).toEqual([4, 5]);
		});

		test("partitions with no constraints (all in range)", () => {
			const numbers = [1, 2, 3];
			const result = partitionByRange(numbers, {});

			expect(result.matching).toEqual([1, 2, 3]);
			expect(result.nonMatching).toEqual([]);
		});

		test("handles empty array", () => {
			const result = partitionByRange<number>([], { min: 1, max: 10 });

			expect(result.matching).toEqual([]);
			expect(result.nonMatching).toEqual([]);
		});

		test("handles boundary values", () => {
			const numbers = [1, 2, 3, 4, 5];
			const result = partitionByRange(numbers, { min: 3, max: 3 });

			expect(result.matching).toEqual([3]);
			expect(result.nonMatching).toEqual([1, 2, 4, 5]);
		});
	});

	describe("immutability", () => {
		test("does not modify original array", () => {
			const original: number[] = [1, 2, 3, 4, 5];
			partition(original, (n) => n % 2 === 0);

			expect(original).toEqual([1, 2, 3, 4, 5]);
		});
	});

	describe("type inference", () => {
		test("infers correct types from predicate", () => {
			const numbers: (number | null)[] = [1, null, 2, null, 3];
			const result = partition(numbers, (v): v is number => v !== null);

			expect(result.matching).toEqual([1, 2, 3]);
			expect(result.nonMatching).toEqual([null, null]);
		});
	});
});
