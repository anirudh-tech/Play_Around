import 'dotenv/config';
import { PLATFORM_SETTING_DEFAULTS } from '@playaround/contracts';
import { loadEnv } from '../../src/config/env';
import { hashPassword } from '../../src/lib/password';
import { createPrismaClient } from '../../src/lib/prisma';
import { SEED_SPORTS, SEED_VENUES } from './data';

const env = loadEnv();
const db = createPrismaClient(env.DATABASE_URL);

async function main() {
  for (const sport of SEED_SPORTS) {
    await db.sport.upsert({ where: { slug: sport.slug }, update: sport, create: sport });
  }
  const sports = await db.sport.findMany();
  const sportId = (slug: string) => {
    const sport = sports.find((s) => s.slug === slug);
    if (!sport) throw new Error(`Unknown sport ${slug}`);
    return sport.id;
  };

  for (const { sports: venueSports, ...venue } of SEED_VENUES) {
    const saved = await db.venue.upsert({
      where: { googlePlaceId: venue.googlePlaceId },
      update: venue,
      create: venue,
    });
    for (const slug of venueSports) {
      await db.venueSport.upsert({
        where: { venueId_sportId: { venueId: saved.id, sportId: sportId(slug) } },
        update: {},
        create: { venueId: saved.id, sportId: sportId(slug) },
      });
    }
  }

  for (const [key, value] of Object.entries(PLATFORM_SETTING_DEFAULTS)) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  const staff = [
    { email: env.STAFF_SEED_EMAIL, role: 'SUPER_ADMIN' as const, name: 'Super Admin' },
    { email: 'operations@playaround.local', role: 'OPERATIONS' as const, name: 'Operations' },
    { email: 'support@playaround.local', role: 'SUPPORT' as const, name: 'Support' },
  ];
  const passwordHash = await hashPassword(env.STAFF_SEED_PASSWORD);
  for (const member of staff) {
    await db.user.upsert({
      where: { email: member.email },
      update: { role: member.role, passwordHash, status: 'ACTIVE' },
      create: {
        email: member.email,
        role: member.role,
        passwordHash,
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: member.name } },
      },
    });
  }

  console.log(
    `seeded ${SEED_SPORTS.length} sports, ${SEED_VENUES.length} venues, ` +
      `${Object.keys(PLATFORM_SETTING_DEFAULTS).length} settings, ${staff.length} staff`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
