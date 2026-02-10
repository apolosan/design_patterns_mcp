import { describe, expect, test } from "vitest";
import {
	ok,
	err,
	isOk,
	isErr,
	fromTry,
	fromPromise,
	partition,
	all,
	zip,
	zipWith,
} from "../../src/utils/result.js";

describe("Result Pattern", () => {
	describe("Factory Functions", () => {
		test("ok() creates Ok result", () => {
			const result = ok(42);
			expect(result.ok).toBe(true);
		});

		test("err() creates Err result", () => {
			const error = new Error("fail");
			const result = err(error);
			expect(result.ok).toBe(false);
		});
	});

	describe("Type Guards", () => {
		test("isOk() returns true for Ok", () => {
			const result = ok("test");
			expect(isOk(result)).toBe(true);
			expect(isErr(result)).toBe(false);
		});

		test("isErr() returns true for Err", () => {
			const result = err("fail");
			expect(isErr(result)).toBe(true);
			expect(isOk(result)).toBe(false);
		});
	});

	describe("fromTry", () => {
		test("returns Ok on success", () => {
			const result = fromTry(() => 42);
			expect(result.ok).toBe(true);
		});

		test("returns Err on exception", () => {
			const result = fromTry<number, Error>(() => {
				throw new Error("fail");
			});
			expect(result.ok).toBe(false);
		});
	});

	describe("fromPromise", () => {
		test("resolves to Ok on success", async () => {
			const promise = Promise.resolve(42);
			const result = await fromPromise(promise);
			expect(result.ok).toBe(true);
		});

		test("resolves to Err on rejection", async () => {
			const promise = Promise.reject(new Error("fail"));
			const result = await fromPromise(promise);
			expect(result.ok).toBe(false);
		});
	});

	describe("partition", () => {
		test("separates Ok and Err values", () => {
			const results = [
				ok(1),
				err(new Error("a")),
				ok(2),
				err(new Error("b")),
				ok(3),
			];

			const [oks, errs] = partition(results);

			expect(oks).toEqual([1, 2, 3]);
			expect(errs).toHaveLength(2);
		});

		test("handles empty array", () => {
			const [oks, errs] = partition([]);
			expect(oks).toEqual([]);
			expect(errs).toEqual([]);
		});

		test("handles all Ok values", () => {
			const [oks, errs] = partition([ok(1), ok(2), ok(3)]);
			expect(oks).toEqual([1, 2, 3]);
			expect(errs).toEqual([]);
		});
	});

	describe("all", () => {
		test("returns all Ok values as Ok", () => {
			const results = [ok(1), ok(2), ok(3)];
			const result = all(results);
			expect(result.ok).toBe(true);
		});

		test("returns first Err", () => {
			const results: ReturnType<typeof ok<number>>[] = [
				ok(1),
				err(new Error("fail")) as ReturnType<typeof ok<number>>,
				ok(3),
			];
			const result = all(results);
			expect(result.ok).toBe(false);
		});

		test("handles empty array", () => {
			const result = all<number, string>([]);
			expect(result.ok).toBe(true);
		});
	});

	describe("zip", () => {
		test("zips two Ok values", () => {
			const result = zip(ok(1), ok("a"));
			expect(result.ok).toBe(true);
		});

		test("returns first Err", () => {
			const result = zip(ok(1), err(new Error("fail")) as ReturnType<typeof ok<string>>);
			expect(result.ok).toBe(false);
		});
	});

	describe("zipWith", () => {
		test("zips with transformation", () => {
			const result = zipWith(ok(5), ok(3), (a, b) => a + b);
			expect(result.ok).toBe(true);
		});

		test("returns Err on first failure", () => {
			const result = zipWith(ok(5), err(new Error("fail")) as ReturnType<typeof ok<number>>, (a, b) => a + b);
			expect(result.ok).toBe(false);
		});
	});
});
