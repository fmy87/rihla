import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Same split as apps/admin: node by default for pure-logic tests,
    // jsdom opted into per-file for component tests via a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
