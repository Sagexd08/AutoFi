import { PrismaClient } from '@prisma/client';

// Singleton instance of Prisma Client
// Prevents creating multiple instances in development (especially with HMR)
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    errorFormat: 'pretty',
  });
} else {
  // In development, use a global variable to prevent multiple instances
  // @ts-ignore - Allow attaching to global in development
  if (!global.prisma) {
    // @ts-ignore
    global.prisma = new PrismaClient({
      errorFormat: 'pretty',
      log: process.env.DEBUG === 'true' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
    });
  }
  // @ts-ignore
  prisma = global.prisma;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };
export type { PrismaClient } from '@prisma/client';
