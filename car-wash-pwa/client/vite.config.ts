import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
      includeAssets: ['icons/*.png', 'favicon.ico'],
      manifest: {
        name: 'جداول — Jadawel',
        short_name: 'جداول',
        description: 'منصة سعودية لإدارة الحجوزات والمنشآت الخدمية — مصمّمة ليشتغل صاحب المشروع بدون تعب',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['lifestyle', 'utilities'],
      },
      // Runtime caching + push handlers are defined in src/sw.ts so they
      // can coexist with custom event listeners.
    }),
  ],
  build: {
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api':      { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads':  { target: 'http://localhost:3001', changeOrigin: true },
      // WebSocket upgrade for the vendor real-time layer.
      '/realtime': { target: 'ws://localhost:3001', ws: true, changeOrigin: true },
    },
  },
});
