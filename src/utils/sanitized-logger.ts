/**
 * Sanitized Logger Utility
 * Automatically redacts sensitive data from logs
 * Micro-improvement: Structured logging with automatic secrets masking
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  sanitizedData?: Record<string, unknown>;
}

export interface SanitizedLoggerConfig {
  level: LogLevel;
  enableCorrelationId: boolean;
  sensitiveKeys: string[];
  outputFormat: 'json' | 'pretty';
}

const DEFAULT_SENSITIVE_KEYS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey',
  'access_token', 'refresh_token', 'authorization', 'credential',
  'private_key', 'privatekey', 'key', 'salt', 'hash', 'signature',
  'connection_string', 'conn_str', 'database_url', 'db_password',
  'client_secret', 'session_id', 'user_id', 'user_token'
];

export class SanitizedLogger {
  private config: SanitizedLoggerConfig;
  private correlationId: string | null = null;
  private correlationContext: Map<string, string> = new Map();

  constructor(config?: Partial<SanitizedLoggerConfig>) {
    this.config = {
      level: config?.level ?? LogLevel.INFO,
      enableCorrelationId: config?.enableCorrelationId ?? true,
      sensitiveKeys: config?.sensitiveKeys ?? [...DEFAULT_SENSITIVE_KEYS],
      outputFormat: config?.outputFormat ?? 'json',
    };
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
    this.correlationContext.set('correlationId', id);
  }

  clearCorrelationId(): void {
    this.correlationId = null;
    this.correlationContext.delete('correlationId');
  }

  getCorrelationId(): string | null {
    return this.correlationId;
  }

  debug(component: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  info(component: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  warn(component: string, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  error(component: string, message: string, error?: Error, data?: Record<string, unknown>): void {
    const errorData = error ? {
      ...data,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : data;
    this.log(LogLevel.ERROR, component, message, errorData);
  }

  private log(level: LogLevel, component: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const sanitizedData = data ? this.sanitize(data) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      correlationId: this.correlationId ?? undefined,
      data,
      sanitizedData
    };

    this.output(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (this.isSensitiveKey(lowerKey)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? this.sanitize(item as Record<string, unknown>)
            : item
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private isSensitiveKey(key: string): boolean {
    return this.config.sensitiveKeys.some(sensitive =>
      key.includes(sensitive) || sensitive.includes(key)
    );
  }

  private output(entry: LogEntry): void {
    if (this.config.outputFormat === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      const time = entry.timestamp.split('T')[1].replace('Z', '');
      const correlation = entry.correlationId ? `[${entry.correlationId}]` : '';
      console.log(
        `${time} ${entry.level.toUpperCase().padEnd(5)} ${entry.component.padEnd(15)} ${correlation} ${entry.message}`
      );
      if (entry.sanitizedData) {
        console.log('  Data:', JSON.stringify(entry.sanitizedData, null, 2));
      }
    }
  }

  startOperation(operationName: string): OperationLogger {
    const operationId = crypto.randomUUID();
    this.setCorrelationId(operationId);
    return new OperationLogger(this, operationName);
  }
}

export class OperationLogger {
  private parent: SanitizedLogger;
  private operationName: string;
  private steps: Array<{ step: string; duration: number; data?: Record<string, unknown> }> = [];
  private startTime: number;

  constructor(parent: SanitizedLogger, operationName: string) {
    this.parent = parent;
    this.operationName = operationName;
    this.startTime = Date.now();
    this.parent.info('operation', `Starting operation: ${operationName}`);
  }

  logStep(step: string, data?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;
    this.steps.push({ step, duration, data });
    this.parent.debug('operation', `Step: ${step}`, data);
  }

  complete(success: boolean, finalData?: Record<string, unknown>): void {
    const totalDuration = Date.now() - this.startTime;
    const status = success ? 'completed' : 'failed';

    this.parent.info('operation', `Operation ${this.operationName} ${status}`, {
      totalDuration,
      stepCount: this.steps.length,
      steps: this.steps,
      ...finalData
    });

    this.parent.clearCorrelationId();
  }

  fail(error: Error): void {
    this.complete(false, { error: error.message });
  }
}

export const sanitizedLogger = new SanitizedLogger({
  level: LogLevel.INFO,
  enableCorrelationId: true,
  outputFormat: 'json'
});
