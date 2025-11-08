import express, { Router } from 'express';
import { activeAgentsGauge } from '../middleware/metrics.js';

const router: Router = express.Router();
const startTime = Date.now();

router.get('/', async (_req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  // Get agent count (would need to import from agents route)
  const agentCount = activeAgentsGauge.get() || 0;

  res.json({
    success: true,
    status: 'healthy',
    uptime,
    cpu: (cpuUsage.user + cpuUsage.system) / 1000000,
    memory: memUsage.heapUsed / 1024 / 1024,
    agentCount,
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRoutes };
