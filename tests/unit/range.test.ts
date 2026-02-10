import { describe, expect, test, vi, beforeEach } from "vitest";
import {
	range,
	rangeTo,
	times,
	randomInt,
	randomFloat,
	clamp,
	lerp,
	randomPick,
	shuffle,
	shuffledCopy,
	inRange,
	sum,
	avg,
} from "../../src/utils/range.js";

describe("range", () => {
	test("generates ascending range", () => {
		expect(range(1, 5)).toEqual([1, 2, 3, 4]);
	});

	test("generates descending range", () => {
		expect(range(5, 1)).toEqual([5, 4, 3, 2]);
	});

	test("handles step option", () => {
		expect(range(0, 10, { step: 2 })).toEqual([0, 2, 4, 6, 8]);
		expect(range(10, 0, { step: 2 })).toEqual([10, 8, 6, 4, 2]);
	});

	test("handles inclusive option", () => {
		expect(range(1, 5, { inclusive: true })).toEqual([1, 2, 3, 4, 5]);
		expect(range(5, 1, { inclusive: true })).toEqual([5, 4, 3, 2, 1]);
	});

	test("throws on zero step", () => {
		expect(() => range(1, 5, { step: 0 })).toThrow("Step cannot be zero");
	});

	test("handles negative ranges", () => {
		expect(range(-3, 3)).toEqual([-3, -2, -1, 0, 1, 2]);
	});

	test("handles single element range", () => {
		expect(range(1, 1)).toEqual([]);
		expect(range(1, 2)).toEqual([1]);
	});
});

describe("rangeTo", () => {
	test("generates range from 0", () => {
		expect(rangeTo(5)).toEqual([0, 1, 2, 3, 4]);
	});

	test("handles options", () => {
		expect(rangeTo(5, { step: 2 })).toEqual([0, 2, 4]);
	});
});

describe("times", () => {
	test("generates array with mapper", () => {
		expect(times(5, (i) => i * 2)).toEqual([0, 2, 4, 6, 8]);
	});

	test("handles zero length", () => {
		expect(times(0, (i) => i)).toEqual([]);
	});

	test("throws on negative length", () => {
		expect(() => times(-1, (i) => i)).toThrow("Length cannot be negative");
	});
});

describe("randomInt", () => {
	test("returns integer in range", () => {
		for (let i = 0; i < 100; i++) {
			const result = randomInt(1, 10);
			expect(result).toBeGreaterThanOrEqual(1);
			expect(result).toBeLessThanOrEqual(10);
			expect(Number.isInteger(result)).toBe(true);
		}
	});

	test("throws on invalid range", () => {
		expect(() => randomInt(10, 5)).toThrow("Min cannot be greater than max");
	});

	test("handles same min and max", () => {
		expect(randomInt(5, 5)).toBe(5);
	});
});

describe("randomFloat", () => {
	test("returns float in range", () => {
		for (let i = 0; i < 100; i++) {
			const result = randomFloat(1, 10);
			expect(result).toBeGreaterThanOrEqual(1);
			expect(result).toBeLessThan(10);
		}
	});

	test("throws on invalid range", () => {
		expect(() => randomFloat(10, 5)).toThrow("Min cannot be greater than max");
	});
});

describe("clamp", () => {
	test("clamps value within range", () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-5, 0, 10)).toBe(0);
		expect(clamp(15, 0, 10)).toBe(10);
	});

	test("throws on invalid range", () => {
		expect(() => clamp(5, 10, 0)).toThrow("Min cannot be greater than max");
	});
});

describe("lerp", () => {
	test("interpolates correctly", () => {
		expect(lerp(0, 100, 0)).toBe(0);
		expect(lerp(0, 100, 0.5)).toBe(50);
		expect(lerp(0, 100, 1)).toBe(100);
	});

	test("throws on invalid factor", () => {
		expect(() => lerp(0, 100, -0.1)).toThrow(
			"Interpolation factor must be between 0 and 1"
		);
		expect(() => lerp(0, 100, 1.1)).toThrow(
			"Interpolation factor must be between 0 and 1"
		);
	});
});

describe("randomPick", () => {
	test("picks from array", () => {
		const arr = ["a", "b", "c"];

		for (let i = 0; i < 100; i++) {
			const result = randomPick(arr);
			expect(arr).toContain(result);
		}
	});

	test("throws on empty array", () => {
		expect(() => randomPick([])).toThrow("Cannot pick from empty array");
	});
});

describe("shuffle", () => {
	test("shuffles array in place", () => {
		const arr = [1, 2, 3, 4, 5];
		const original = [...arr];

		shuffle(arr);

		expect(arr.sort()).toEqual(original.sort());
	});

	test("returns the same array", () => {
		const arr = [1, 2, 3];
		const result = shuffle(arr);

		expect(result).toBe(arr);
	});
});

describe("shuffledCopy", () => {
	test("returns new shuffled array", () => {
		const original = [1, 2, 3, 4, 5];
		const result = shuffledCopy(original);

		expect(result).not.toBe(original);
		expect(result.sort()).toEqual(original.sort());
	});
});

describe("inRange", () => {
	test("checks exclusive range", () => {
		expect(inRange(5, 1, 10)).toBe(true);
		expect(inRange(1, 1, 10)).toBe(false);
		expect(inRange(10, 1, 10)).toBe(false);
	});

	test("checks inclusive range", () => {
		expect(inRange(1, 1, 10, { inclusive: true })).toBe(true);
		expect(inRange(10, 1, 10, { inclusive: true })).toBe(true);
	});

	test("throws on invalid range", () => {
		expect(() => inRange(5, 10, 1)).toThrow("Min cannot be greater than max");
	});
});

describe("sum", () => {
	test("sums array", () => {
		expect(sum([1, 2, 3, 4, 5])).toBe(15);
		expect(sum([])).toBe(0);
		expect(sum([-1, 1])).toBe(0);
	});
});

describe("avg", () => {
	test("calculates average", () => {
		expect(avg([1, 2, 3, 4, 5])).toBe(3);
		expect(avg([2, 4])).toBe(3);
	});

	test("throws on empty array", () => {
		expect(() => avg([])).toThrow("Cannot average empty array");
	});
});
