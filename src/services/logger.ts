/**
 * Structured Logging Service for Design Patterns MCP Server
 * Provides consistent logging across all services with multiple output formats
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggingStrategy, LogEntry as StrategyLogEntry, LogLevel as StrategyLogLevel } from '../strategies/logging-strategy.js';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: unknown;
  error?: Error;
  correlationId?: string;
  duration?: number;
}

interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  logFile?: string;
  maxFileSize: number;
  maxFiles: number;
  strategy?: LoggingStrategy; // Optional strategy for Strategy Pattern
}

export class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private bufferSize = 100;
  private strategy?: LoggingStrategy;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.strategy = config.strategy;
  }

  /**
    * Log debug message
    */
   debug(service: string, message: string, data?: unknown, correlationId?: string): void {
    this.log(LogLevel.DEBUG, service, message, data, undefined, correlationId);
  }

  /**
    * Log info message
    */
   info(service: string, message: string, data?: unknown, correlationId?: string): void {
    this.log(LogLevel.INFO, service, message, data, undefined, correlationId);
  }

  /**
    * Log warning message
    */
   warn(service: string, message: string, data?: unknown, correlationId?: string): void {
    this.log(LogLevel.WARN, service, message, data, undefined, correlationId);
  }

  /**
    * Log error message
    */
   error(service: string, message: string, error?: Error, data?: unknown, correlationId?: string): void {
    this.log(LogLevel.ERROR, service, message, data, error, correlationId);
  }

  /**
    * Log fatal error message
    */
   fatal(service: string, message: string, error?: Error, data?: unknown, correlationId?: string): void {
    this.log(LogLevel.FATAL, service, message, data, error, correlationId);
  }

  /**
    * Log performance timing
    */
   timing(service: string, operation: string, duration: number, data?: unknown, correlationId?: string): void {
    this.log(LogLevel.INFO, service, `Operation completed: ${operation}`, {
      ...(data as Record<string, unknown> || {}),
      operation,
      duration,
      durationUnit: 'ms'
    }, undefined, correlationId, duration);
  }

  /**
   * Create child logger with service context
   */
  child(service: string): Logger {
    return new ChildLogger(this, service);
  }

  /**
   * Internal logging method
   */
  private log(
    level: LogLevel,
    service: string,
    message: string,
    data?: unknown,
    error?: Error,
    correlationId?: string,
    duration?: number
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      data,
      error,
      correlationId,
      duration
    };

    // Use strategy if available (Strategy Pattern)
    if (this.strategy) {
      const strategyEntry: StrategyLogEntry = {
        timestamp: entry.timestamp,
        level: level as unknown as StrategyLogLevel, // Map log levels
        service: entry.service,
        message: entry.message,
        data: entry.data,
        error: entry.error,
        correlationId: entry.correlationId,
        duration: entry.duration
      };
      this.strategy.log(strategyEntry);
      return;
    }

    // Fallback to traditional logging
    // Add to buffer
    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flush();
    }

    // Immediate logging for errors and above
    if (level >= LogLevel.ERROR) {
      this.writeEntry(entry);
    }
  }

  /**
   * Flush buffered log entries
   */
  private flush(): void {
    const entries = [...this.logBuffer];
    this.logBuffer = [];

    entries.forEach(entry => this.writeEntry(entry));
  }

  /**
   * Write log entry to configured outputs
   */
  private writeEntry(entry: LogEntry): void {
    const formattedEntry = this.formatEntry(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry, formattedEntry);
    }

    if (this.config.enableFile && this.config.logFile) {
      this.writeToFile(formattedEntry);
    }
  }

  /**
   * Format log entry based on configuration
   */
  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: LogLevel[entry.level],
        service: entry.service,
        message: entry.message,
        correlationId: entry.correlationId,
        duration: entry.duration,
        data: entry.data,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined
      });
    } else {
      const levelStr = LogLevel[entry.level].padEnd(5);
      const serviceStr = entry.service.padEnd(20);
      const correlationStr = entry.correlationId ? `[${entry.correlationId}] ` : '';
      const durationStr = entry.duration ? ` (${entry.duration}ms)` : '';
      const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';

      return `${entry.timestamp} ${levelStr} ${serviceStr} ${correlationStr}${entry.message}${durationStr}${dataStr}${errorStr}`;
    }
  }

  /**
   * Write to console with appropriate coloring
   */
  private writeToConsole(entry: LogEntry, formattedEntry: string): void {
    const stream = entry.level >= LogLevel.ERROR ? process.stderr : process.stdout;

    if (this.config.format === 'text') {
      // Add ANSI color codes for text format
      const color = this.getColorForLevel(entry.level);
      stream.write(`${color}${formattedEntry}\x1b[0m\n`);
    } else {
      stream.write(`${formattedEntry}\n`);
    }
  }

  /**
   * Get ANSI color code for log level
   */
  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m';  // Green
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.FATAL: return '\x1b[35m'; // Magenta
      default: return '\x1b[0m'; // Reset
    }
  }

  /**
   * Write to log file
   */
  private writeToFile(formattedEntry: string): void {
    try {
      if (!this.config.logFile) return;

      // Ensure log directory exists
      const logDir = path.dirname(this.config.logFile);

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      fs.appendFileSync(this.config.logFile, `${formattedEntry}\n`);
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Get current log statistics
   */
  getStats(): { buffered: number; totalLogged: number } {
    return {
      buffered: this.logBuffer.length,
      totalLogged: this.logBuffer.length // This is a simple implementation
    };
  }

  /**
   * Force flush all buffered entries
   */
  flushAll(): void {
    this.flush();
  }
}

/**
 * Child logger that inherits configuration but adds service context
 */
class ChildLogger extends Logger {
  private parentLogger: Logger;
  private serviceName: string;

  constructor(parent: Logger, service: string) {
    // Create a minimal config for the child - it will delegate to parent
    super({
      level: LogLevel.DEBUG,
      format: 'text',
      enableConsole: false,
      enableFile: false,
      maxFileSize: 0,
      maxFiles: 0
    });

    this.parentLogger = parent;
    this.serviceName = service;
  }

  debug(service: string, message: string, data?: unknown, correlationId?: string): void {
    this.parentLogger.debug(service || this.serviceName, message, data, correlationId);
  }

  info(service: string, message: string, data?: unknown, correlationId?: string): void {
    this.parentLogger.info(service || this.serviceName, message, data, correlationId);
  }

  warn(service: string, message: string, data?: unknown, correlationId?: string): void {
    this.parentLogger.warn(service || this.serviceName, message, data, correlationId);
  }

  error(service: string, message: string, error?: Error, data?: unknown, correlationId?: string): void {
    this.parentLogger.error(service || this.serviceName, message, error, data, correlationId);
  }

  fatal(service: string, message: string, error?: Error, data?: unknown, correlationId?: string): void {
    this.parentLogger.fatal(service || this.serviceName, message, error, data, correlationId);
  }

  timing(service: string, operation: string, duration: number, data?: Record<string, unknown>, correlationId?: string): void {
    this.parentLogger.timing(service || this.serviceName, operation, duration, data, correlationId);
  }

  child(service: string): Logger {
    return new ChildLogger(this.parentLogger, service);
  }
}

// Default configuration
const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  format: 'text',
  enableConsole: true,
  enableFile: false,
  logFile: './logs/design-patterns-mcp.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5
};

// Factory function
function createLogger(config?: Partial<LoggerConfig>): Logger {
  const finalConfig = { ...DEFAULT_LOGGER_CONFIG, ...config };
  return new Logger(finalConfig);
}

// Factory function with strategy injection (Strategy Pattern)
export function createLoggerWithStrategy(strategy: LoggingStrategy, config?: Partial<LoggerConfig>): Logger {
  const finalConfig = { ...DEFAULT_LOGGER_CONFIG, ...config, strategy };
  return new Logger(finalConfig);
}

// Global logger instance
export const logger = createLogger();