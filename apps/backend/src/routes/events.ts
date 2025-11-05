import express, { Router } from 'express';

const router: Router = express.Router();

// Event subscription endpoints (placeholder for future implementation)
router.post('/subscribe', async (_req, res) => {
  res.json({
    success: true,
    message: 'Event subscription endpoint - coming soon',
  });
});

router.get('/subscriptions', async (_req, res) => {
  res.json({
    success: true,
    subscriptions: [],
  });
});

export { router as eventRoutes };
