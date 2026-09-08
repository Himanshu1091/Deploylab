import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to Express so the browser sees a single origin,
// exactly as nginx will in production. Cookies therefore behave identically in
// both environments — no CORS, no sameSite surprises on the first deploy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
