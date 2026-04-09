import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/notifications/stream': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        // SSE requires no buffering and WebSocket-like handling
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Cache-Control', 'no-cache');
            proxyReq.setHeader('Accept', 'text/event-stream');
          });
        },
      },
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
});
