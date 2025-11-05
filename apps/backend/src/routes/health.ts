import express from 'express';

const router = express.Router();

// Health check
router.get('/', async (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      celo: !!process.env.CELO_PRIVATE_KEY,
      langchain: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
    },
  });
});

export { router as healthRoutes };
