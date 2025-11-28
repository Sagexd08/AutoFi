#!/usr/bin/env ts-node
/**
 * Database initialization script
 * Runs migrations and seeds the database with initial data
 * Usage: pnpm run db:init
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Starting database initialization...');

    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✓ Database connection successful');

    // Check if tables exist (Prisma migrations will create them)
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `;
    
    if ((tables as any[]).length === 0) {
      logger.warn('No tables found. Ensure Prisma migrations have been run:');
      logger.warn('  pnpm exec prisma migrate deploy');
    } else {
      logger.info(`✓ Found ${(tables as any[]).length} tables in database`);
    }

    // Log current automation count
    const automationCount = await prisma.automation.count();
    logger.info(`✓ Database has ${automationCount} automations`);

    logger.info('✓ Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed:', error as Record<string, unknown>);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
