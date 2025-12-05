/**
 * Elara AI Agent - Performance Monitor
 *
 * Collects and aggregates performance metrics for monitoring and optimization.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'tokens' | 'bytes' | 'count';
  timestamp: number;
  tags?: Record<string, string>;
}

export interface AggregatedMetrics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private readonly maxMetricsPerName = 100; // Keep last 100 samples per metric

  // --------------------------------------------------------------------------
  // Recording Metrics
  // --------------------------------------------------------------------------

  /**
   * Record a performance metric
   */
  record(name: string, value: number, unit: 'ms' | 'tokens' | 'bytes' | 'count' = 'ms', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Trim old metrics
    if (metrics.length > this.maxMetricsPerName) {
      metrics.shift();
    }
  }

  /**
   * Start a timer
   */
  startTimer(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(name, duration, 'ms');
    };
  }

  /**
   * Measure async function execution time
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.startTimer(name);
    try {
      return await fn();
    } finally {
      endTimer();
    }
  }

  /**
   * Measure sync function execution time
   */
  measureSync<T>(name: string, fn: () => T): T {
    const endTimer = this.startTimer(name);
    try {
      return fn();
    } finally {
      endTimer();
    }
  }

  // --------------------------------------------------------------------------
  // Querying Metrics
  // --------------------------------------------------------------------------

  /**
   * Get all metrics for a name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get aggregated statistics for a metric
   */
  getAggregated(name: string): AggregatedMetrics | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);

    return {
      count: values.length,
      sum: values.reduce((sum, v) => sum + v, 0),
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: this.percentile(values, 0.50),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }

  /**
   * Get metrics in time range
   */
  getMetricsInRange(name: string, startTime: number, endTime: number): PerformanceMetric[] {
    return this.getMetrics(name).filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Get all metric names
   */
  getAllMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, AggregatedMetrics> {
    const summary: Record<string, AggregatedMetrics> = {};

    for (const name of this.getAllMetricNames()) {
      const agg = this.getAggregated(name);
      if (agg) {
        summary[name] = agg;
      }
    }

    return summary;
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Clear metrics for a specific name
   */
  clearMetric(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    const data: Record<string, PerformanceMetric[]> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      data[name] = metrics;
    }

    return JSON.stringify(data, null, 2);
  }
}

// ============================================================================
// PREDEFINED METRIC NAMES
// ============================================================================

export const MetricNames = {
  // LLM Metrics
  LLM_FIRST_TOKEN_LATENCY: 'llm.first_token_latency',
  LLM_TOTAL_LATENCY: 'llm.total_latency',
  LLM_TOKENS_PER_SECOND: 'llm.tokens_per_second',
  LLM_TOKENS_GENERATED: 'llm.tokens_generated',
  LLM_CONTEXT_SIZE: 'llm.context_size',

  // Edge Scan Metrics
  EDGE_SCAN_LATENCY: 'edge.scan_latency',
  EDGE_FEATURE_EXTRACTION: 'edge.feature_extraction',
  EDGE_MODEL_INFERENCE: 'edge.model_inference',
  EDGE_CONFIDENCE: 'edge.confidence',
  EDGE_PROBABILITY: 'edge.probability',

  // Cloud Scan Metrics
  CLOUD_HYBRID_LATENCY: 'cloud.hybrid_latency',
  CLOUD_DEEP_LATENCY: 'cloud.deep_latency',
  CLOUD_API_LATENCY: 'cloud.api_latency',

  // Agent Metrics
  AGENT_INTENT_CLASSIFICATION: 'agent.intent_classification',
  AGENT_RESPONSE_GENERATION: 'agent.response_generation',
  AGENT_TOTAL_LATENCY: 'agent.total_latency',

  // Cache Metrics
  CACHE_HIT_RATE: 'cache.hit_rate',
  CACHE_LOOKUP_LATENCY: 'cache.lookup_latency',
  CACHE_WRITE_LATENCY: 'cache.write_latency',

  // Memory Metrics
  MEMORY_HEAP_USED: 'memory.heap_used',
  MEMORY_HEAP_TOTAL: 'memory.heap_total',
  MEMORY_EXTERNAL: 'memory.external',
} as const;

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const performanceMonitor = new PerformanceMonitor();
