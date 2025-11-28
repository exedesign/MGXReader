import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['path', 'stream', 'util', 'timers', 'events', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  base: './',
  esbuild: {
    logLevel: 'error',
    charset: 'ascii'
  },
  // Optimize dependencies and suppress CJS warnings
  optimizeDeps: {
    include: ['react', 'react-dom', 'tesseract.js'],
    exclude: ['src/renderer/utils/aiHandler.js'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  server: {
    port: 3000,
    host: 'localhost',
    strictPort: false,
    cors: {
      origin: '*',
      credentials: true
    },
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add necessary headers
            proxyReq.setHeader('User-Agent', 'ScriptMaster-AI/1.0');
          });
        }
      }
    },
    fs: {
      // Allow serving files from node_modules
      allow: ['..']
    }
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  }
});
