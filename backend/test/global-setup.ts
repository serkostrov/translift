import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { TEST_DATABASE_URL } from '../vitest.config.e2e.js';

/**
 * Готовит тестовую базу translift_test: миграции, очистка данных, seed.
 * Защита: работает только с базой, в имени которой есть `_test`.
 */
export default async function setup() {
  if (!new URL(TEST_DATABASE_URL).pathname.endsWith('_test')) {
    throw new Error(`e2e запускаются только на базе *_test, а не ${TEST_DATABASE_URL}`);
  }
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
  });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  await prisma.$disconnect();

  execSync('npx prisma db seed', { env, stdio: 'ignore' });
}
