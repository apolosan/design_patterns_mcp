import { describe, expect, test } from "vitest";
import {
	median,
	mode,
	stdDev,
	variance,
	percentile,
	gcd,
	lcm,
	roundPrecise,
	formatCompact,
	percentage,
	mapRange,
	isEven,
	isOdd,
	factorial,
	nthRoot,
	formatNumber,
	geometricMean,
	harmonicMean,
} from "../../src/utils/math-utils.js";

describe("median", () => {
	test("calculates median of odd-length array", () => {
		expect(median([1, 2, 3, 4, 5])).toBe(3);
	});

	test("calculates median of even-length array", () => {
		expect(median([1, 2, 3, 4])).toBe(2.5);
	});

	test("handles unsorted array", () => {
		expect(median([5, 1, 3, 2, 4])).toBe(3);
	});

	test("handles negative numbers", () => {
		expect(median([-5, -1, 0, 1, 5])).toBe(0);
	});

	test("throws on empty array", () => {
		expect(() => median([])).toThrow(
			"Cannot calculate median of empty array"
		);
	});
});

describe("mode", () => {
	test("returns single mode", () => {
		expect(mode([1, 2, 2, 3, 3, 3])).toEqual([3]);
	});

	test("returns multiple modes", () => {
		expect(mode([1, 2, 2, 3, 3])).toEqual([2, 3]);
	});

	test("returns all elements when all same", () => {
		expect(mode([5, 5, 5])).toEqual([5]);
	});

	test("handles single element", () => {
		expect(mode([42])).toEqual([42]);
	});

	test("throws on empty array", () => {
		expect(() => mode([])).toThrow("Cannot calculate mode of empty array");
	});
});

describe("stdDev", () => {
	test("calculates population standard deviation", () => {
		expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
	});

	test("calculates sample standard deviation", () => {
		expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9], { sample: true })).toBeCloseTo(
			2.138,
			2
		);
	});

	test("handles single element", () => {
		expect(stdDev([5])).toBe(0);
	});

	test("throws on empty array", () => {
		expect(() => stdDev([])).toThrow(
			"Cannot calculate standard deviation of empty array"
		);
	});

	test("throws on insufficient data for sample", () => {
		expect(() => stdDev([5], { sample: true })).toThrow(
			"Insufficient data points for calculation"
		);
	});
});

describe("variance", () => {
	test("calculates population variance", () => {
		expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBe(4);
	});

	test("calculates sample variance", () => {
		expect(variance([2, 4, 4, 4, 5, 5, 7, 9], { sample: true })).toBeCloseTo(
			4.571,
			2
		);
	});

	test("returns square of stdDev", () => {
		const arr = [2, 4, 4, 4, 5, 5, 7, 9];
		expect(variance(arr)).toBe(Math.pow(stdDev(arr), 2));
	});
});

describe("percentile", () => {
	test("calculates 50th percentile (median)", () => {
		expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5.5);
	});

	test("calculates 0th percentile", () => {
		expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
	});

	test("calculates 100th percentile", () => {
		expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
	});

	test("uses linear interpolation by default", () => {
		expect(percentile([1, 2, 3, 4], 25)).toBe(1.75);
	});

	test("supports different interpolation methods", () => {
		expect(
			percentile([1, 2, 3, 4], 25, { interpolation: "lower" })
		).toBe(1);
		expect(
			percentile([1, 2, 3, 4], 25, { interpolation: "higher" })
		).toBe(2);
		expect(
			percentile([1, 2, 3, 4], 25, { interpolation: "midpoint" })
		).toBe(1.5);
		expect(
			percentile([1, 2, 3, 4], 25, { interpolation: "nearest" })
		).toBe(2);
	});

	test("throws on empty array", () => {
		expect(() => percentile([], 50)).toThrow(
			"Cannot calculate percentile of empty array"
		);
	});

	test("throws on invalid percentile", () => {
		expect(() => percentile([1, 2, 3], 101)).toThrow(
			"Percentile must be between 0 and 100"
		);
		expect(() => percentile([1, 2, 3], -1)).toThrow(
			"Percentile must be between 0 and 100"
		);
	});
});

describe("gcd", () => {
	test("calculates gcd of two numbers", () => {
		expect(gcd(48, 18)).toBe(6);
		expect(gcd(100, 25)).toBe(25);
	});

	test("calculates gcd of multiple numbers", () => {
		expect(gcd(48, 18, 12)).toBe(6);
		expect(gcd(24, 36, 48, 60)).toBe(12);
	});

	test("handles negative numbers", () => {
		expect(gcd(-48, 18)).toBe(6);
		expect(gcd(48, -18)).toBe(6);
	});

	test("handles single number", () => {
		expect(gcd(42)).toBe(42);
		expect(gcd(0)).toBe(0);
	});

	test("throws on non-integers", () => {
		expect(() => gcd(4.5, 2)).toThrow("GCD requires integer values");
	});

	test("throws with no arguments", () => {
		expect(() => gcd()).toThrow("At least one number required");
	});
});

