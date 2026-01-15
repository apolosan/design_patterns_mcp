/**
 * Health Check Events
 * Defines health check event types and the health event bus
 */

import { EventBus, createEventBus, Subscription, EventMap } from './event-bus.js';
import { HealthStatus, HealthCheckResult, HealthReport } from '../health/types.js';

/**
 * Health check event types - extends EventMap for type safety
 */
export interface HealthCheckEvents extends EventMap {
  'health:check:started': HealthCheckStartedEvent;
  'health:check:completed': HealthCheckCompletedEvent;
  'health:status:changed': HealthStatusChangedEvent;
  'health:report:generated': HealthReportGeneratedEvent;
  'health:degraded': HealthDegradedEvent;
  'health:unhealthy': HealthUnhealthyEvent;
  'health:recovered': HealthRecoveredEvent;
  [key: string]: HealthCheckStartedEvent | HealthCheckCompletedEvent | HealthStatusChangedEvent | HealthReportGeneratedEvent | HealthDegradedEvent | HealthUnhealthyEvent | HealthRecoveredEvent;
}

/**
 * Event: Health check started
 */
export interface HealthCheckStartedEvent {
  checkName: string;
  timestamp: Date;
}

/**
 * Event: Health check completed
 */
export interface HealthCheckCompletedEvent {
  result: HealthCheckResult;
  duration: number;
}

/**
 * Event: Health status changed
 */
export interface HealthStatusChangedEvent {
  checkName: string;
  previousStatus: HealthStatus;
  currentStatus: HealthStatus;
  timestamp: Date;
}

/**
 * Event: Full health report generated
 */
export interface HealthReportGeneratedEvent {
  report: HealthReport;
}

/**
 * Event: Service degraded
 */
export interface HealthDegradedEvent {
  checkName: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Event: Service unhealthy
 */
export interface HealthUnhealthyEvent {
  checkName: string;
  message: string;
  error?: Error;
}

/**
 * Event: Service recovered
 */
export interface HealthRecoveredEvent {
  checkName: string;
  previousStatus: HealthStatus;
  message: string;
}

/**
 * Health Event Bus - Singleton instance for health check events
 */
class HealthEventBus {
  private static instance: HealthEventBus;
  private eventBus: EventBus<HealthCheckEvents>;
  private statusHistory = new Map<string, HealthStatus>();

  private constructor() {
    this.eventBus = createEventBus<HealthCheckEvents>({
      maxListeners: 50,
      enableLogging: true,
      asyncDelivery: true,
    });
  }

  static getInstance(): HealthEventBus {
    if (!HealthEventBus.instance) {
      HealthEventBus.instance = new HealthEventBus();
    }
    return HealthEventBus.instance;
  }

  /**
   * Subscribe to health check started events
   */
  onCheckStarted(handler: (event: HealthCheckStartedEvent) => void): Subscription {
    return this.eventBus.subscribe('health:check:started', handler);
  }

  /**
   * Subscribe to health check completed events
   */
  onCheckCompleted(handler: (event: HealthCheckCompletedEvent) => void): Subscription {
    return this.eventBus.subscribe('health:check:completed', handler);
  }

  /**
   * Subscribe to health status change events
   */
  onStatusChanged(handler: (event: HealthStatusChangedEvent) => void): Subscription {
    return this.eventBus.subscribe('health:status:changed', handler);
  }

  /**
   * Subscribe to health report generated events
   */
  onReportGenerated(handler: (event: HealthReportGeneratedEvent) => void): Subscription {
    return this.eventBus.subscribe('health:report:generated', handler);
  }

  /**
   * Subscribe to service degraded events
   */
  onDegraded(handler: (event: HealthDegradedEvent) => void): Subscription {
    return this.eventBus.subscribe('health:degraded', handler);
  }

  /**
   * Subscribe to service unhealthy events
   */
  onUnhealthy(handler: (event: HealthUnhealthyEvent) => void): Subscription {
    return this.eventBus.subscribe('health:unhealthy', handler);
  }

  /**
   * Subscribe to service recovered events
   */
  onRecovered(handler: (event: HealthRecoveredEvent) => void): Subscription {
    return this.eventBus.subscribe('health:recovered', handler);
  }

  /**
   * Emit health check started
   */
  emitCheckStarted(checkName: string): void {
    this.eventBus.emit('health:check:started', {
      checkName,
      timestamp: new Date(),
    });
  }

  /**
   * Emit health check completed and detect status changes
   */
  async emitCheckCompleted(result: HealthCheckResult, duration: number): Promise<void> {
    await this.eventBus.publish('health:check:completed', { result, duration });

    // Check for status change
    const previousStatus = this.statusHistory.get(result.name);
    if (previousStatus && previousStatus !== result.status) {
      await this.eventBus.publish('health:status:changed', {
        checkName: result.name,
        previousStatus,
        currentStatus: result.status,
        timestamp: new Date(),
      });

      // Emit specific events based on status change
      if (result.status === HealthStatus.DEGRADED) {
        await this.eventBus.publish('health:degraded', {
          checkName: result.name,
          message: result.message,
          details: result.details,
        });
      } else if (result.status === HealthStatus.UNHEALTHY) {
        await this.eventBus.publish('health:unhealthy', {
          checkName: result.name,
          message: result.message,
          error: result.error,
        });
      } else if (
        result.status === HealthStatus.HEALTHY &&
        (previousStatus === HealthStatus.DEGRADED ||
          previousStatus === HealthStatus.UNHEALTHY)
      ) {
        await this.eventBus.publish('health:recovered', {
          checkName: result.name,
          previousStatus,
          message: result.message,
        });
      }
    }

    // Update status history
    this.statusHistory.set(result.name, result.status);
  }

  /**
   * Emit health report generated
   */
  emitReportGenerated(report: HealthReport): void {
    this.eventBus.emit('health:report:generated', { report });
  }

  /**
   * Get the underlying event bus for advanced usage
   */
  getEventBus(): EventBus<HealthCheckEvents> {
    return this.eventBus;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.eventBus.removeAllListeners();
    this.statusHistory.clear();
  }
}

/**
 * Get the singleton health event bus instance
 */
export function getHealthEventBus(): HealthEventBus {
  return HealthEventBus.getInstance();
}

/**
 * Export the health event bus singleton
 */
export const healthEventBus = getHealthEventBus();
