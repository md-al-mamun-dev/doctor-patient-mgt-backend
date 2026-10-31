import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 30000,
    testTimeout: 30000,
    fileParallelism: false, // Run test files sequentially to avoid Atlas connection concurrency bottlenecks
  },
});

