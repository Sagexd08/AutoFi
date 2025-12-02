import express from 'express';
import { swarmService } from '../services/swarm.js';
import { logger } from '../utils/logger.js';

export const swarmRoutes: express.Router = express.Router();

swarmRoutes.get('/status', (_req, res) => {
  try {
    const coordinator = swarmService.getCoordinator();
    const agents = coordinator.getActiveAgents();
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    logger.error('Failed to get swarm status', { error });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

swarmRoutes.post('/task', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      res.status(400).json({ success: false, error: 'Description is required' });
      return;
    }

    const task = await swarmService.submitTask(description);
    res.json({
      success: true,
      task
    });
  } catch (error) {
    logger.error('Failed to submit swarm task', { error });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
