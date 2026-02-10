/**
 * Result Pattern - Type-safe error handling
 */

export type Result<T, E = unknown> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T, E = unknown>(value: T): Result<T, E> {
	return { ok: true, value };
}

export function err<T, E = unknown>(error: E): Result<T, E> {
	return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
	return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
	return result.ok === false;
}

export function fromTry<T, E = unknown>(fn: () => T): Result<T, E> {
	try {
		return { ok: true, value: fn() };
	} catch (error) {
		return { ok: false, error: error as E };
	}
}

export async function fromPromise<T, E = unknown>(
	promise: Promise<T>
): Promise<Result<T, E>> {
	try {
		return { ok: true, value: await promise };
	} catch (error) {
		return { ok: false, error: error as E };
	}
}

export function partition<T, E>(
	results: Result<T, E>[]
): [okResults: T[], errResults: E[]] {
	const okResults: T[] = [];
	const errResults: E[] = [];

	for (const result of results) {
		if (result.ok) {
			okResults.push(result.value);
		} else {
			errResults.push(result.error);
		}
	}

	return [okResults, errResults];
}

export function all<T, E>(
	results: Result<T, E>[]
): Result<T[], E> {
	const values: T[] = [];

	for (const result of results) {
		if (!result.ok) {
			return result;
		}
		values.push(result.value);
	}

	return { ok: true, value: values };
}

export function any<T, E>(
	results: Result<T, E>[]
): Result<T, E> {
	for (const result of results) {
		if (result.ok) {
			return result;
		}
	}

	const errors = results
		.filter((r): r is { ok: false; error: E } => !r.ok)
		.map((r) => r.error);

	return {
		ok: false,
		error: new AggregateError(errors, "All results were errors") as E,
	};
}

export function zip<T1, T2, E>(
	result1: Result<T1, E>,
	result2: Result<T2, E>
): Result<[T1, T2], E> {
	if (!result1.ok) {
		return result1;
	}
	if (!result2.ok) {
		return result2;
	}

	return { ok: true, value: [result1.value, result2.value] };
}

export function zipWith<T1, T2, T3, E>(
	result1: Result<T1, E>,
	result2: Result<T2, E>,
	fn: (value1: T1, value2: T2) => T3
): Result<T3, E> {
	if (!result1.ok) {
		return result1 as Result<T3, E>;
	}
	if (!result2.ok) {
		return result2 as Result<T3, E>;
	}

	return { ok: true, value: fn(result1.value, result2.value) };
}
