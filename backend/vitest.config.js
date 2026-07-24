import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment — these are backend/service tests, no DOM needed.
    environment: 'node',
    // Discover any *.test.js / *.spec.js co-located next to the code they test.
    include: ['**/*.{test,spec}.js'],
    exclude: ['node_modules/**', 'prisma/migrations/**'],
    // `describe`/`it`/`expect` available without importing (Jest-like).
    globals: true,
  },
});
