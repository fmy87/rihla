import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Default environment is 'node' — fast, and right for the pure-logic
    // lib/ tests (csv, pdfFormat, replayDuration, inviteUrl, reorder).
    // Component tests (.test.tsx) need a DOM, so they opt into jsdom
    // individually with a `// @vitest-environment jsdom` docblock at the
    // top of the file, rather than paying jsdom's startup cost for every
    // test file by making it the global default.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
