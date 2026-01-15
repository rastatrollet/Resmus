
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
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  define: {
    'import.meta.env.VITE_VASTTRAFIK_AUTH': JSON.stringify(process.env.VITE_VASTTRAFIK_AUTH),
    'import.meta.env.VITE_TRAFIKLAB_API_KEY': JSON.stringify(process.env.VITE_TRAFIKLAB_API_KEY),
    'import.meta.env.VITE_TRAFIKLAB_STATIC_KEY': JSON.stringify(process.env.VITE_TRAFIKLAB_STATIC_KEY)
  }
});