describe("lcm", () => {
	test("calculates lcm of two numbers", () => {
		expect(lcm(4, 5)).toBe(20);
		expect(lcm(6, 8)).toBe(24);
	});

	test("calculates lcm of multiple numbers", () => {
		expect(lcm(4, 5, 6)).toBe(60);
		expect(lcm(3, 4, 5, 6)).toBe(60);
	});

	test("handles negative numbers", () => {
		expect(lcm(-4, 5)).toBe(20);
		expect(lcm(4, -5)).toBe(20);
	});

	test("handles single number", () => {
		expect(lcm(42)).toBe(42);
	});

	test("throws on non-integers", () => {
		expect(() => lcm(4.5, 2)).toThrow("LCM requires integer values");
	});

	test("throws with no arguments", () => {
		expect(() => lcm()).toThrow("At least one number required");
	});
});

describe("roundPrecise", () => {
	test("rounds to specified decimals", () => {
		expect(roundPrecise(3.14159, 2)).toBe(3.14);
		expect(roundPrecise(3.14159, 4)).toBe(3.1416);
	});

	test("rounds to integer by default", () => {
		expect(roundPrecise(3.7)).toBe(4);
	});

	test("handles zero decimals", () => {
		expect(roundPrecise(3.5, 0)).toBe(4);
	});

	test("handles negative numbers", () => {
		expect(roundPrecise(-3.14159, 2)).toBe(-3.14);
	});

	test("handles large numbers", () => {
		expect(roundPrecise(1234567.89, 2)).toBe(1234567.89);
	});

	test("throws on non-finite numbers", () => {
		expect(() => roundPrecise(Infinity, 2)).toThrow(
			"Cannot round non-finite number"
		);
		expect(() => roundPrecise(NaN, 2)).toThrow(
			"Cannot round non-finite number"
		);
	});

	test("throws on negative decimals", () => {
		expect(() => roundPrecise(3.14, -1)).toThrow(
			"Decimals must be non-negative"
		);
	});
});

describe("formatCompact", () => {
	test("formats thousands (K)", () => {
		expect(formatCompact(1500)).toBe("1.5K");
		expect(formatCompact(999500)).toBe("999.5K");
	});

	test("formats millions (M)", () => {
		expect(formatCompact(1500000)).toBe("1.5M");
		expect(formatCompact(2500000000)).toBe("2.5B");
	});

	test("formats billions (B)", () => {
		expect(formatCompact(2500000000)).toBe("2.5B");
	});

	test("formats trillions (T)", () => {
		expect(formatCompact(1500000000000)).toBe("1.5T");
	});

	test("handles small numbers", () => {
		expect(formatCompact(500)).toBe("500");
		expect(formatCompact(0)).toBe("0");
	});

	test("handles negative numbers", () => {
		expect(formatCompact(-1500)).toBe("-1.5K");
	});

	test("respects decimal option", () => {
		expect(formatCompact(1234, { decimals: 0 })).toBe("1K");
		expect(formatCompact(1234, { decimals: 3 })).toBe("1.234K");
	});

	test("throws on non-finite numbers", () => {
		expect(() => formatCompact(Infinity)).toThrow(
			"Cannot format non-finite number"
		);
	});
});

describe("percentage", () => {
	test("calculates percentage", () => {
		expect(percentage(25, 100)).toBe(25);
		expect(percentage(1, 3)).toBe(33.3);
	});

	test("handles zero value", () => {
		expect(percentage(0, 100)).toBe(0);
	});

	test("handles values over 100%", () => {
		expect(percentage(150, 100)).toBe(150);
	});

	test("respects decimal option", () => {
		expect(percentage(1, 3, 0)).toBe(33);
		expect(percentage(1, 3, 5)).toBe(33.33333);
	});

	test("throws on zero total", () => {
		expect(() => percentage(10, 0)).toThrow("Total cannot be zero");
	});
});

describe("mapRange", () => {
	test("maps from 0-1 to 0-100", () => {
		expect(mapRange(0.5, 0, 1, 0, 100)).toBe(50);
		expect(mapRange(0, 0, 1, 0, 100)).toBe(0);
		expect(mapRange(1, 0, 1, 0, 100)).toBe(100);
	});

	test("maps negative ranges", () => {
		expect(mapRange(0, -1, 1, -100, 100)).toBe(0);
	});

	test("maps to negative ranges", () => {
		expect(mapRange(0, 0, 1, 100, 0)).toBe(100);
		expect(mapRange(1, 0, 1, 100, 0)).toBe(0);
	});

	test("throws on equal min and max", () => {
		expect(() => mapRange(5, 10, 10, 0, 100)).toThrow(
			"Input range cannot have same min and max"
		);
	});
});

