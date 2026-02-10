/**
 * Throttle Utility Tests
 * Tests for throttle function implementation
 */

import { describe, it, expect } from 'vitest';
import { throttle } from '../../src/utils/throttle.js';

describe('throttle', () => {
  it('should call function immediately on first call', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const throttled = throttle(fn, 100);

    throttled();
    expect(callCount).toBe(1);
  });

  it('should not call function again within limit', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();
    expect(callCount).toBe(1);
  });

  it('should support leading false', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const throttled = throttle(fn, 100, { leading: false });

    throttled();
    expect(callCount).toBe(0);
  });

  it('should throw for non-function', () => {
    expect(() => throttle('not a function' as any, 100)).toThrow(TypeError);
  });

  it('should throw for negative limit', () => {
    expect(() => throttle(() => {}, -100)).toThrow(TypeError);
  });

  it('should return a function', () => {
    const fn = () => {};
    const throttled = throttle(fn, 100);
    expect(typeof throttled).toBe('function');
  });

  it('should pass arguments correctly', () => {
    let receivedArgs: [number, string] | null = null;
    const fn = (a: number, b: string) => { receivedArgs = [a, b]; };
    const throttled = throttle(fn, 100);

    throttled(42, 'hello');
    expect(receivedArgs).toEqual([42, 'hello']);
  });

  it('should preserve this context', () => {
    const obj = { value: 42 };
    let result: number | undefined;
    const fn = function (this: any) { result = this.value; };
    const throttled = throttle(fn, 100);

    throttled.call(obj);
    expect(result).toBe(42);
  });

  it('should handle trailing option', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const throttled = throttle(fn, 100, { trailing: true });

    throttled();
    throttled();
    expect(callCount).toBe(1);
  });

  it('should handle function with multiple parameters', () => {
    let result = 0;
    const fn = (a: number, b: number, c: number) => { result = a + b + c; };
    const throttled = throttle(fn, 100);
    
    throttled(1, 2, 3);
    expect(result).toBe(6);
  });

  it('should handle function returning value', () => {
    const fn = (x: number) => x * 2;
    const throttled = throttle(fn, 100);
    
    const result = throttled(5);
    expect(result).toBeUndefined();
  });

  it('should handle different limit values', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    
    const throttled1 = throttle(fn, 0);
    const throttled2 = throttle(fn, 100);
    const throttled3 = throttle(fn, 1000);
    
    throttled1();
    throttled2();
    throttled3();
    expect(callCount).toBe(3);
  });
});
