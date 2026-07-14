import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8934',
  },
  webServer: {
    command: 'node scripts/static-server.mjs',
    port: 8934,
    reuseExistingServer: !process.env.CI,
  },
});
