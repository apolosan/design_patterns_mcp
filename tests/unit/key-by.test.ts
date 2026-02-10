import { describe, expect, test } from "vitest";
import {
	keyBy,
	indexBy,
	lookupBy,
	hasKey,
	getKeys,
	getValues,
	getEntries,
} from "../../src/utils/key-by.js";

describe("keyBy", () => {
	describe("keyBy with string key", () => {
		test("creates lookup from array by string key", () => {
			const users = [
				{ id: "1", name: "Alice" },
				{ id: "2", name: "Bob" },
				{ id: "3", name: "Carol" },
			];

			const result = keyBy(users, "id");

			expect(result).toEqual({
				"1": { id: "1", name: "Alice" },
				"2": { id: "2", name: "Bob" },
				"3": { id: "3", name: "Carol" },
			});
		});

		test("handles empty array", () => {
			const result = keyBy([], "id");
			expect(result).toEqual({});
		});

		test("handles array with one item", () => {
			const result = keyBy([{ id: "1", name: "Alice" }], "id");
			expect(result).toEqual({
				"1": { id: "1", name: "Alice" },
			});
		});

		test("overwrites with last occurrence by default", () => {
			const users = [
				{ id: "1", name: "Alice" },
				{ id: "1", name: "Alicia" },
			];

			const result = keyBy(users, "id");

			expect(result["1"]).toEqual({ id: "1", name: "Alicia" });
		});

		test("handles objects with property", () => {
			const items = [
				{ label: "first", value: 0 },
				{ label: "second", value: 1 },
			];

			const result = keyBy(items, "label");

			expect(result["first"]).toEqual({ label: "first", value: 0 });
			expect(result["second"]).toEqual({ label: "second", value: 1 });
		});
	});

	describe("keyBy with function", () => {
		test("creates lookup using key function", () => {
			const users = [
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: 25 },
			];

			const result = keyBy(users, (user) => user.name.toLowerCase());

			expect(result).toEqual({
				alice: { name: "Alice", age: 30 },
				bob: { name: "Bob", age: 25 },
			});
		});

		test("receives index as second argument", () => {
			let receivedIndexes: number[] = [];

			const items = ["a", "b", "c"];
			keyBy(items, (_item, index) => {
				receivedIndexes.push(index);
				return String(index);
			});

			expect(receivedIndexes.sort()).toEqual([0, 1, 2]);
		});

		test("handles function returning undefined", () => {
			const items = [
				{ key: "a", value: 1 },
				{ key: undefined, value: 2 },
				{ key: "c", value: 3 },
			];

			const result = keyBy(items, (item) => item.key ?? "");

			expect(result).toEqual({
				a: { key: "a", value: 1 },
				"": { key: undefined, value: 2 },
				c: { key: "c", value: 3 },
			});
		});

		test("handles function returning null", () => {
			const items = [
				{ key: "a", value: 1 },
				{ key: null, value: 2 },
				{ key: "c", value: 3 },
			];

			const result = keyBy(items, (item) => item.key ?? "");

			expect(result).toEqual({
				a: { key: "a", value: 1 },
				"": { key: null, value: 2 },
				c: { key: "c", value: 3 },
			});
		});
	});

	describe("keyBy with options", () => {
		test("handles lastWins: true", () => {
			const users = [
				{ id: "1", name: "Alice" },
				{ id: "1", name: "Alicia" },
			];

			const result = keyBy(users, "id", { lastWins: true });

			expect(result["1"]).toEqual({ id: "1", name: "Alicia" });
		});

		test("handles lastWins: false", () => {
			const users = [
				{ id: "1", name: "Alice" },
				{ id: "1", name: "Alicia" },
			];

			const result = keyBy(users, "id", { lastWins: false });

			expect(result["1"]).toEqual({ id: "1", name: "Alice" });
		});
	});

	describe("indexBy", () => {
		test("creates lookup with index as key", () => {
			const items = ["a", "b", "c"];

			const result = indexBy(items);

			expect(result).toEqual({
				"0": "a",
				"1": "b",
				"2": "c",
			});
		});

		test("handles empty array", () => {
			const result = indexBy<string>([]);
			expect(result).toEqual({});
		});

		test("handles objects", () => {
			const users = [
				{ name: "Alice" },
				{ name: "Bob" },
			];

			const result = indexBy(users);

			expect(result).toEqual({
				"0": { name: "Alice" },
				"1": { name: "Bob" },
			});
		});

		test("handles lastWins option", () => {
			const items = ["a", "a", "c"];
			const result = indexBy(items, { lastWins: false });

			expect(result["0"]).toBe("a");
			expect(result["1"]).toBe("a");
			expect(result["2"]).toBe("c");
		});
	});

	describe("lookupBy", () => {
		test("finds existing key", () => {
			const lookup = keyBy(
				[{ id: "1", name: "Alice" }],
				"id"
			);

			expect(lookupBy(lookup, "1")).toEqual({
				id: "1",
				name: "Alice",
			});
		});

		test("returns undefined for missing key", () => {
			const lookup = keyBy([{ id: "1" }], "id");

			expect(lookupBy(lookup, "999")).toBeUndefined();
		});
	});

	describe("hasKey", () => {
		test("returns true for existing key", () => {
			const lookup = keyBy([{ id: "1" }], "id");

			expect(hasKey(lookup, "1")).toBe(true);
		});

		test("returns false for missing key", () => {
			const lookup = keyBy([{ id: "1" }], "id");

			expect(hasKey(lookup, "999")).toBe(false);
		});
	});

	describe("getKeys", () => {
		test("returns all keys", () => {
			const lookup = keyBy(
				[{ id: "1" }, { id: "2" }, { id: "3" }],
				"id"
			);

			const keys = getKeys(lookup);

			expect(keys.sort()).toEqual(["1", "2", "3"]);
		});

		test("returns empty array for empty lookup", () => {
			const keys = getKeys({});

			expect(keys).toEqual([]);
		});
	});

	describe("getValues", () => {
		test("returns all values", () => {
			const lookup = keyBy(
				[{ id: "1" }, { id: "2" }],
				"id"
			);

			const values = getValues(lookup);

			expect(values).toHaveLength(2);
			expect(values[0].id).toBe("1");
			expect(values[1].id).toBe("2");
		});
	});

	describe("getEntries", () => {
		test("returns all entries", () => {
			const lookup = keyBy([{ id: "1" }, { id: "2" }], "id");

			const entries = getEntries(lookup);

			expect(entries).toHaveLength(2);
			expect(entries[0][0]).toBe("1");
			expect(entries[1][0]).toBe("2");
		});

		test("returns correct types", () => {
			const lookup = keyBy([{ id: "1", name: "Alice" }], "id");
			const entries = getEntries(lookup);

			expect(entries[0][0]).toBe("1");
			expect(entries[0][1]).toEqual({ id: "1", name: "Alice" });
		});
	});

	describe("edge cases", () => {
		test("handles objects with boolean values as keys", () => {
			const items = [
				{ boolKey: true, name: "first" },
				{ boolKey: false, name: "second" },
			];

			const result = keyBy(items, "boolKey");

			expect(result["true"]).toEqual({ boolKey: true, name: "first" });
			expect(result["false"]).toEqual({ boolKey: false, name: "second" });
		});
	});
});
