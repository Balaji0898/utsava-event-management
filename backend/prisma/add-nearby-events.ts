import { PrismaClient } from '@prisma/client';
import { seedNearbyEvents } from './nearby-events';

/**
 * Standalone, idempotent script to add a few Andhra Pradesh events with real
 * latitude/longitude (so "near me" proximity search has data) to an existing
 * database without touching or duplicating other data.
 *
 *   npm run seed:nearby
 */
const prisma = new PrismaClient();

seedNearbyEvents(prisma)
  .then((dept) => {
    console.log(`✅ Local Celebrations ready (department ${dept.id}).`);
  })
  .catch((e) => {
    console.error('❌ Failed to add Local Celebrations:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
