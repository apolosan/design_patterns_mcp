/**
 * Delay utilities for async operations
 */

export class TimeoutError extends Error {
	readonly name = "TimeoutError";

	constructor(message?: string) {
		super(message ?? "Operation timed out");
	}
}

export function delay(ms: number): Promise<void>;
export function delay(ms: number, options: { timeout?: number; timeoutMessage?: string }): Promise<void>;
export function delay(ms: number, options?: { timeout?: number; timeoutMessage?: string }): Promise<void> {
	if (typeof ms !== "number" || ms < 0) {
		throw new Error("Delay must be a positive number");
	}

	const timeout = options?.timeout;
	const timeoutMessage = options?.timeoutMessage;

	if (timeout !== undefined && timeout > 0 && ms > timeout) {
		return new Promise((_resolve, reject) => {
			setTimeout(() => {
				reject(new TimeoutError(timeoutMessage));
			}, ms);
		});
	}

	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function delayWithResult<T>(
	ms: number,
	value: T,
	options?: { timeout?: number; timeoutMessage?: string }
): Promise<T> {
	const timeout = options?.timeout;

	if (timeout !== undefined && timeout > 0 && ms > timeout) {
		return new Promise((_resolve, reject) => {
			setTimeout(() => {
				reject(new TimeoutError(options?.timeoutMessage));
			}, ms);
		});
	}

	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(value);
		}, ms);
	});
}

export function delayWithError<T>(
	ms: number,
	error: T,
	options?: { timeout?: number; timeoutMessage?: string }
): Promise<never> {
	return new Promise((_resolve, reject) => {
		setTimeout(() => {
			reject(error);
		}, ms);
	});
}

export async function waitFor<T>(
	fn: () => T | Promise<T>,
	interval: number = 100,
	maxAttempts: number = 10
): Promise<T> {
	let lastError: unknown;
	const maxRetries = maxAttempts - 1;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const result = fn();
			if (result instanceof Promise) {
				return await result;
			}
			if (result !== undefined) {
				return result;
			}
		} catch (error) {
			lastError = error;
		}

		if (attempt < maxRetries) {
			await new Promise((r) => setTimeout(r, interval));
		}
	}

	throw lastError;
}

export async function waitForCondition(
	fn: () => boolean | Promise<boolean>,
	interval: number = 100,
	maxAttempts: number = 10
): Promise<boolean> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const result = fn();
		if (result instanceof Promise) {
			const awaited = await result;
			if (awaited) {
				return true;
			}
		} else if (result) {
			return true;
		}

		if (attempt < maxAttempts - 1) {
			await new Promise((r) => setTimeout(r, interval));
		}
	}

	return false;
}

export async function waitUntil(
	fn: () => boolean | Promise<boolean>,
	timeout: number,
	interval: number = 100
): Promise<boolean> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		const result = fn();
		if (result instanceof Promise) {
			const awaited = await result;
			if (awaited) {
				return true;
			}
		} else if (result) {
			return true;
		}

		await new Promise((r) => setTimeout(r, interval));
	}

	return false;
}

export function jitteredDelay(baseMs: number, factor: number = 0.5): number {
	const jitter = Math.random() * baseMs * factor;
	const minJitter = baseMs * (1 - factor);
	return Math.floor(minJitter + jitter);
}

export async function retry<T>(
	fn: () => T | Promise<T>,
	options?: {
		attempts?: number;
		delay?: number;
		jitter?: boolean;
		onError?: (error: unknown, attempt: number) => void;
	}
): Promise<T> {
	const attempts = options?.attempts ?? 3;
	const delayMs = options?.delay ?? 1000;
	const shouldJitter = options?.jitter ?? false;

	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const result = fn();
			if (result instanceof Promise) {
				return await result;
			}
			return result;
		} catch (error) {
			lastError = error;

			if (options?.onError) {
				options.onError(error, attempt);
			}

			if (attempt < attempts) {
				const waitTime = shouldJitter ? jitteredDelay(delayMs) : delayMs;
				await new Promise((r) => setTimeout(r, waitTime));
			}
		}
	}

	throw lastError;
}

export function immediate(): Promise<void> {
	return delay(0);
}

export function nextTick(): Promise<void> {
	return new Promise((resolve) => process.nextTick(resolve));
}

export function microtask(): Promise<void> {
	return Promise.resolve();
}
