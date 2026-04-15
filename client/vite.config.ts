import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend port is read from server/.env (PORT=3002). Keep this in sync
// with the value used by run-all-tests.sh auto-detect so the Vite proxy
// reaches the right Express instance during browser-based dev + tests.
const BACKEND_PORT = 3002;

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the Playwright browser inside the
    // Test MCP Docker container can reach Vite via host.docker.internal.
    // Binding to 127.0.0.1 or ::1 would block container → host traffic.
    host: '0.0.0.0',
    port: 5173,

    // Vite rejects requests whose Host header isn't in this list. Without
    // host.docker.internal here, the Test MCP container would hit Vite but
    // get a "Blocked request" error page instead of the React app.
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'],

    proxy: {
      '/api/notifications/stream': {
        target: `http://localhost:${BACKEND_PORT}`,
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
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
