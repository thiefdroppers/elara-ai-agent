/**
 * Elara AI Agent - Trace Logger
 *
 * Comprehensive logging framework with correlation IDs for debugging.
 * Privacy-safe: never logs PII or sensitive data.
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  correlationId?: string;
  data?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxEntries: number;
}

// ============================================================================
// LOG LEVEL HIERARCHY
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

// ============================================================================
// TRACE LOGGER CLASS
// ============================================================================

export class TraceLogger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private correlationId: string | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'INFO',
      enableConsole: config.enableConsole ?? true,
      enableStorage: config.enableStorage ?? true,
      maxEntries: config.maxEntries || 1000,
    };
  }

  // --------------------------------------------------------------------------
  // Logging Methods
  // --------------------------------------------------------------------------

  error(component: string, message: string, error?: Error, data?: Record<string, any>): void {
    this.log('ERROR', component, message, data, error);
  }

  warn(component: string, message: string, data?: Record<string, any>): void {
    this.log('WARN', component, message, data);
  }

  info(component: string, message: string, data?: Record<string, any>): void {
    this.log('INFO', component, message, data);
  }

  debug(component: string, message: string, data?: Record<string, any>): void {
    this.log('DEBUG', component, message, data);
  }

  trace(component: string, message: string, data?: Record<string, any>): void {
    this.log('TRACE', component, message, data);
  }

  // --------------------------------------------------------------------------
  // Core Logging
  // --------------------------------------------------------------------------

  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: Record<string, any>,
    error?: Error
  ): void {
    // Check if log level should be emitted
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      component,
      message,
      correlationId: this.correlationId || undefined,
      data: data ? this.sanitizeData(data) : undefined,
      error,
    };

    // Store in memory
    if (this.config.enableStorage) {
      this.storeEntry(entry);
    }

    // Output to console
    if (this.config.enableConsole) {
      this.consoleOutput(entry);
    }
  }

  // --------------------------------------------------------------------------
  // Correlation IDs
  // --------------------------------------------------------------------------

  /**
   * Start a new operation with correlation ID
   */
  startOperation(operationName: string): string {
    this.correlationId = this.generateCorrelationId(operationName);
    this.trace('TraceLogger', `Operation started: ${operationName}`, {
      correlationId: this.correlationId,
    });
    return this.correlationId;
  }

  /**
   * End the current operation
   */
  endOperation(): void {
    if (this.correlationId) {
      this.trace('TraceLogger', 'Operation ended', {
        correlationId: this.correlationId,
      });
      this.correlationId = null;
    }
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | null {
    return this.correlationId;
  }

  /**
   * Set correlation ID manually
   */
  setCorrelationId(id: string | null): void {
    this.correlationId = id;
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Check if log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.config.level];
  }

  /**
   * Store log entry in memory
   */
  private storeEntry(entry: LogEntry): void {
    this.logs.push(entry);

    // Trim logs if exceeded max
    if (this.logs.length > this.config.maxEntries) {
      this.logs.shift(); // Remove oldest
    }
  }

  /**
   * Output log entry to console
   */
  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.level}] [${entry.component}]${entry.correlationId ? ` [${entry.correlationId.slice(0, 8)}]` : ''}`;
    const timestamp = new Date(entry.timestamp).toISOString();

    switch (entry.level) {
      case 'ERROR':
        console.error(`${prefix} ${entry.message}`, entry.data || '', entry.error || '');
        break;
      case 'WARN':
        console.warn(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'INFO':
        console.info(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'DEBUG':
      case 'TRACE':
        console.log(`${prefix} ${entry.message}`, entry.data || '');
        break;
    }
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(operationName: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${operationName}_${timestamp}_${random}`;
  }

  /**
   * Sanitize data to remove PII
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize URLs (keep domain, strip path/query)
      if (typeof value === 'string' && this.isURL(value)) {
        try {
          const url = new URL(value);
          sanitized[key] = `${url.protocol}//${url.hostname}`;
        } catch {
          sanitized[key] = '[INVALID_URL]';
        }
        continue;
      }

      // Copy non-sensitive values
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if field name suggests sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      'token',
      'password',
      'secret',
      'key',
      'auth',
      'credential',
      'api_key',
      'apikey',
      'email',
      'phone',
      'ssn',
      'credit',
    ];

    const lowerField = fieldName.toLowerCase();
    return sensitivePatterns.some((pattern) => lowerField.includes(pattern));
  }

  /**
   * Check if string is a URL
   */
  private isURL(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Query & Export
  // --------------------------------------------------------------------------

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((entry) => entry.level === level);
  }

  /**
   * Get logs by component
   */
  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter((entry) => entry.component === component);
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.logs.filter((entry) => entry.correlationId === correlationId);
  }

  /**
   * Get logs in time range
   */
  getLogsByTimeRange(startTime: number, endTime: number): LogEntry[] {
    return this.logs.filter((entry) => entry.timestamp >= startTime && entry.timestamp <= endTime);
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// ============================================================================
// COMPONENT-SPECIFIC LOGGERS
// ============================================================================

/**
 * Create a logger scoped to a specific component
 */
export function createLogger(component: string): {
  error: (message: string, error?: Error, data?: Record<string, any>) => void;
  warn: (message: string, data?: Record<string, any>) => void;
  info: (message: string, data?: Record<string, any>) => void;
  debug: (message: string, data?: Record<string, any>) => void;
  trace: (message: string, data?: Record<string, any>) => void;
} {
  return {
    error: (message, error, data) => traceLogger.error(component, message, error, data),
    warn: (message, data) => traceLogger.warn(component, message, data),
    info: (message, data) => traceLogger.info(component, message, data),
    debug: (message, data) => traceLogger.debug(component, message, data),
    trace: (message, data) => traceLogger.trace(component, message, data),
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const traceLogger = new TraceLogger({
  level: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
  enableConsole: true,
  enableStorage: true,
  maxEntries: 1000,
});
