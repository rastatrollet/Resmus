
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Resmus/',
  define: {
    'import.meta.env.VITE_VASTTRAFIK_AUTH': JSON.stringify('bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh'),
    'import.meta.env.VITE_TRAFIKLAB_API_KEY': JSON.stringify('600ef54ef3234bd1880624c148baa8f7'),
    'import.meta.env.VITE_TRAFIKLAB_STATIC_KEY': JSON.stringify('07e9c042923d42cf8ec3189056c7ea60'),
    'import.meta.env.VITE_TRAFIKLAB_REALTIME_KEY': JSON.stringify('sfdadeeff47434671a78023ac284a8ec6'),
  },
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
  }
});
