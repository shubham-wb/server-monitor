import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.e2e-spec.ts'],
    exclude: ['node_modules', 'dist', 'test'],
    // All e2e specs connect to the same shared db.sqlite file, so running
    // files in parallel causes "database is locked" errors. Run them serially.
    fileParallelism: false,
  },
  plugins: [swc.vite()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
