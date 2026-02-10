import { describe, expect, test, vi } from "vitest";
import {
	delay,
	delayWithResult,
	delayWithError,
	waitFor,
	waitForCondition,
	waitUntil,
	jitteredDelay,
	retry,
	immediate,
	nextTick,
	microtask,
	TimeoutError,
} from "../../src/utils/delay.js";

describe("delay", () => {
	test("resolves after specified time", async () => {
		const start = Date.now();
		await delay(50);
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(45);
		expect(elapsed).toBeLessThan(100);
	});

	test("resolves immediately for 0ms", async () => {
		const start = Date.now();
		await delay(0);
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(20);
	});

	test("throws for negative delay", () => {
		expect(() => delay(-1)).toThrow("Delay must be a positive number");
	});

	test("respects timeout option when delay exceeds timeout", async () => {
		await expect(
			delay(200, { timeout: 50, timeoutMessage: "Custom timeout" })
		).rejects.toThrow("Custom timeout");
	});
});

describe("delayWithResult", () => {
	test("resolves with value after delay", async () => {
		const result = await delayWithResult(50, "test value");
		expect(result).toBe("test value");
	});
});

describe("delayWithError", () => {
	test("rejects with error after delay", async () => {
		await expect(
			delayWithError(50, new Error("test error"))
		).rejects.toThrow("test error");
	});
});

describe("waitFor", () => {
	test("returns immediately when condition is met", async () => {
		const result = await waitFor(() => "success", 10, 10);
		expect(result).toBe("success");
	});

	test("retries until condition is met", async () => {
		let attempts = 0;
		const result = await waitFor(
			() => {
				attempts++;
				return attempts >= 3 ? "success" : undefined;
			},
			10,
			3
		);

		expect(result).toBe("success");
		expect(attempts).toBe(3);
	});

	test("throws after max attempts exceeded", async () => {
		await expect(
			waitFor(
				() => {
					throw new Error("fail");
				},
				10,
				3
			)
		).rejects.toThrow("fail");
	});
});

describe("waitForCondition", () => {
	test("returns true when condition is met immediately", async () => {
		const result = await waitForCondition(() => true, 10, 10);
		expect(result).toBe(true);
	});

	test("returns true after condition becomes true", async () => {
		let counter = 0;
		const result = await waitForCondition(
			() => {
				counter++;
				return counter >= 3;
			},
			10,
			3
		);

		expect(result).toBe(true);
		expect(counter).toBe(3);
	});

	test("returns false after max attempts exceeded", async () => {
		const result = await waitForCondition(() => false, 10, 3);
		expect(result).toBe(false);
	});
});

describe("waitUntil", () => {
	test("returns true when condition becomes true", async () => {
		let counter = 0;
		const result = await waitUntil(
			() => {
				counter++;
				return counter >= 3;
			},
			500,
			10
		);

		expect(result).toBe(true);
		expect(counter).toBe(3);
	});

	test("returns false when timeout exceeded", async () => {
		const start = Date.now();
		const result = await waitUntil(() => false, 100, 10);
		const elapsed = Date.now() - start;

		expect(result).toBe(false);
		expect(elapsed).toBeGreaterThanOrEqual(90);
	});
});

describe("jitteredDelay", () => {
	test("returns value within expected range", () => {
		const base = 100;
		const factor = 0.5;
		const result = jitteredDelay(base, factor);

		const minExpected = base * (1 - factor);
		const maxExpected = base * (1 + factor);

		expect(result).toBeGreaterThanOrEqual(minExpected);
		expect(result).toBeLessThan(maxExpected + 10);
	});

	test("produces different values on multiple calls", () => {
		const results = new Set<number>();

		for (let i = 0; i < 100; i++) {
			results.add(jitteredDelay(100, 0.5));
		}

		expect(results.size).toBeGreaterThan(1);
	});
});

describe("retry", () => {
	test("succeeds on first attempt", async () => {
		const fn = vi.fn().mockResolvedValue("success");

		const result = await retry(fn);

		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("retries on failure and succeeds", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("fail1"))
			.mockRejectedValueOnce(new Error("fail2"))
			.mockResolvedValue("success");

		const result = await retry(fn, { attempts: 3, delay: 10 });

		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	test("throws after all attempts exhausted", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("always fails"));

		await expect(
			retry(fn, { attempts: 3, delay: 10 })
		).rejects.toThrow("always fails");
		expect(fn).toHaveBeenCalledTimes(3);
	});
});

describe("immediate", () => {
	test("resolves quickly", async () => {
		const start = Date.now();
		await immediate();
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(20);
	});
});

describe("nextTick", () => {
	test("resolves on process.nextTick", () => {
		let resolved = false;

		nextTick().then(() => {
			resolved = true;
		});

		expect(resolved).toBe(false);

		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(resolved).toBe(true);
				resolve();
			}, 10);
		});
	});
});

describe("microtask", () => {
	test("resolves as microtask", () => {
		let resolved = false;

		microtask().then(() => {
			resolved = true;
		});

		expect(resolved).toBe(false);

		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(resolved).toBe(true);
				resolve();
			}, 10);
		});
	});
});

describe("TimeoutError", () => {
	test("has correct name", () => {
		const error = new TimeoutError();
		expect(error.name).toBe("TimeoutError");
	});

	test("has default message", () => {
		const error = new TimeoutError();
		expect(error.message).toBe("Operation timed out");
	});

	test("has custom message", () => {
		const error = new TimeoutError("Custom message");
		expect(error.message).toBe("Custom message");
	});
});