describe("isEven", () => {
	test("returns true for even numbers", () => {
		expect(isEven(2)).toBe(true);
		expect(isEven(0)).toBe(true);
		expect(isEven(-4)).toBe(true);
	});

	test("returns false for odd numbers", () => {
		expect(isEven(1)).toBe(false);
		expect(isEven(-3)).toBe(false);
	});

	test("throws on non-integers", () => {
		expect(() => isEven(4.5)).toThrow("isEven requires integer value");
		expect(() => isEven(Infinity)).toThrow("isEven requires integer value");
	});
});

describe("isOdd", () => {
	test("returns true for odd numbers", () => {
		expect(isOdd(1)).toBe(true);
		expect(isOdd(-3)).toBe(true);
	});

	test("returns false for even numbers", () => {
		expect(isOdd(2)).toBe(false);
		expect(isOdd(0)).toBe(false);
		expect(isOdd(-4)).toBe(false);
	});

	test("throws on non-integers", () => {
		expect(() => isOdd(4.5)).toThrow("isOdd requires integer value");
		expect(() => isOdd(NaN)).toThrow("isOdd requires integer value");
	});
});

describe("factorial", () => {
	test("calculates factorial", () => {
		expect(factorial(0)).toBe(1);
		expect(factorial(1)).toBe(1);
		expect(factorial(5)).toBe(120);
		expect(factorial(10)).toBe(3628800);
	});

	test("throws on negative numbers", () => {
		expect(() => factorial(-1)).toThrow(
			"Factorial requires non-negative integer"
		);
	});

	test("throws on non-integers", () => {
		expect(() => factorial(4.5)).toThrow(
			"Factorial requires integer value"
		);
	});

	test("returns Infinity for large values", () => {
		expect(factorial(171)).toBe(Infinity);
	});
});

describe("nthRoot", () => {
	test("calculates square root", () => {
		expect(nthRoot(16, 2)).toBe(4);
		expect(nthRoot(0, 2)).toBe(0);
	});

	test("calculates cube root", () => {
		expect(nthRoot(8, 3)).toBe(2);
		expect(nthRoot(-8, 3)).toBe(-2);
	});

	test("calculates fourth root", () => {
		expect(nthRoot(81, 4)).toBe(3);
	});

	test("throws on zero or negative root", () => {
		expect(() => nthRoot(16, 0)).toThrow("Root must be positive");
		expect(() => nthRoot(16, -2)).toThrow("Root must be positive");
	});

	test("throws on even root of negative number", () => {
		expect(() => nthRoot(-16, 2)).toThrow(
			"Cannot calculate even root of negative number"
		);
	});
});

describe("formatNumber", () => {
	test("formats with thousands separators", () => {
		expect(formatNumber(1000000)).toBe("1,000,000");
		expect(formatNumber(1234.56)).toBe("1,234.56");
	});

	test("handles negative numbers", () => {
		expect(formatNumber(-1000000)).toBe("-1,000,000");
	});

	test("uses custom locale", () => {
		expect(formatNumber(1000000, "de-DE")).toBe("1.000.000");
	});

	test("throws on non-finite numbers", () => {
		expect(() => formatNumber(Infinity)).toThrow(
			"Cannot format non-finite number"
		);
	});
});

describe("geometricMean", () => {
	test("calculates geometric mean", () => {
		expect(geometricMean([4, 9])).toBe(6);
		expect(geometricMean([1, 2, 3, 4, 5])).toBeCloseTo(2.605, 2);
	});

	test("throws on empty array", () => {
		expect(() => geometricMean([])).toThrow(
			"Cannot calculate geometric mean of empty array"
		);
	});

	test("throws on zero or negative numbers", () => {
		expect(() => geometricMean([0, 1, 2])).toThrow(
			"Geometric mean requires positive numbers"
		);
		expect(() => geometricMean([-1, 1, 2])).toThrow(
			"Geometric mean requires positive numbers"
		);
	});
});

describe("harmonicMean", () => {
	test("calculates harmonic mean", () => {
		expect(harmonicMean([2, 4])).toBeCloseTo(2.667, 2);
		expect(harmonicMean([1, 2, 3, 4, 5])).toBeCloseTo(2.19, 2);
	});

	test("throws on empty array", () => {
		expect(() => harmonicMean([])).toThrow(
			"Cannot calculate harmonic mean of empty array"
		);
	});

	test("throws on zero values", () => {
		expect(() => harmonicMean([0, 1, 2])).toThrow(
			"Harmonic mean requires non-zero numbers"
		);
	});
});
