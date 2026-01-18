
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Resmus/',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 300
    },
    proxy: {
      '/resrobot-api': {
        target: 'https://api.resrobot.se/v2.1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/resrobot-api/, ''),
        secure: false
      },
      '/trafiklab-proxy': {
        target: 'https://opendata.samtrafiken.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trafiklab-proxy/, ''),
        secure: false
      },
      '/trafikverket-api': {
        target: 'https://api.trafikinfo.trafikverket.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trafikverket-api/, ''),
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
