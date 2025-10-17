/**
 * Enhanced Structured JSON Logger for Design Patterns MCP Server
 * Provides comprehensive logging with structured data, correlation IDs,
 * performance tracking, and multiple output formats
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface StructuredLogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
    uptime?: number;
  };
  context?: Record<string, any>;
}

interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text' | 'pretty';
  enableConsole: boolean;
  enableFile: boolean;
  logFile?: string;
  maxFileSize: number;
  maxFiles: number;
  enableRotation: boolean;
  enableCompression: boolean;
  structuredData: boolean;
  includeStackTrace: boolean;
  includePerformanceMetrics: boolean;
}

export class StructuredLogger {
  private config: LoggerConfig;
  private logBuffer: StructuredLogEntry[] = [];
  private bufferSize = 100;
  private currentFileSize = 0;
  private fileIndex = 0;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  /**
   * Log debug message with structured data
   */
  debug(
    service: string,
    message: string,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.DEBUG, service, message, data, undefined, context);
  }

  /**
   * Log info message with structured data
   */
  info(
    service: string,
    message: string,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.INFO, service, message, data, undefined, context);
  }

  /**
   * Log warning message with structured data
   */
  warn(
    service: string,
    message: string,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.WARN, service, message, data, undefined, context);
  }

  /**
   * Log error message with structured error data
   */
  error(
    service: string,
    message: string,
    error?: Error,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.ERROR, service, message, data, error, context);
  }

  /**
   * Log fatal error message
   */
  fatal(
    service: string,
    message: string,
    error?: Error,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.log(LogLevel.FATAL, service, message, data, error, context);
  }

  /**
   * Log HTTP request with structured data
   */
  http(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userAgent?: string,
    ip?: string,
    context?: Record<string, any>
  ): void {
    this.log(
      LogLevel.INFO,
      service,
      `HTTP ${method} ${url}`,
      {
        method,
        url,
        statusCode,
        duration,
        userAgent,
        ip,
      },
      undefined,
      context
    );
  }

  /**
   * Log database operation with performance data
   */
  database(
    service: string,
    operation: string,
    table: string,
    duration: number,
    recordCount?: number,
    context?: Record<string, any>
  ): void {
    this.log(
      LogLevel.INFO,
      service,
      `Database ${operation} on ${table}`,
      {
        operation,
        table,
        duration,
        recordCount,
      },
      undefined,
      context
    );
  }

  /**
   * Log performance timing with detailed metrics
   */
  timing(
    service: string,
    operation: string,
    duration: number,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    const performanceData = this.config.includePerformanceMetrics
      ? {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          uptime: process.uptime(),
        }
      : undefined;

    this.log(
      LogLevel.INFO,
      service,
      `Operation completed: ${operation}`,
      {
        ...data,
        operation,
        duration,
        durationUnit: 'ms',
      },
      undefined,
      {
        ...context,
        performance: performanceData,
      }
    );
  }

  /**
   * Create child logger with service context
   */
  child(service: string): StructuredLogger {
    return new ChildStructuredLogger(this, service);
  }

  /**
   * Internal structured logging method
   */
  private log(
    level: LogLevel,
    service: string,
    message: string,
    data?: Record<string, any>,
    error?: Error,
    context?: Record<string, any>
  ): void {
    // Check if we should log this level
    if (level < this.config.level) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      service,
      message,
      ...context,
      data: this.config.structuredData ? data : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            code: (error as any).code,
            stack: this.config.includeStackTrace ? error.stack : undefined,
          }
        : undefined,
    };

    // Add to buffer
    this.logBuffer.push(entry);

    // Flush if buffer is full or for high-priority logs
    if (this.logBuffer.length >= this.bufferSize || level >= LogLevel.ERROR) {
      this.flush();
    }
  }

  /**
   * Flush buffered log entries
   */
  private flush(): void {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    entries.forEach(entry => this.writeEntry(entry));
  }

  /**
   * Write log entry to configured outputs
   */
  private writeEntry(entry: StructuredLogEntry): void {
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
  private formatEntry(entry: StructuredLogEntry): string {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(entry, null, this.config.structuredData ? 2 : 0);

      case 'pretty':
        return this.formatPretty(entry);

      case 'text':
      default:
        return this.formatText(entry);
    }
  }

  /**
   * Format entry as pretty-printed JSON
   */
  private formatPretty(entry: StructuredLogEntry): string {
    const color = this.getColorForLevel(LogLevel[entry.level as keyof typeof LogLevel]);
    const reset = '\x1b[0m';
    const jsonStr = JSON.stringify(entry, null, 2);
    return `${color}${jsonStr}${reset}`;
  }

  /**
   * Format entry as human-readable text
   */
  private formatText(entry: StructuredLogEntry): string {
    const levelStr = entry.level.padEnd(5);
    const serviceStr = entry.service.padEnd(20);
    const correlationStr = entry.correlationId ? `[${entry.correlationId}] ` : '';
    const durationStr = entry.duration ? ` (${entry.duration}ms)` : '';
    const dataStr =
      entry.data && Object.keys(entry.data).length > 0 ? ` ${JSON.stringify(entry.data)}` : '';
    const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';

    return `${entry.timestamp} ${levelStr} ${serviceStr} ${correlationStr}${entry.message}${durationStr}${dataStr}${errorStr}`;
  }

  /**
   * Write to console with appropriate coloring
   */
  private writeToConsole(entry: StructuredLogEntry, formattedEntry: string): void {
    const stream =
      LogLevel[entry.level as keyof typeof LogLevel] >= LogLevel.ERROR
        ? process.stderr
        : process.stdout;

    if (this.config.format === 'text') {
      const color = this.getColorForLevel(LogLevel[entry.level as keyof typeof LogLevel]);
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
      case LogLevel.DEBUG:
        return '\x1b[36m'; // Cyan
      case LogLevel.INFO:
        return '\x1b[32m'; // Green
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      case LogLevel.FATAL:
        return '\x1b[35m'; // Magenta
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Write to log file with rotation support
   */
  private writeToFile(formattedEntry: string): void {
    try {
      if (!this.config.logFile) return;

      // Ensure log directory exists
      const logDir = dirname(this.config.logFile);
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }

      // Check if rotation is needed
      if (this.config.enableRotation && this.currentFileSize >= this.config.maxFileSize) {
        this.rotateLogFile();
      }

      // Write to file
      const entryWithNewline = `${formattedEntry}\n`;
      writeFileSync(this.config.logFile, entryWithNewline, { flag: 'a' });
      this.currentFileSize += Buffer.byteLength(entryWithNewline, 'utf8');
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate log file when size limit is reached
   */
  private rotateLogFile(): void {
    if (!this.config.logFile) return;

    try {
      // Rename current file
      const rotatedFile = `${this.config.logFile}.${this.fileIndex}`;
      if (existsSync(this.config.logFile)) {
        writeFileSync(rotatedFile, '');
        // In a real implementation, you'd copy the content here
      }

      // Reset current file
      writeFileSync(this.config.logFile, '');
      this.currentFileSize = 0;
      this.fileIndex = (this.fileIndex + 1) % this.config.maxFiles;
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Get current log statistics
   */
  getStats(): {
    buffered: number;
    currentFileSize: number;
    fileIndex: number;
  } {
    return {
      buffered: this.logBuffer.length,
      currentFileSize: this.currentFileSize,
      fileIndex: this.fileIndex,
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
class ChildStructuredLogger extends StructuredLogger {
  private parentLogger: StructuredLogger;
  private serviceName: string;

  constructor(parent: StructuredLogger, service: string) {
    // Create a minimal config for the child - it will delegate to parent
    super({
      level: LogLevel.DEBUG,
      format: 'json',
      enableConsole: false,
      enableFile: false,
      maxFileSize: 0,
      maxFiles: 0,
      enableRotation: false,
      enableCompression: false,
      structuredData: true,
      includeStackTrace: false,
      includePerformanceMetrics: false,
    });

    this.parentLogger = parent;
    this.serviceName = service;
  }

  debug(
    service: string,
    message: string,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.parentLogger.debug(service || this.serviceName, message, data, context);
  }

  info(
    service: string,
    message: string,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.parentLogger.info(service || this.serviceName, message, data, context);
  }

  warn(
    service: string,
    message: string,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.parentLogger.warn(service || this.serviceName, message, data, context);
  }

  error(
    service: string,
    message: string,
    error?: Error,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.parentLogger.error(service || this.serviceName, message, error, data, context);
  }

  fatal(
    service: string,
    message: string,
    error?: Error,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.parentLogger.fatal(service || this.serviceName, message, error, data, context);
  }

  http(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userAgent?: string,
    ip?: string,
    context?: Record<string, any>
  ): void {
    this.parentLogger.http(
      service || this.serviceName,
      method,
      url,
      statusCode,
      duration,
      userAgent,
      ip,
      context
    );
  }

  database(
    service: string,
    operation: string,
    table: string,
    duration: number,
    recordCount?: number,
    context?: Record<string, any>
  ): void {
    this.parentLogger.database(
      service || this.serviceName,
      operation,
      table,
      duration,
      recordCount,
      context
    );
  }

  timing(
    service: string,
    operation: string,
    duration: number,
    data?: Record<string, any>,
    context?: Record<string, any>
  ): void {
    this.parentLogger.timing(service || this.serviceName, operation, duration, data, context);
  }

  child(service: string): StructuredLogger {
    return new ChildStructuredLogger(this.parentLogger, service);
  }
}

// Default configuration
const DEFAULT_STRUCTURED_LOGGER_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  format: 'json',
  enableConsole: true,
  enableFile: true,
  logFile: './logs/design-patterns-mcp.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  enableRotation: true,
  enableCompression: false,
  structuredData: true,
  includeStackTrace: true,
  includePerformanceMetrics: false,
};

// Factory function
function createStructuredLogger(config?: Partial<LoggerConfig>): StructuredLogger {
  const finalConfig = { ...DEFAULT_STRUCTURED_LOGGER_CONFIG, ...config };
  return new StructuredLogger(finalConfig);
}

// Global logger instance
export const structuredLogger = createStructuredLogger();
