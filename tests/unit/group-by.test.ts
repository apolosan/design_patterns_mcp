import { describe, expect, test } from "vitest";
import {
	groupBy,
	groupByKey,
	groupByCount,
	chunk,
	countBy,
	frequency,
	unique,
	uniqueBy,
} from "../../src/utils/group-by.js";

describe("groupBy", () => {
	test("groups elements by function", () => {
		const items = [
			{ name: "a", category: "cat1" },
			{ name: "b", category: "cat2" },
			{ name: "c", category: "cat1" },
		];
		const result = groupBy(items, (item) => item.category);

		expect(result.get("cat1")?.length).toBe(2);
		expect(result.get("cat2")?.length).toBe(1);
	});

	test("groups numbers by parity", () => {
		const numbers = [1, 2, 3, 4, 5, 6];
		const result = groupBy(numbers, (n) => (n % 2 === 0 ? "even" : "odd"));

		expect(result.get("even")).toEqual([2, 4, 6]);
		expect(result.get("odd")).toEqual([1, 3, 5]);
	});
});

describe("groupByKey", () => {
	test("groups by object key", () => {
		const items = [
			{ type: "A", value: 1 },
			{ type: "B", value: 2 },
			{ type: "A", value: 3 },
		];
		const result = groupByKey(items, "type");

		expect(result.get("A")?.length).toBe(2);
		expect(result.get("B")?.length).toBe(1);
	});
});

describe("groupByCount", () => {
	test("counts elements in each group", () => {
		const items = ["a", "b", "a", "c", "b", "a"];
		const result = groupByCount(items, (v) => v);

		expect(result.get("a")).toBe(3);
		expect(result.get("b")).toBe(2);
		expect(result.get("c")).toBe(1);
	});

	test("returns empty map for empty array", () => {
	const result = groupByCount([], String);
	expect(result.size).toBe(0);
	});
});

describe("chunk", () => {
	test("splits array into chunks of specified size", () => {
		const items = [1, 2, 3, 4, 5, 6, 7];
		const result = chunk(items, 3);

		expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
	});

	test("handles exact division", () => {
		const items = [1, 2, 3, 4];
		const result = chunk(items, 2);

		expect(result).toEqual([[1, 2], [3, 4]]);
	});

	test("throws for zero size", () => {
		expect(() => chunk([1, 2, 3], 0)).toThrow(
			"Chunk size must be greater than 0"
		);
	});

	test("returns empty array for empty input", () => {
		const result = chunk<number>([], 3);
		expect(result).toEqual([]);
	});
});

describe("countBy", () => {
	test("counts matching elements", () => {
		const numbers = [1, 2, 3, 4, 5, 6];
		const result = countBy(numbers, (n) => n % 2 === 0);

		expect(result).toBe(3);
	});

	test("returns 0 for empty array", () => {
		const result = countBy<number>([], () => true);
		expect(result).toBe(0);
	});
});

describe("frequency", () => {
	test("calculates frequency of each element", () => {
		const items = ["a", "b", "a", "c", "b", "a", "b"];
		const result = frequency(items);

		expect(result.get("a")).toBe(3);
		expect(result.get("b")).toBe(3);
		expect(result.get("c")).toBe(1);
	});
});

describe("unique", () => {
	test("removes duplicate values", () => {
		const items = [1, 2, 1, 3, 2, 4, 1];
		const result = unique(items);

		expect(result).toEqual([1, 2, 3, 4]);
	});

	test("handles strings", () => {
		const items = ["a", "b", "a", "c", "b", "d"];
		const result = unique(items);

		expect(result).toEqual(["a", "b", "c", "d"]);
	});
});

describe("uniqueBy", () => {
	test("removes duplicates by key function", () => {
		const items = [
			{ id: 1, name: "a" },
			{ id: 2, name: "b" },
			{ id: 1, name: "c" },
		];
		const result = uniqueBy(items, (item) => item.id);

		expect(result.length).toBe(2);
		expect(result[0]?.id).toBe(1);
		expect(result[1]?.id).toBe(2);
	});

	test("returns empty array for empty input", () => {
		const items: { id: number }[] = [];
		const result = uniqueBy(items, (item) => item.id);
		expect(result).toEqual([]);
	});
});
