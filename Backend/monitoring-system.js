import { EventEmitter } from 'events';
import os from 'os';
import process from 'process';
import logger from './utils/logger.js';

export class MonitoringSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      enableMetrics: config.enableMetrics !== false,
      enableAlerts: config.enableAlerts !== false,
      enableLogging: config.enableLogging !== false,
      metricsInterval: config.metricsInterval || 30000,
      alertThresholds: {
        cpuUsage: config.cpuThreshold || 80,
        memoryUsage: config.memoryThreshold || 80,
        errorRate: config.errorRateThreshold || 10,
        responseTime: config.responseTimeThreshold || 5000
      },
      ...config
    };
    
    this.metrics = {
      system: {},
      application: {},
      blockchain: {},
      performance: {}
    };
    
    this.alerts = [];
    this.logs = [];
    this.startTime = Date.now();
    this.interval = null;
    
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
    
    if (this.config.enableLogging) {
      this.setupLogging();
    }
    
    if (this.config.enableAlerts) {
      this.setupAlerts();
    }
  }

  startMetricsCollection() {
    this.interval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
    
    this.collectMetrics();
  }

  collectMetrics() {
    try {
      this.metrics.system = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: this.getCpuUsage(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid,
        timestamp: new Date().toISOString()
      };
      
      this.metrics.application = {
        requests: this.getRequestMetrics(),
        errors: this.getErrorMetrics(),
        activeConnections: this.getActiveConnections(),
        timestamp: new Date().toISOString()
      };
      
      this.metrics.performance = {
        responseTime: this.getAverageResponseTime(),
        throughput: this.getThroughput(),
        latency: this.getLatency(),
        timestamp: new Date().toISOString()
      };
      
      this.emit('metricsCollected', this.metrics);
      
      if (this.config.enableAlerts) {
        this.checkAlerts();
      }
      
    } catch (error) {
      logger.error('Error collecting metrics', { error: error.message, stack: error.stack });
      this.emit('metricsError', error);
    }
  }

  getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length,
      usage: 100 - ~~(100 * totalIdle / totalTick)
    };
  }

  getRequestMetrics() {
    return {
      total: this.requestCount || 0,
      successful: this.successCount || 0,
      failed: this.errorCount || 0,
      rate: this.requestRate || 0
    };
  }

  getErrorMetrics() {
    return {
      total: this.errorCount || 0,
      rate: this.errorRate || 0,
      lastError: this.lastError || null
    };
  }

  getActiveConnections() {
    return this.activeConnections || 0;
  }

  getAverageResponseTime() {
    return this.averageResponseTime || 0;
  }

  getThroughput() {
    return this.throughput || 0;
  }

  getLatency() {
    return this.latency || 0;
  }

  setupLogging() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      this.addLog('info', args.join(' '));
      originalLog.apply(console, args);
    };
    
    console.error = (...args) => {
      this.addLog('error', args.join(' '));
      originalError.apply(console, args);
    };
    
    console.warn = (...args) => {
      this.addLog('warn', args.join(' '));
      originalWarn.apply(console, args);
    };
  }

  addLog(level, message) {
    const log = {
      level,
      message,
      timestamp: new Date().toISOString(),
      pid: process.pid
    };
    
    this.logs.push(log);
    
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
    
    this.emit('log', log);
  }

  setupAlerts() {
    this.alertConditions = [
      {
        name: 'High CPU Usage',
        check: () => this.metrics.system.cpu?.usage > this.config.alertThresholds.cpuUsage,
        severity: 'warning'
      },
      {
        name: 'High Memory Usage',
        check: () => {
          const memUsage = this.metrics.system.memory;
          const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
          return memPercent > this.config.alertThresholds.memoryUsage;
        },
        severity: 'warning'
      },
      {
        name: 'High Error Rate',
        check: () => this.metrics.application.errors?.rate > this.config.alertThresholds.errorRate,
        severity: 'critical'
      },
      {
        name: 'High Response Time',
        check: () => this.metrics.performance.responseTime > this.config.alertThresholds.responseTime,
        severity: 'warning'
      }
    ];
  }

  checkAlerts() {
    this.alertConditions.forEach(condition => {
      try {
        if (condition.check()) {
          this.triggerAlert(condition);
        }
      } catch (error) {
        logger.error('Error checking alert condition', { error: error.message, alert: condition.name });
      }
    });
  }

  triggerAlert(condition) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: condition.name,
      severity: condition.severity,
      timestamp: new Date().toISOString(),
      resolved: false,
      metrics: { ...this.metrics }
    };
    
    const existingAlert = this.alerts.find(a => 
      a.name === condition.name && !a.resolved
    );
    
    if (!existingAlert) {
      this.alerts.push(alert);
      this.emit('alert', alert);
      
      setTimeout(() => {
        this.resolveAlert(alert.id);
      }, 5 * 60 * 1000);
    }
  }

  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.emit('alertResolved', alert);
    }
  }

  updateBlockchainMetrics(chainId, metrics) {
    this.metrics.blockchain[chainId] = {
      ...metrics,
      timestamp: new Date().toISOString()
    };
    
    this.emit('blockchainMetricsUpdated', { chainId, metrics });
  }

  updateRequestMetrics(requestData) {
    this.requestCount = (this.requestCount || 0) + 1;
    
    if (requestData.success) {
      this.successCount = (this.successCount || 0) + 1;
    } else {
      this.errorCount = (this.errorCount || 0) + 1;
      this.lastError = requestData.error;
    }
    
    if (requestData.duration) {
      this.updateResponseTime(requestData.duration);
    }
  }

  updateResponseTime(duration) {
    if (!this.responseTimes) {
      this.responseTimes = [];
    }
    
    this.responseTimes.push(duration);
    
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
    
    this.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  updateConnectionCount(count) {
    this.activeConnections = count;
  }

  getHealthStatus() {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const cpu = this.getCpuUsage();
    
    const health = {
      status: 'healthy',
      uptime,
      memory: {
        used: memory.heapUsed,
        total: memory.heapTotal,
        percentage: (memory.heapUsed / memory.heapTotal) * 100
      },
      cpu: {
        usage: cpu.usage
      },
      alerts: this.alerts.filter(a => !a.resolved).length,
      timestamp: new Date().toISOString()
    };
    
    if (health.alerts > 0) {
      const criticalAlerts = this.alerts.filter(a => !a.resolved && a.severity === 'critical');
      health.status = criticalAlerts.length > 0 ? 'critical' : 'warning';
    }
    
    if (health.memory.percentage > 90 || health.cpu.usage > 90) {
      health.status = 'critical';
    }
    
    return health;
  }

  getMetrics(timeRange = '1h') {
    const now = Date.now();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = now - (60 * 60 * 1000);
        break;
      case '6h':
        startTime = now - (6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (60 * 60 * 1000);
    }
    
    return {
      system: this.metrics.system,
      application: this.metrics.application,
      blockchain: this.metrics.blockchain,
      performance: this.metrics.performance,
      alerts: this.alerts.filter(a => new Date(a.timestamp) >= new Date(startTime)),
      logs: this.logs.filter(l => new Date(l.timestamp) >= new Date(startTime))
    };
  }

  exportMetrics(format = 'json') {
    const data = {
      metrics: this.metrics,
      alerts: this.alerts,
      logs: this.logs.slice(-100), // Last 100 logs
      health: this.getHealthStatus(),
      stats: this.getStats()
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.exportToCSV(data);
      default:
        return data;
    }
  }

  exportToCSV(data) {
    const headers = ['timestamp', 'cpu_usage', 'memory_usage', 'request_count', 'error_count'];
    const rows = [headers.join(',')];
    
    rows.push([
      new Date().toISOString(),
      data.metrics.system.cpu?.usage || 0,
      data.metrics.system.memory?.heapUsed || 0,
      data.metrics.application.requests?.total || 0,
      data.metrics.application.errors?.total || 0
    ].join(','));
    
    return rows.join('\n');
  }

  getStats() {
    return {
      uptime: process.uptime(),
      totalRequests: this.requestCount || 0,
      totalErrors: this.errorCount || 0,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
      totalLogs: this.logs.length,
      memoryUsage: process.memoryUsage(),
      startTime: new Date(this.startTime).toISOString()
    };
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    this.emit('monitoringStopped');
  }

  destroy() {
    this.stop();
    this.alerts = [];
    this.logs = [];
    this.metrics = {
      system: {},
      application: {},
      blockchain: {},
      performance: {}
    };
  }
}

export default MonitoringSystem;
