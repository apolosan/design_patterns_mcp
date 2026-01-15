/**
 * Logging Strategy Pattern Implementation
 * Provides interchangeable logging strategies for different environments and needs
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export type LogData = string | number | boolean | null | { [key: string]: LogData } | LogData[];

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: LogData;
  error?: Error;
  correlationId?: string;
  duration?: number;
}

/**
 * Base interface for logging strategies
 */
export interface LoggingStrategy {
  log(entry: LogEntry): void;
  flush?(): void;
  getStats?(): { entriesLogged: number };
}

/**
 * Console logging strategy with color output
 */
export class ConsoleLoggingStrategy implements LoggingStrategy {
  private entriesLogged = 0;

  log(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    const stream = entry.level >= LogLevel.ERROR ? process.stderr : process.stdout;
    stream.write(`${this.getColorForLevel(entry.level)}${formatted}\x1b[0m\n`);
    this.entriesLogged++;
  }

  private formatEntry(entry: LogEntry): string {
    const levelStr = LogLevel[entry.level].padEnd(5);
    const serviceStr = entry.service.padEnd(20);
    const correlationStr = entry.correlationId ? `[${entry.correlationId}] ` : '';
    const durationStr = entry.duration ? ` (${entry.duration}ms)` : '';
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';

    return `${entry.timestamp} ${levelStr} ${serviceStr} ${correlationStr}${entry.message}${durationStr}${dataStr}${errorStr}`;
  }

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

  getStats(): { entriesLogged: number } {
    return { entriesLogged: this.entriesLogged };
  }
}

/**
 * File logging strategy with rotation support
 */
export class FileLoggingStrategy implements LoggingStrategy {
  private entriesLogged = 0;
  private buffer: string[] = [];
  private bufferSize = 10;

  constructor(
    private logFile: string,
    private maxFileSize: number = 10 * 1024 * 1024, // 10MB
    private maxFiles: number = 5
  ) {}

