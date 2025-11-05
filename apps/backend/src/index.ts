import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { workflowRoutes } from './routes/workflows.js';
import { walletRoutes } from './routes/wallet.js';
import { eventRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/health', healthRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Celo Automator Backend running on port ${PORT}`);
  console.log(`📖 API docs: http://localhost:${PORT}/api/health`);
});
