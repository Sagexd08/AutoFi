import { db } from './client.js';
import { chainRepository } from './repositories/chain.repository.js';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Seed default chains
    console.log('📡 Seeding default chains...');
    await chainRepository.seedDefaultChains();
    console.log('✅ Default chains seeded');

    // Verify seeding
    const chains = await db.chain.findMany();
    console.log(`✅ ${chains.length} chains in database`);

    // Create a default system user (optional)
    const systemUser = await db.user.upsert({
      where: { walletAddress: '0x0000000000000000000000000000000000000000' },
      create: {
        walletAddress: '0x0000000000000000000000000000000000000000',
        name: 'System',
        role: 'ADMIN',
      },
      update: {},
    });
    console.log(`✅ System user created: ${systemUser.id}`);

    console.log('🎉 Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
