import express from 'express';

const router = express.Router();

// Event subscription endpoints (placeholder for future implementation)
router.post('/subscribe', async (req, res) => {
  res.json({
    success: true,
    message: 'Event subscription endpoint - coming soon',
  });
});

router.get('/subscriptions', async (req, res) => {
  res.json({
    success: true,
    subscriptions: [],
  });
});

export { router as eventRoutes };
