import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Trafiklab GTFS-RT Realtime (VehiclePositions)
      '/trafiklab-proxy': {
        target: 'https://opendata.samtrafiken.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trafiklab-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'ResmusBeta/2.0');
          });
        }
      },
      // Trafiklab GTFS Static (ZIP files)
      '/trafiklab-static-proxy': {
        target: 'https://opendata.samtrafiken.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trafiklab-static-proxy/, '/gtfs'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'ResmusBeta/2.0');
          });
        }
      },
      // ResRobot API Proxy
      '/resrobot-proxy': {
        target: 'https://api.resrobot.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/resrobot-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'ResmusBeta/2.0');
          });
        }
      },
    }
  }
})
