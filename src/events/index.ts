/**
 * Events Index
 * Export all event-related types and utilities
 */

export {
  EventBus,
  createEventBus,
  type EventHandler,
  type Subscription,
  type EventMetadata,
  type BaseEvent,
  type EventBusConfig,
} from './event-bus.js';

export {
  healthEventBus,
  getHealthEventBus,
  type HealthCheckEvents,
  type HealthCheckStartedEvent,
  type HealthCheckCompletedEvent,
  type HealthStatusChangedEvent,
  type HealthReportGeneratedEvent,
  type HealthDegradedEvent,
  type HealthUnhealthyEvent,
  type HealthRecoveredEvent,
} from './health-events.js';
