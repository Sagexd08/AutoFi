import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const agentExecutionCounter = new Counter({
  name: 'agent_executions_total',
  help: 'Total number of agent executions',
  labelNames: ['agent_type', 'status'],
  registers: [register],
});

export const transactionCounter = new Counter({
  name: 'transactions_total',
  help: 'Total number of transactions',
  labelNames: ['status', 'risk_level'],
  registers: [register],
});

export const riskScoreHistogram = new Histogram({
  name: 'risk_score',
  help: 'Risk score distribution',
  buckets: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
  registers: [register],
});

export const activeAgentsGauge = new Gauge({
  name: 'active_agents',
  help: 'Number of active agents',
  registers: [register],
});

export const chainHealthGauge = new Gauge({
  name: 'chain_health',
  help: 'Chain health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['chain_id'],
  registers: [register],
});

