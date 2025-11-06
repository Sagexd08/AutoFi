import express, { Router } from 'express';

const router: Router = express.Router();

router.get('/', async (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRoutes };
