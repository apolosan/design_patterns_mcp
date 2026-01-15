/**
 * Event Bus - Publish-Subscribe Pattern
 * Implements a generic event bus for decoupled communication
 * Used for health check notifications and other events
 */

import { structuredLogger } from '../utils/logger.js';

/**
 * Base event payload type
 */
export type EventPayload = string | number | boolean | object | null;

/**
 * Event handler function type
 */
export type EventHandler<T extends EventPayload = EventPayload> = (event: T) => void | Promise<void>;

/**
 * Subscription token for unsubscribing
 */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  timestamp: Date;
  source?: string;
  correlationId?: string;
}

/**
 * Base event interface
 */
export interface BaseEvent<T = unknown> {
  type: string;
  payload: T;
  metadata: EventMetadata;
}

/**
 * Event Bus configuration
 */
export interface EventBusConfig {
  maxListeners: number;
  enableLogging: boolean;
  asyncDelivery: boolean;
}

const DEFAULT_CONFIG: EventBusConfig = {
  maxListeners: 100,
  enableLogging: true,
  asyncDelivery: true,
};

/**
 * Event map type - maps event names to their payload types
 */
export type EventMap = Record<string, EventPayload>;

/**
 * Generic Event Bus implementing Publish-Subscribe pattern
 */
export class EventBus<TEvents extends EventMap = EventMap> {
  private handlers = new Map<keyof TEvents, Set<EventHandler<TEvents[keyof TEvents]>>>();
  private config: EventBusConfig;

  constructor(config?: Partial<EventBusConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to an event type
   */
  subscribe<K extends keyof TEvents>(
    eventType: K,
    handler: EventHandler<TEvents[K]>
  ): Subscription {
    let handlers = this.handlers.get(eventType);

    if (!handlers) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }

    if (handlers.size >= this.config.maxListeners) {
      structuredLogger.warn('event-bus', 'Max listeners reached', {
        eventType: String(eventType),
        maxListeners: this.config.maxListeners,
      });
    }

    handlers.add(handler as EventHandler<TEvents[keyof TEvents]>);

    if (this.config.enableLogging) {
      structuredLogger.debug('event-bus', 'Handler subscribed', {
        eventType: String(eventType),
        totalHandlers: handlers.size,
      });
    }

    return {
      unsubscribe: () => {
        handlers.delete(handler as EventHandler<TEvents[keyof TEvents]>);
        if (this.config.enableLogging) {
          structuredLogger.debug('event-bus', 'Handler unsubscribed', {
            eventType: String(eventType),
            totalHandlers: handlers.size,
          });
        }
      },
    };
  }

  /**
   * Publish an event to all subscribers
   */
  async publish<K extends keyof TEvents>(
    eventType: K,
    payload: TEvents[K],
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    const handlers = this.handlers.get(eventType);

    if (!handlers || handlers.size === 0) {
      if (this.config.enableLogging) {
        structuredLogger.debug('event-bus', 'No handlers for event', {
          eventType: String(eventType),
        });
      }
      return;
    }

    const fullMetadata: EventMetadata = {
      timestamp: new Date(),
      ...metadata,
    };

    const event: BaseEvent<TEvents[K]> = {
      type: String(eventType),
      payload,
      metadata: fullMetadata,
    };

    if (this.config.enableLogging) {
      structuredLogger.debug('event-bus', 'Publishing event', {
        eventType: String(eventType),
        handlerCount: handlers.size,
      });
    }

    const deliveryPromises: Promise<void>[] = [];

    for (const handler of handlers) {
      const delivery = async () => {
        try {
          await handler(event.payload);
        } catch (error) {
          structuredLogger.error(
            'event-bus',
            'Handler error',
            error as Error,
            {
              eventType: String(eventType),
            }
          );
        }
      };

      if (this.config.asyncDelivery) {
        deliveryPromises.push(delivery());
      } else {
        await delivery();
      }
    }

    if (this.config.asyncDelivery && deliveryPromises.length > 0) {
      await Promise.all(deliveryPromises);
    }
  }

  /**
   * Publish an event synchronously (fire and forget)
   */
  emit<K extends keyof TEvents>(
    eventType: K,
    payload: TEvents[K],
    metadata?: Partial<EventMetadata>
  ): void {
    this.publish(eventType, payload, metadata).catch((error) => {
      structuredLogger.error('event-bus', 'Emit error', error as Error);
    });
  }

  /**
   * Subscribe to an event only once
   */
  once<K extends keyof TEvents>(
    eventType: K,
    handler: EventHandler<TEvents[K]>
  ): Subscription {
    const subscription = this.subscribe(eventType, (payload) => {
      subscription.unsubscribe();
      return handler(payload);
    });
    return subscription;
  }

  /**
   * Remove all handlers for an event type
   */
  removeAllListeners<K extends keyof TEvents>(eventType?: K): void {
    if (eventType) {
      this.handlers.delete(eventType);
      if (this.config.enableLogging) {
        structuredLogger.debug('event-bus', 'Removed all listeners', {
          eventType: String(eventType),
        });
      }
    } else {
      this.handlers.clear();
      if (this.config.enableLogging) {
        structuredLogger.debug('event-bus', 'Cleared all listeners');
      }
    }
  }

  /**
   * Get the number of handlers for an event type
   */
  listenerCount<K extends keyof TEvents>(eventType: K): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Get all registered event types
   */
  eventTypes(): (keyof TEvents)[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Create a typed event bus for specific event types
 */
export function createEventBus<TEvents extends EventMap = EventMap>(
  config?: Partial<EventBusConfig>
): EventBus<TEvents> {
  return new EventBus<TEvents>(config);
}
