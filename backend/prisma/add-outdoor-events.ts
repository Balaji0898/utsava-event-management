import { PrismaClient } from '@prisma/client';
import { seedOutdoorEvents } from './outdoor-events';

/**
 * Standalone, idempotent script to add the "Outdoor Events" department (with
 * sample categories, vendors and packages) to an existing database — including
 * production — without touching or duplicating any other data.
 *
 *   npm run seed:outdoor
 */
const prisma = new PrismaClient();

seedOutdoorEvents(prisma)
  .then((dept) => {
    console.log(`✅ Outdoor Events ready (department ${dept.id}).`);
  })
  .catch((e) => {
    console.error('❌ Failed to add Outdoor Events:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
