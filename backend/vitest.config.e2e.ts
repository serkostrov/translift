import { defineConfig } from 'vitest/config';

/** e2e идут на отдельной базе translift_test: схема накатывается в global setup, данные чистятся. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://translift:translift@localhost:5433/translift_test?schema=public';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
  },
});
