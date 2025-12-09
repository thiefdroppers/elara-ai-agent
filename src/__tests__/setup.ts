/**
 * Elara AI Agent - Test Setup
 *
 * Global test setup and mocks for vitest
 */

import { vi } from 'vitest';

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    connect: vi.fn(),
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
} as any;

// Mock crypto.randomUUID for tests
// Note: In jsdom, crypto is read-only, so we use Object.defineProperty
if (typeof global.crypto?.randomUUID !== 'function') {
  Object.defineProperty(global, 'crypto', {
    value: {
      ...global.crypto,
      randomUUID: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
    writable: true,
    configurable: true,
  });
}

// Mock performance.now() for consistent test results
global.performance = {
  ...global.performance,
  now: () => Date.now(),
} as any;

// Suppress console logs in tests (optional)
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
