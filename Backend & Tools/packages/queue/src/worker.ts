#!/usr/bin/env node

/**
 * Standalone worker process entry point
 * Run with: node dist/worker.js
 */

import { startWorkerProcess } from './processors/initialize.js';

startWorkerProcess().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
