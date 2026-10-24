import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'server/lib/**/*.ts',
        'server/sources/**/*.ts',
        'server/services/**/*.ts',
        'server/db/repository.ts',
      ],
      exclude: ['**/*.test.ts', 'server/test/**'],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 85,
        lines: 85,
      },
    },
  },
});
