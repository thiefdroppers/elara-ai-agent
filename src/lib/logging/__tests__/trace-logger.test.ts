/**
 * Elara AI Agent - Trace Logger Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraceLogger } from '../trace-logger';

describe('TraceLogger', () => {
  let logger: TraceLogger;

  beforeEach(() => {
    logger = new TraceLogger({
      level: 'DEBUG',
      enableConsole: false,
      enableStorage: true,
      maxEntries: 100,
    });
  });

  describe('logging methods', () => {
    it('should log error messages', () => {
      logger.error('TestComponent', 'Test error message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].component).toBe('TestComponent');
      expect(logs[0].message).toBe('Test error message');
    });

    it('should log with data', () => {
      logger.info('TestComponent', 'Test info', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs[0].data).toEqual({ key: 'value' });
    });

    it('should respect log level hierarchy', () => {
      const warnLogger = new TraceLogger({
        level: 'WARN',
        enableConsole: false,
        enableStorage: true,
      });

      warnLogger.trace('Component', 'Should not log');
      warnLogger.debug('Component', 'Should not log');
      warnLogger.info('Component', 'Should not log');
      warnLogger.warn('Component', 'Should log');
      warnLogger.error('Component', 'Should log');

      const logs = warnLogger.getLogs();
      expect(logs).toHaveLength(2);
    });
  });

  describe('correlation IDs', () => {
    it('should generate correlation IDs', () => {
      const correlationId = logger.startOperation('test-operation');

      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
      expect(correlationId).toContain('test-operation');
    });

    it('should attach correlation ID to logs', () => {
      const correlationId = logger.startOperation('test-operation');
      logger.info('TestComponent', 'Test message');

      const logs = logger.getLogs();
      expect(logs[logs.length - 1].correlationId).toBe(correlationId);
    });

    it('should clear correlation ID on end operation', () => {
      logger.startOperation('test-operation');
      logger.endOperation();

      expect(logger.getCorrelationId()).toBeNull();
    });
  });

  describe('data sanitization', () => {
    it('should redact sensitive fields', () => {
      logger.info('TestComponent', 'Test', {
        username: 'user123',
        password: 'secret',
        apiKey: 'key123',
      });

      const logs = logger.getLogs();
      expect(logs[0].data?.password).toBe('[REDACTED]');
      expect(logs[0].data?.apiKey).toBe('[REDACTED]');
    });

    it('should sanitize URLs', () => {
      logger.info('TestComponent', 'Test', {
        url: 'https://example.com/path/to/resource?param=value',
      });

      const logs = logger.getLogs();
      expect(logs[0].data?.url).toBe('https://example.com');
    });
  });

  describe('log querying', () => {
    beforeEach(() => {
      logger.error('ComponentA', 'Error 1');
      logger.warn('ComponentB', 'Warning 1');
      logger.info('ComponentA', 'Info 1');
    });

    it('should get logs by level', () => {
      const errorLogs = logger.getLogsByLevel('ERROR');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('ERROR');
    });

    it('should get logs by component', () => {
      const componentALogs = logger.getLogsByComponent('ComponentA');
      expect(componentALogs).toHaveLength(2);
    });

    it('should export logs as JSON', () => {
      const exported = logger.exportLogs();
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should clear logs', () => {
      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('max entries', () => {
    it('should limit number of stored logs', () => {
      const smallLogger = new TraceLogger({
        level: 'DEBUG',
        enableConsole: false,
        enableStorage: true,
        maxEntries: 5,
      });

      for (let i = 0; i < 10; i++) {
        smallLogger.info('Test', `Message ${i}`);
      }

      const logs = smallLogger.getLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0].message).toBe('Message 5'); // Oldest kept
    });
  });
});
