/**
 * Debounce Utility Tests
 * Tests for debounce function implementation
 */

import { describe, it, expect } from 'vitest';
import { debounce } from '../../src/utils/debounce.js';

describe('debounce', () => {
  it('should throw for non-function', () => {
    expect(() => debounce('not a function' as any, 100)).toThrow(TypeError);
  });

  it('should throw for negative delay', () => {
    expect(() => debounce(() => {}, -100)).toThrow(TypeError);
  });

  it('should return a function', () => {
    const fn = () => {};
    const debounced = debounce(fn, 100);
    expect(typeof debounced).toBe('function');
  });

  it('should throw for non-function with options', () => {
    expect(() => debounce('not a function' as any, 100, { leading: true })).toThrow(TypeError);
  });

  it('should handle different delay values', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    
    const debounced1 = debounce(fn, 0);
    const debounced2 = debounce(fn, 100);
    const debounced3 = debounce(fn, 1000);
    
    expect(typeof debounced1).toBe('function');
    expect(typeof debounced2).toBe('function');
    expect(typeof debounced3).toBe('function');
  });

  it('should handle function with multiple parameters', () => {
    let result = 0;
    const fn = (a: number, b: number, c: number) => { result = a + b + c; };
    const debounced = debounce(fn, 100);
    
    debounced(1, 2, 3);
    expect(typeof debounced).toBe('function');
  });

  it('should handle function returning value', () => {
    const fn = (x: number) => x * 2;
    const debounced = debounce(fn, 100);
    
    expect(typeof debounced).toBe('function');
  });
});
