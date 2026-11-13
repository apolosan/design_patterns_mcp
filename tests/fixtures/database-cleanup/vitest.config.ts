/**
 * Config for the nested run started by
 * tests/integration/test-database-cleanup.test.ts.
 *
 * It reuses the suite configuration as is (setup files, global setup,
 * timeouts), so the probe goes through exactly the same wiring as every other
 * test file. Only the file selection differs: `*.probe.ts` files are not part
 * of the regular suite.
 */
import { defineConfig } from 'vitest/config';
import suiteConfig from '../../../vitest.config';

export default defineConfig({
  ...suiteConfig,
  test: {
    ...suiteConfig.test,
    include: ['tests/fixtures/database-cleanup/*.probe.ts'],
  },
});