  log(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    this.buffer.push(formatted);
    this.entriesLogged++;

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const content = this.buffer.join('\n') + '\n';
      fs.appendFileSync(this.logFile, content);

      // Check if rotation is needed
      this.rotateIfNeeded();

    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Failed to write to log file:', error);
    } finally {
      this.buffer = [];
    }
  }

  private formatEntry(entry: LogEntry): string {
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
  }

  private rotateIfNeeded(): void {
    try {
      const stats = fs.statSync(this.logFile);

      if (stats.size >= this.maxFileSize) {
        // Rotate files
        for (let i = this.maxFiles - 1; i > 0; i--) {
          const oldFile = `${this.logFile}.${i}`;
          const newFile = `${this.logFile}.${i + 1}`;

          if (fs.existsSync(oldFile)) {
            if (i === this.maxFiles - 1) {
              fs.unlinkSync(oldFile); // Remove oldest
            } else {
              fs.renameSync(oldFile, newFile);
            }
          }
        }

        // Move current file
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  getStats(): { entriesLogged: number } {
    return { entriesLogged: this.entriesLogged };
  }
}

/**
 * Structured logging strategy for production monitoring
 */
export class StructuredLoggingStrategy implements LoggingStrategy {
  private entriesLogged = 0;

  constructor() {}

  log(entry: LogEntry): void {
    // In a real implementation, this would send to monitoring service
    // For now, just format as structured JSON to console
    const structured = this.formatStructured(entry);
    console.log(JSON.stringify(structured));
    this.entriesLogged++;
  }

  private formatStructured(entry: LogEntry) {
    return {
      timestamp: entry.timestamp,
      level: LogLevel[entry.level].toLowerCase(),
      service: entry.service,
      message: entry.message,
      correlationId: entry.correlationId,
      duration: entry.duration,
      data: entry.data,
      error: entry.error ? {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack?.split('\n').slice(0, 5) // Limit stack trace
      } : undefined,
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? 'unknown'
    };
  }

  getStats(): { entriesLogged: number } {
    return { entriesLogged: this.entriesLogged };
  }
}

/**
 * Null logging strategy for testing or silent operation
 */
export class NullLoggingStrategy implements LoggingStrategy {
  private entriesLogged = 0;

  log(_entry: LogEntry): void {
    this.entriesLogged++;
  }

  getStats(): { entriesLogged: number } {
    return { entriesLogged: this.entriesLogged };
  }
}

/**
 * Composite logging strategy that can use multiple strategies
 */
export class CompositeLoggingStrategy implements LoggingStrategy {
  private strategies: LoggingStrategy[] = [];
  private entriesLogged = 0;

  addStrategy(strategy: LoggingStrategy): void {
    this.strategies.push(strategy);
  }

  removeStrategy(strategy: LoggingStrategy): void {
    const index = this.strategies.indexOf(strategy);
    if (index > -1) {
      this.strategies.splice(index, 1);
    }
  }

  log(entry: LogEntry): void {
    this.strategies.forEach(strategy => strategy.log(entry));
    this.entriesLogged++;
  }

  flush(): void {
    this.strategies.forEach(strategy => strategy.flush?.());
  }

  getStats(): { entriesLogged: number; strategies?: { entriesLogged: number }[] } {
    const strategyStats = this.strategies.map(s => s.getStats?.() ?? { entriesLogged: 0 });
    return {
      entriesLogged: this.entriesLogged,
      strategies: strategyStats
    };
  }
}
export class LoggerManager {
  private strategies: LoggingStrategy[] = [];
  private minLevel: LogLevel = LogLevel.INFO;
  private serviceName?: string;

  constructor(minLevel: LogLevel = LogLevel.INFO, serviceName?: string) {
    this.minLevel = minLevel;
    this.serviceName = serviceName;
  }

  addStrategy(strategy: LoggingStrategy): void {
    this.strategies.push(strategy);
  }

  removeStrategy(strategy: LoggingStrategy): void {
    const index = this.strategies.indexOf(strategy);
    if (index > -1) {
      this.strategies.splice(index, 1);
    }
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  createLogger(service?: string): Logger {
    return new Logger(this, service ?? this.serviceName);
  }

  log(entry: LogEntry): void {
    if (entry.level < this.minLevel) return;

    this.strategies.forEach(strategy => strategy.log(entry));
  }

  flush(): void {
    this.strategies.forEach(strategy => strategy.flush?.());
  }

  getStats() {
    return {
      strategies: this.strategies.length,
      minLevel: LogLevel[this.minLevel],
      strategyStats: this.strategies.map(s => s.getStats?.())
    };
  }
}

/**
 * Logger class that uses strategies
 */
export class Logger {
  constructor(
    private manager: LoggerManager,
    private serviceName?: string
  ) {}

  debug(message: string, data?: LogData, correlationId?: string): void {
    this.log(LogLevel.DEBUG, message, data, undefined, correlationId);
  }

  info(message: string, data?: LogData, correlationId?: string): void {
    this.log(LogLevel.INFO, message, data, undefined, correlationId);
  }

  warn(message: string, data?: LogData, correlationId?: string): void {
    this.log(LogLevel.WARN, message, data, undefined, correlationId);
  }

  error(message: string, error?: Error, data?: LogData, correlationId?: string): void {
    this.log(LogLevel.ERROR, message, data, error, correlationId);
  }

  fatal(message: string, error?: Error, data?: LogData, correlationId?: string): void {
    this.log(LogLevel.FATAL, message, data, error, correlationId);
  }

  timing(operation: string, duration: number, data?: LogData, correlationId?: string): void {
    this.log(LogLevel.INFO, `Operation completed: ${operation}`, {
      ...(data as Record<string, LogData> || {}),
      operation,
      duration,
      durationUnit: 'ms'
    }, undefined, correlationId, duration);
  }

  child(service: string): Logger {
    return new Logger(this.manager, service);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: LogData,
    error?: Error,
    correlationId?: string,
    duration?: number
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName ?? 'unknown',
      message,
      data,
      error,
      correlationId,
      duration
    };

    this.manager.log(entry);
  }
}

// Export utility functions for easy setup
export function createConsoleLogger(service?: string): Logger {
  const manager = new LoggerManager(LogLevel.INFO, service);
  manager.addStrategy(new ConsoleLoggingStrategy());
  return manager.createLogger();
}

export function createFileLogger(logFile: string, service?: string): Logger {
  const manager = new LoggerManager(LogLevel.INFO, service);
  manager.addStrategy(new FileLoggingStrategy(logFile));
  return manager.createLogger();
}

export function createProductionLogger(logFile?: string, service?: string): Logger {
  const manager = new LoggerManager(LogLevel.INFO, service);
  manager.addStrategy(new ConsoleLoggingStrategy());
  if (logFile) {
    manager.addStrategy(new FileLoggingStrategy(logFile));
  }
  manager.addStrategy(new StructuredLoggingStrategy());
  return manager.createLogger();
}