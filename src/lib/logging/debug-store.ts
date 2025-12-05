/**
 * Elara AI Agent - Debug Store
 *
 * Centralized store for debug information, accessible from UI.
 * Useful for troubleshooting and displaying internal state.
 */

import { traceLogger } from './trace-logger';
import { performanceMonitor } from './performance-monitor';

// ============================================================================
// TYPES
// ============================================================================

export interface DebugInfo {
  timestamp: number;
  category: string;
  data: Record<string, any>;
}

export interface SystemHealth {
  llmEngine: 'uninitialized' | 'initializing' | 'ready' | 'error';
  edgeEngine: 'uninitialized' | 'ready' | 'error';
  cloudAPI: 'unknown' | 'healthy' | 'degraded' | 'offline';
  cacheStatus: {
    size: number;
    hitRate: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
}

// ============================================================================
// DEBUG STORE CLASS
// ============================================================================

export class DebugStore {
  private debugInfo: DebugInfo[] = [];
  private readonly maxEntries = 500;
  private systemHealth: SystemHealth = {
    llmEngine: 'uninitialized',
    edgeEngine: 'uninitialized',
    cloudAPI: 'unknown',
    cacheStatus: { size: 0, hitRate: 0 },
    memoryUsage: { heapUsed: 0, heapTotal: 0 },
  };

  // --------------------------------------------------------------------------
  // Recording Debug Info
  // --------------------------------------------------------------------------

  /**
   * Add debug information
   */
  add(category: string, data: Record<string, any>): void {
    const info: DebugInfo = {
      timestamp: Date.now(),
      category,
      data,
    };

    this.debugInfo.push(info);

    // Trim old entries
    if (this.debugInfo.length > this.maxEntries) {
      this.debugInfo.shift();
    }

    traceLogger.debug('DebugStore', `Added debug info: ${category}`, data);
  }

  /**
   * Add LLM debug info
   */
  addLLMInfo(data: Record<string, any>): void {
    this.add('llm', data);
  }

  /**
   * Add edge scan debug info
   */
  addEdgeScanInfo(data: Record<string, any>): void {
    this.add('edge_scan', data);
  }

  /**
   * Add cloud scan debug info
   */
  addCloudScanInfo(data: Record<string, any>): void {
    this.add('cloud_scan', data);
  }

  /**
   * Add agent debug info
   */
  addAgentInfo(data: Record<string, any>): void {
    this.add('agent', data);
  }

  // --------------------------------------------------------------------------
  // System Health
  // --------------------------------------------------------------------------

  /**
   * Update system health
   */
  updateHealth(updates: Partial<SystemHealth>): void {
    this.systemHealth = { ...this.systemHealth, ...updates };
    this.add('system_health', this.systemHealth);
  }

  /**
   * Get current system health
   */
  getHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Check if all systems are healthy
   */
  isHealthy(): boolean {
    return (
      (this.systemHealth.llmEngine === 'ready' || this.systemHealth.llmEngine === 'uninitialized') &&
      (this.systemHealth.edgeEngine === 'ready' || this.systemHealth.edgeEngine === 'uninitialized') &&
      this.systemHealth.cloudAPI !== 'offline'
    );
  }

  // --------------------------------------------------------------------------
  // Querying Debug Info
  // --------------------------------------------------------------------------

  /**
   * Get all debug info
   */
  getAll(): DebugInfo[] {
    return [...this.debugInfo];
  }

  /**
   * Get debug info by category
   */
  getByCategory(category: string): DebugInfo[] {
    return this.debugInfo.filter((info) => info.category === category);
  }

  /**
   * Get debug info in time range
   */
  getByTimeRange(startTime: number, endTime: number): DebugInfo[] {
    return this.debugInfo.filter(
      (info) => info.timestamp >= startTime && info.timestamp <= endTime
    );
  }

  /**
   * Get latest debug info for a category
   */
  getLatest(category: string): DebugInfo | null {
    const items = this.getByCategory(category);
    return items.length > 0 ? items[items.length - 1] : null;
  }

  // --------------------------------------------------------------------------
  // Export & Clear
  // --------------------------------------------------------------------------

  /**
   * Export debug info as JSON
   */
  export(): string {
    return JSON.stringify(
      {
        debugInfo: this.debugInfo,
        systemHealth: this.systemHealth,
        logs: traceLogger.getLogs(),
        performance: performanceMonitor.getSummary(),
      },
      null,
      2
    );
  }

  /**
   * Clear all debug info
   */
  clear(): void {
    this.debugInfo = [];
  }

  /**
   * Clear debug info for a category
   */
  clearCategory(category: string): void {
    this.debugInfo = this.debugInfo.filter((info) => info.category !== category);
  }

  // --------------------------------------------------------------------------
  // UI Utilities
  // --------------------------------------------------------------------------

  /**
   * Get formatted debug summary for UI
   */
  getFormattedSummary(): string {
    const summary = [
      '=== Elara AI Agent Debug Summary ===',
      '',
      '--- System Health ---',
      `LLM Engine: ${this.systemHealth.llmEngine}`,
      `Edge Engine: ${this.systemHealth.edgeEngine}`,
      `Cloud API: ${this.systemHealth.cloudAPI}`,
      `Cache Hit Rate: ${(this.systemHealth.cacheStatus.hitRate * 100).toFixed(0)}%`,
      `Memory: ${(this.systemHealth.memoryUsage.heapUsed / 1024 / 1024).toFixed(0)}MB / ${(this.systemHealth.memoryUsage.heapTotal / 1024 / 1024).toFixed(0)}MB`,
      '',
      '--- Performance Metrics ---',
    ];

    const perfSummary = performanceMonitor.getSummary();
    for (const [name, metrics] of Object.entries(perfSummary)) {
      summary.push(`${name}:`);
      summary.push(`  Avg: ${metrics.avg.toFixed(0)}ms`);
      summary.push(`  P95: ${metrics.p95.toFixed(0)}ms`);
      summary.push(`  Count: ${metrics.count}`);
    }

    summary.push('');
    summary.push('--- Recent Debug Entries ---');
    const recent = this.debugInfo.slice(-10);
    for (const info of recent) {
      const time = new Date(info.timestamp).toISOString();
      summary.push(`[${time}] ${info.category}: ${JSON.stringify(info.data)}`);
    }

    return summary.join('\n');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const debugStore = new DebugStore();
