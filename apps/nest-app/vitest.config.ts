import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'test'],
    coverage: {
      exclude: [
        'node_modules',
        'dist',
        'test/',
        '**/*.spec.ts',
        '**/*.interface.ts',
        '**/*.dto.ts',
        '**/*.entity.ts',
        '**/*.module.ts',
        '**/*.controller.ts',
        '**/*.service.ts',
        '**/main.ts',
      ],
    },
  },
  plugins: [swc.vite()],
});
