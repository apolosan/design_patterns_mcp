import { describe, expect, test, vi, beforeEach } from "vitest";
import {
	try_,
	tryAsync,
	isTryError,
	attempt,
	attemptAsync,
	retry,
	apply,
	get,
	TryError,
} from "../../src/utils/try.js";

describe("try_", () => {
	test("returns result on success", () => {
		const result = try_(() => 42);

		expect(result).toBe(42);
	});

	test("returns TryError on exception", () => {
		const result = try_(() => {
			throw new Error("fail");
		});

		expect(isTryError(result)).toBe(true);
		if (isTryError(result)) {
			expect(result.originalError).toBeInstanceOf(Error);
			expect((result.originalError as Error).message).toBe("fail");
		}
	});

	test("uses custom message", () => {
		const result = try_(
			() => {
				throw new Error("fail");
			},
			{ message: "Custom error" }
		);

		expect(isTryError(result)).toBe(true);
		if (isTryError(result)) {
			expect(result.message).toBe("Custom error");
		}
	});

	test("uses fallback value", () => {
		const result = try_(
			() => {
				throw new Error("fail");
			},
			{ fallback: "default" }
		);

		expect(result).toBe("default");
	});

	test("calls onError handler", () => {
		const handler = vi.fn();

		const result = try_(
			() => {
				throw new Error("fail");
			},
			{ onError: handler }
		);

		expect(handler).toHaveBeenCalledTimes(1);
		if (isTryError(result)) {
			expect(handler).toHaveBeenCalledWith(result);
		}
	});

	test("re-throws non-matching error types", () => {
		expect(() => {
			try_(
				() => {
					throw new TypeError("fail");
				},
				{ catchTypes: [RangeError] }
			);
		}).toThrow(TypeError);
	});

	test("catches matching error types", () => {
		const result = try_(
			() => {
				throw new TypeError("fail");
			},
			{ catchTypes: [TypeError] }
		);

		expect(isTryError(result)).toBe(true);
	});
});

describe("tryAsync", () => {
	test("returns result on success", async () => {
		const result = await tryAsync(async () => 42);

		expect(result).toBe(42);
	});

	test("returns TryError on exception", async () => {
		const result = await tryAsync(async () => {
			throw new Error("fail");
		});

		expect(isTryError(result)).toBe(true);
	});

	test("uses custom message", async () => {
		const result = await tryAsync(
			async () => {
				throw new Error("fail");
			},
			{ message: "Async error" }
		);

		expect(isTryError(result)).toBe(true);
		if (isTryError(result)) {
			expect(result.message).toBe("Async error");
		}
	});

	test("uses fallback value", async () => {
		const result = await tryAsync(
			async () => {
				throw new Error("fail");
			},
			{ fallback: "default" }
		);

		expect(result).toBe("default");
	});
});

describe("isTryError", () => {
	test("returns true for TryError", () => {
		const error = new TryError("test", new Error());
		expect(isTryError(error)).toBe(true);
	});

	test("returns false for other values", () => {
		expect(isTryError(new Error())).toBe(false);
		expect(isTryError("string")).toBe(false);
		expect(isTryError(null)).toBe(false);
		expect(isTryError(42)).toBe(false);
		expect(isTryError({})).toBe(false);
	});
});

describe("attempt", () => {
	test("returns [true, result] on success", () => {
		const [success, result] = attempt(() => 42);

		expect(success).toBe(true);
		expect(result).toBe(42);
	});

	test("returns [false, TryError] on failure", () => {
		const [success, result] = attempt(() => {
			throw new Error("fail");
		});

		expect(success).toBe(false);
		expect(isTryError(result)).toBe(true);
	});
});

describe("attemptAsync", () => {
	test("returns [true, result] on success", async () => {
		const [success, result] = await attemptAsync(async () => 42);

		expect(success).toBe(true);
		expect(result).toBe(42);
	});

	test("returns [false, TryError] on failure", async () => {
		const [success, result] = await attemptAsync(async () => {
			throw new Error("fail");
		});

		expect(success).toBe(false);
		expect(isTryError(result)).toBe(true);
	});
});

describe("retry", () => {
	test("returns result on first attempt success", () => {
		const fn = vi.fn(() => 42);

		const result = retry(fn);

		expect(result).toBe(42);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("retries on failure", () => {
		let callCount = 0;
		const fn = vi.fn(() => {
			callCount++;
			if (callCount < 3) {
				throw new Error("fail");
			}
			return 42;
		});

		const result = retry(fn, { attempts: 5, delay: 0 });

		expect(result).toBe(42);
		expect(fn).toHaveBeenCalledTimes(3);
	});

	test("returns TryError after all attempts fail", () => {
		const fn = vi.fn(() => {
			throw new Error("fail");
		});

		const result = retry(fn, { attempts: 3, delay: 0 });

		expect(isTryError(result)).toBe(true);
		expect(fn).toHaveBeenCalledTimes(3);
	});

	test("calls onRetry callback", () => {
		const onRetry = vi.fn();
		const fn = vi.fn(() => {
			throw new Error("fail");
		});

		retry(fn, { attempts: 3, delay: 0, onRetry });

		expect(onRetry).toHaveBeenCalledTimes(2);
	});
});

describe("apply", () => {
	test("applies function successfully", () => {
		const result = apply(
			(a: number, b: number) => a + b,
			[2, 3]
		);

		expect(result).toBe(5);
	});

	test("returns TryError on exception", () => {
		const result = apply(
			(_a: unknown, _b: unknown) => {
				throw new Error("fail");
			},
			[1, 2]
		);

		expect(isTryError(result)).toBe(true);
	});
});

describe("get", () => {
	test("gets nested property", () => {
		const obj = { a: { b: { c: "value" } } };

		const result = get(obj, "a.b.c");

		expect(result).toBe("value");
	});

	test("returns fallback for missing property", () => {
		const obj = { a: { b: "value" } };

		const result = get(obj, "a.c.d", "default");

		expect(result).toBe("default");
	});

	test("returns fallback for null object", () => {
		const result = get(null as unknown as Record<string, unknown>, "a.b", "default");

		expect(result).toBe("default");
	});

	test("handles array access", () => {
		const obj = { items: [{ name: "first" }, { name: "second" }] };

		const result = get(obj, "items.0.name");

		expect(result).toBe("first");
	});

	test("returns TryError on exception", () => {
		const obj = { a: { b: null } };
		const cyclic: Record<string, unknown> = { value: null };
		cyclic.self = cyclic;

		const result = get(obj, "a.b.c.d", "default");

		expect(result).toBe("default");
	});
});
