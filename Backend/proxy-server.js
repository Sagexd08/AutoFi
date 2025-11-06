import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { EventEmitter } from 'events';
import MultiChainConfig from './multi-chain-config.js';
import logger from './utils/logger.js';

export class ProxyServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      port: config.port || 3000,
      host: config.host || 'localhost',
      enableLoadBalancing: config.enableLoadBalancing !== false,
      enableHealthCheck: config.enableHealthCheck !== false,
      enableRateLimit: config.enableRateLimit !== false,
      enableCORS: config.enableCORS !== false,
      enableAuth: config.enableAuth || false,
      apiKey: config.apiKey,
      jwtSecret: config.jwtSecret,
      ...config
    };
    
    this.app = express();
    this.server = null;
    this.multiChainConfig = new MultiChainConfig();
    this.loadBalancer = new LoadBalancer();
    this.healthMonitor = new HealthMonitor();
    this.rateLimiter = null;
    this.targets = new Map();
    this.circuitBreakers = new Map();
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeLoadBalancer();
  }

  initializeMiddleware() {
    this.app.use(helmet());
    
    if (this.config.enableCORS) {
      this.app.use(cors({
        origin: this.config.corsOrigins || '*',
        credentials: true
      }));
    }
    
    if (this.config.enableRateLimit) {
      this.rateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
      });
      this.app.use(this.rateLimiter);
    }
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    if (this.config.enableAuth) {
      this.app.use(this.authMiddleware.bind(this));
    }
    
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      req.startTime = startTime;
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.emit('request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      });
      
      next();
    });
  }

  initializeRoutes() {
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.healthMonitor.getHealthStatus();
        res.json(health);
      } catch (error) {
        res.status(500).json({ 
          healthy: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.app.get('/chains/health', async (req, res) => {
      try {
        const chainHealth = await this.multiChainConfig.checkAllChainsHealth();
        res.json({
          chains: chainHealth,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.app.get('/loadbalancer/status', (req, res) => {
      const status = this.loadBalancer.getStatus();
      res.json(status);
    });
    
    this.app.get('/metrics', (req, res) => {
      const metrics = this.getMetrics();
      res.json(metrics);
    });
    
    this.app.post('/chains/select', async (req, res) => {
      try {
        const { operation, preferences } = req.body;
        const bestChain = this.multiChainConfig.getBestChainForOperation(operation, preferences);
        res.json({ 
          selectedChain: bestChain,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.app.use('*', this.proxyMiddleware.bind(this));
  }

  initializeLoadBalancer() {
    const chains = this.multiChainConfig.getAllChains();
    chains.forEach(chain => {
      this.loadBalancer.addTarget(chain.id, {
        id: chain.id,
        name: chain.name,
        rpcUrls: chain.rpcUrls,
        priority: chain.priority,
        gasPriceMultiplier: chain.gasPriceMultiplier,
        healthy: true,
        weight: this.calculateWeight(chain)
      });
    });
    
    chains.forEach(chain => {
      this.circuitBreakers.set(chain.id, new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000
      }));
    });
  }

  calculateWeight(chain) {
    const gasScore = 1 / chain.gasPriceMultiplier;
    const priorityScore = 1 / chain.priority;
    return Math.round((gasScore + priorityScore) * 10);
  }

  async proxyMiddleware(req, res, next) {
    try {
      const preferredChain = req.headers['x-chain-id'] || req.query.chain;
      
      const target = await this.loadBalancer.getTarget(preferredChain);
      
      if (!target) {
        return res.status(503).json({ 
          error: 'No healthy targets available',
          timestamp: new Date().toISOString()
        });
      }
      
      const circuitBreaker = this.circuitBreakers.get(target.id);
      if (circuitBreaker && !circuitBreaker.canExecute()) {
        return res.status(503).json({ 
          error: 'Circuit breaker open for target',
          target: target.id,
          timestamp: new Date().toISOString()
        });
      }
      
      const rpcUrl = await this.multiChainConfig.getBestRpcUrl(target.id);
      
      const proxy = createProxyMiddleware({
        target: rpcUrl,
        changeOrigin: true,
        pathRewrite: {
          '^/api': '' // Remove /api prefix if present
        },
        onProxyReq: (proxyReq, req, res) => {
          proxyReq.setHeader('X-Forwarded-For', req.ip);
          proxyReq.setHeader('X-Chain-Id', target.id);
          proxyReq.setHeader('X-Proxy-Timestamp', new Date().toISOString());
        },
        onProxyRes: (proxyRes, req, res) => {
          proxyRes.headers['X-Target-Chain'] = target.id;
          proxyRes.headers['X-Proxy-Response-Time'] = Date.now() - req.startTime;
        },
        onError: (err, req, res) => {
          logger.error('Proxy error', { error: err.message, target: target.id, stack: err.stack });
          this.loadBalancer.markTargetFailure(target.id);
          circuitBreaker?.recordFailure();
          
          res.status(502).json({ 
            error: 'Proxy error',
            target: target.id,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      proxy(req, res, next);
      
    } catch (error) {
      logger.error('Proxy middleware error', { error: error.message, stack: error.stack });
      res.status(500).json({ 
        error: 'Internal proxy error',
        timestamp: new Date().toISOString()
      });
    }
  }

  authMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;
    
    if (this.config.apiKey && apiKey !== this.config.apiKey) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        timestamp: new Date().toISOString()
      });
    }
    
    if (this.config.jwtSecret && authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Invalid authorization header',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          logger.info('Proxy server running', { host: this.config.host, port: this.config.port });
          this.emit('serverStarted', { 
            host: this.config.host, 
            port: this.config.port 
          });
          resolve();
        });
        
        if (this.config.enableHealthCheck) {
          this.healthMonitor.start();
        }
        
        this.startLoadBalancerHealthChecks();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Proxy server stopped');
          this.emit('serverStopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  startLoadBalancerHealthChecks() {
    setInterval(async () => {
      try {
        const chains = this.multiChainConfig.getAllChains();
        for (const chain of chains) {
          const health = await this.multiChainConfig.checkChainHealth(chain.id);
          this.loadBalancer.updateTargetHealth(chain.id, health.healthy);
        }
      } catch (error) {
        logger.error('Health check error', { error: error.message, stack: error.stack });
      }
    }, 30000); // Check every 30 seconds
  }

  getMetrics() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      loadBalancer: this.loadBalancer.getMetrics(),
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([id, cb]) => ({
        id,
        state: cb.getState(),
        failures: cb.getFailureCount(),
        successes: cb.getSuccessCount()
      })),
      timestamp: new Date().toISOString()
    };
  }

  async healthCheck() {
    try {
      const chainHealth = await this.multiChainConfig.checkAllChainsHealth();
      const healthyChains = Object.values(chainHealth).filter(h => h.healthy).length;
      const totalChains = Object.keys(chainHealth).length;
      
      return {
        healthy: healthyChains > 0,
        chains: {
          total: totalChains,
          healthy: healthyChains,
          unhealthy: totalChains - healthyChains
        },
        loadBalancer: this.loadBalancer.getStatus(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

class LoadBalancer {
  constructor() {
    this.targets = new Map();
    this.currentIndex = 0;
    this.algorithm = 'round-robin';
  }

  addTarget(id, target) {
    this.targets.set(id, {
      ...target,
      connections: 0,
      lastUsed: null,
      responseTime: null
    });
  }

  updateTargetHealth(id, healthy) {
    const target = this.targets.get(id);
    if (target) {
      target.healthy = healthy;
    }
  }

  markTargetFailure(id) {
    const target = this.targets.get(id);
    if (target) {
      target.failures = (target.failures || 0) + 1;
    }
  }

  markTargetSuccess(id) {
    const target = this.targets.get(id);
    if (target) {
      target.successes = (target.successes || 0) + 1;
      target.lastUsed = new Date();
    }
  }

  async getTarget(preferredChain = null) {
    const healthyTargets = Array.from(this.targets.values()).filter(t => t.healthy);
    
    if (healthyTargets.length === 0) {
      return null;
    }
    
    if (preferredChain) {
      const preferred = healthyTargets.find(t => t.id === preferredChain);
      if (preferred) {
        this.markTargetSuccess(preferred.id);
        return preferred;
      }
    }
    
    switch (this.algorithm) {
      case 'round-robin':
        return this.getRoundRobinTarget(healthyTargets);
      case 'least-connections':
        return this.getLeastConnectionsTarget(healthyTargets);
      case 'weighted':
        return this.getWeightedTarget(healthyTargets);
      default:
        return healthyTargets[0];
    }
  }

  getRoundRobinTarget(targets) {
    const target = targets[this.currentIndex % targets.length];
    this.currentIndex++;
    this.markTargetSuccess(target.id);
    return target;
  }

  getLeastConnectionsTarget(targets) {
    const target = targets.reduce((min, t) => 
      (t.connections || 0) < (min.connections || 0) ? t : min
    );
    this.markTargetSuccess(target.id);
    return target;
  }

  getWeightedTarget(targets) {
    const totalWeight = targets.reduce((sum, t) => sum + (t.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const target of targets) {
      random -= target.weight || 1;
      if (random <= 0) {
        this.markTargetSuccess(target.id);
        return target;
      }
    }
    
    const target = targets[0];
    this.markTargetSuccess(target.id);
    return target;
  }

  getStatus() {
    const targets = Array.from(this.targets.values());
    return {
      algorithm: this.algorithm,
      totalTargets: targets.length,
      healthyTargets: targets.filter(t => t.healthy).length,
      targets: targets.map(t => ({
        id: t.id,
        name: t.name,
        healthy: t.healthy,
        connections: t.connections || 0,
        failures: t.failures || 0,
        successes: t.successes || 0
      }))
    };
  }

  getMetrics() {
    return this.getStatus();
  }
}

class CircuitBreaker {
  constructor(config) {
    this.failureThreshold = config.failureThreshold;
    this.recoveryTimeout = config.recoveryTimeout;
    this.monitoringPeriod = config.monitoringPeriod;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.failures = [];
  }

  canExecute() {
    const now = Date.now();
    
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (now - this.lastFailureTime > this.recoveryTimeout) {
          this.state = 'HALF_OPEN';
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
      default:
        return false;
    }
  }

  recordSuccess() {
    this.successCount++;
    this.failures = this.failures.filter(f => Date.now() - f < this.monitoringPeriod);
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.failures.push(this.lastFailureTime);
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }

  getFailureCount() {
    return this.failureCount;
  }

  getSuccessCount() {
    return this.successCount;
  }
}

class HealthMonitor {
  constructor() {
    this.healthStatus = {
      healthy: true,
      lastChecked: null,
      services: {}
    };
    this.interval = null;
  }

  start() {
    this.interval = setInterval(() => {
      this.checkHealth();
    }, 30000); // Check every 30 seconds
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async checkHealth() {
    try {
      const services = {
        proxy: true, // Proxy server is running
        loadBalancer: true, // Load balancer is operational
        chains: await this.checkChainsHealth()
      };
      
      this.healthStatus = {
        healthy: Object.values(services).every(s => s === true),
        lastChecked: new Date().toISOString(),
        services
      };
    } catch (error) {
      this.healthStatus = {
        healthy: false,
        lastChecked: new Date().toISOString(),
        error: error.message,
        services: {}
      };
    }
  }

  async checkChainsHealth() {
    return true;
  }

  getHealthStatus() {
    return this.healthStatus;
  }
}

export default ProxyServer;
