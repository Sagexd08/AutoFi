
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}


export interface MetricValue {
  type: MetricType;
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}


export interface MetricsCollector {
  
  increment(name: string, labels?: Record<string, string>): void;

  
  setGauge(name: string, value: number, labels?: Record<string, string>): void;

  
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;

  
  getMetrics(): readonly MetricValue[];

  
  clear(): void;
}


export interface MetricsConfig {
  rawMetricsEnabled?: boolean;
  maxRawMetrics?: number;
  metricsTTL?: number;
}

interface InternalMetricsConfig {
  rawMetricsEnabled: boolean;
  maxRawMetrics?: number;
  metricsTTL?: number;
}

export class InMemoryMetricsCollector implements MetricsCollector {
  private metrics: MetricValue[] = [];
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private readonly config: InternalMetricsConfig;
  private ttlCleanupInterval?: NodeJS.Timeout;

  constructor(config: MetricsConfig = {}) {
    this.config = {
      rawMetricsEnabled: config.rawMetricsEnabled ?? true,
      maxRawMetrics: config.maxRawMetrics,
      metricsTTL: config.metricsTTL,
    };

    if (this.config.metricsTTL && this.config.metricsTTL > 0) {
      const cleanupInterval = Math.min(this.config.metricsTTL / 2, 60000);
      this.ttlCleanupInterval = setInterval(() => {
        this.purgeExpiredMetrics();
      }, cleanupInterval);
    }
  }

  
  increment(name: string, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);

    if (this.config.rawMetricsEnabled) {
      this.addMetric({
        type: MetricType.COUNTER,
        name,
        value: current + 1,
        labels,
        timestamp: Date.now(),
      });
    }
  }

  
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);

    if (this.config.rawMetricsEnabled) {
      this.addMetric({
        type: MetricType.GAUGE,
        name,
        value,
        labels,
        timestamp: Date.now(),
      });
    }
  }

  
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key) ?? [];
    values.push(value);
    this.histograms.set(key, values);

    if (this.config.rawMetricsEnabled) {
      this.addMetric({
        type: MetricType.HISTOGRAM,
        name,
        value,
        labels,
        timestamp: Date.now(),
      });
    }
  }

  
  getMetrics(): readonly MetricValue[] {
    return [...this.metrics];
  }

  
  getCounters(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.counters.entries()) {
      result[key] = value;
    }
    return result;
  }

  
  getGauges(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.gauges.entries()) {
      result[key] = value;
    }
    return result;
  }

  
  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
  } | undefined {
    const key = this.getKey(name, labels);
    const values = this.histograms.get(key);
    if (!values || values.length === 0) {
      return undefined;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const min = values.reduce((a, b) => Math.min(a, b), Infinity);
    const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return {
      count: values.length,
      sum,
      min,
      max,
      avg: sum / values.length,
    };
  }

  
  clear(): void {
    this.metrics = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  destroy(): void {
    if (this.ttlCleanupInterval) {
      clearInterval(this.ttlCleanupInterval);
      this.ttlCleanupInterval = undefined;
    }
  }

  private addMetric(metric: MetricValue): void {
    if (!this.config.rawMetricsEnabled) {
      return;
    }

    this.metrics.push(metric);

    if (this.config.maxRawMetrics && this.config.maxRawMetrics > 0) {
      while (this.metrics.length > this.config.maxRawMetrics) {
        this.metrics.shift();
      }
    }
  }

  private purgeExpiredMetrics(): void {
    if (!this.config.metricsTTL || this.config.metricsTTL <= 0) {
      return;
    }

    const now = Date.now();
    const cutoff = now - this.config.metricsTTL;
    
    let i = 0;
    while (i < this.metrics.length) {
      const metric = this.metrics[i];
      if (metric && metric.timestamp < cutoff) {
        i++;
      } else {
        break;
      }
    }

    if (i > 0) {
      this.metrics = this.metrics.slice(i);
    }
  }

  
  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}
