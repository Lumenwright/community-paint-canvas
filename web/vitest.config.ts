import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests need a running SvelteKit dev server and local Supabase.
    // Run tests sequentially (not parallel) to avoid DB state conflicts between suites.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Each test file manages its own DB state via reset.ts helpers.
    // Timeout generous to account for DB round-trips.
    testTimeout: 15000,
    hookTimeout: 15000,
    // Load .env.test into process.env before any test file runs.
    setupFiles: ['./tests/setup.ts']
  }
});
