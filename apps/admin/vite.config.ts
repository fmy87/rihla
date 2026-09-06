import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Splits the two heaviest, rarely-changing dependencies (Google Maps'
        // JS API loader + jsPDF/autotable, used only on the Reports/Route
        // Editor/Live Tracking/Route Replay screens) out of the main bundle,
        // so most navigations don't pay for code they don't use and the
        // build no longer trips Vite's 500kB single-chunk warning.
        manualChunks: {
          maps: ['@react-google-maps/api'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
});
