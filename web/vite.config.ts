/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The Express backend (server/index.js) is the only source of truth for
// game state and audio; this dev server just proxies to it so the app can
// run against `npm start` in server/ without CORS juggling.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/audio': 'http://localhost:3000',
      '/covers': 'http://localhost:3000',
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, '../public'),
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
