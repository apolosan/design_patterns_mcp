/**
 * Tests for Event Bus (Publish-Subscribe Pattern)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus, createEventBus, EventMap } from '../../src/events/event-bus.js';

// Define test event types
interface TestEvents extends EventMap {
  'test:simple': string;
  'test:object': { id: number; name: string };
  'test:async': { value: number };
  [key: string]: string | { id: number; name: string } | { value: number };
}

describe('EventBus', () => {
  let eventBus: EventBus<TestEvents>;

  beforeEach(() => {
    eventBus = createEventBus<TestEvents>({
      enableLogging: false,
      asyncDelivery: true,
    });
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('subscribe', () => {
    it('should subscribe to an event', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:simple', handler);
      expect(eventBus.listenerCount('test:simple')).toBe(1);
    });

    it('should allow multiple handlers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('test:simple', handler1);
      eventBus.subscribe('test:simple', handler2);
      expect(eventBus.listenerCount('test:simple')).toBe(2);
    });

    it('should return a subscription for unsubscribing', () => {
      const handler = vi.fn();
      const subscription = eventBus.subscribe('test:simple', handler);
      expect(typeof subscription.unsubscribe).toBe('function');
    });
  });

  describe('unsubscribe', () => {
    it('should remove a handler when unsubscribed', () => {
      const handler = vi.fn();
      const subscription = eventBus.subscribe('test:simple', handler);
      subscription.unsubscribe();
      expect(eventBus.listenerCount('test:simple')).toBe(0);
    });

    it('should only remove the specific handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const sub1 = eventBus.subscribe('test:simple', handler1);
      eventBus.subscribe('test:simple', handler2);
      sub1.unsubscribe();
      expect(eventBus.listenerCount('test:simple')).toBe(1);
    });
  });

  describe('publish', () => {
    it('should call all handlers with the payload', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('test:simple', handler1);
      eventBus.subscribe('test:simple', handler2);

      await eventBus.publish('test:simple', 'hello');

      expect(handler1).toHaveBeenCalledWith('hello');
      expect(handler2).toHaveBeenCalledWith('hello');
    });

    it('should handle object payloads', async () => {
      const handler = vi.fn();
      eventBus.subscribe('test:object', handler);

      const payload = { id: 1, name: 'test' };
      await eventBus.publish('test:object', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should not fail if no handlers are registered', async () => {
      await expect(eventBus.publish('test:simple', 'hello')).resolves.not.toThrow();
    });

    it('should handle async handlers', async () => {
      const results: number[] = [];
      const handler = async (event: { value: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(event.value);
      };

      eventBus.subscribe('test:async', handler);
      await eventBus.publish('test:async', { value: 42 });

      expect(results).toContain(42);
    });

    it('should continue if one handler throws', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler error');
      });
      const handler2 = vi.fn();

      eventBus.subscribe('test:simple', handler1);
      eventBus.subscribe('test:simple', handler2);

      await eventBus.publish('test:simple', 'hello');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should fire and forget', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:simple', handler);

      eventBus.emit('test:simple', 'hello');

      // Since emit is fire-and-forget, we need to wait a bit
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(handler).toHaveBeenCalledWith('hello');
          resolve();
        }, 50);
      });
    });
  });

  describe('once', () => {
    it('should only trigger once', async () => {
      const handler = vi.fn();
      eventBus.once('test:simple', handler);

      await eventBus.publish('test:simple', 'first');
      await eventBus.publish('test:simple', 'second');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('test:simple', handler1);
      eventBus.subscribe('test:object', handler2);

      eventBus.removeAllListeners('test:simple');

      expect(eventBus.listenerCount('test:simple')).toBe(0);
      expect(eventBus.listenerCount('test:object')).toBe(1);
    });

    it('should remove all listeners when no event type specified', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('test:simple', handler1);
      eventBus.subscribe('test:object', handler2);

      eventBus.removeAllListeners();

      expect(eventBus.listenerCount('test:simple')).toBe(0);
      expect(eventBus.listenerCount('test:object')).toBe(0);
    });
  });

  describe('eventTypes', () => {
    it('should return all registered event types', () => {
      eventBus.subscribe('test:simple', vi.fn());
      eventBus.subscribe('test:object', vi.fn());

      const types = eventBus.eventTypes();

      expect(types).toContain('test:simple');
      expect(types).toContain('test:object');
    });

    it('should return empty array when no handlers registered', () => {
      const types = eventBus.eventTypes();
      expect(types).toEqual([]);
    });
  });

  describe('synchronous delivery', () => {
    it('should deliver events synchronously when configured', async () => {
      const syncBus = createEventBus<TestEvents>({
        enableLogging: false,
        asyncDelivery: false,
      });

      const order: number[] = [];
      const handler1 = () => {
        order.push(1);
      };
      const handler2 = () => {
        order.push(2);
      };

      syncBus.subscribe('test:simple', handler1);
      syncBus.subscribe('test:simple', handler2);

      await syncBus.publish('test:simple', 'test');

      expect(order).toEqual([1, 2]);
    });
  });

  describe('max listeners warning', () => {
    it('should handle max listeners', () => {
      const limitedBus = createEventBus<TestEvents>({
        maxListeners: 2,
        enableLogging: false,
      });

      limitedBus.subscribe('test:simple', vi.fn());
      limitedBus.subscribe('test:simple', vi.fn());
      // This should not throw, just warn
      limitedBus.subscribe('test:simple', vi.fn());

      expect(limitedBus.listenerCount('test:simple')).toBe(3);
    });
  });
});

describe('createEventBus', () => {
  it('should create an event bus with default config', () => {
    const bus = createEventBus();
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('should create an event bus with custom config', () => {
    const bus = createEventBus({
      maxListeners: 50,
      enableLogging: false,
    });
    expect(bus).toBeInstanceOf(EventBus);
  });
});
