import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, /api is proxied to the backend so the client can use relative URLs
// (same as in the single-process build, where the API serves the client).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3001' },
  },
});
