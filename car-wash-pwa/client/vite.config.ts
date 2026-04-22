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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Take over every open tab as soon as a new SW is installed,
        // so the next API call / navigation already uses the new build.
        // Without these, the old SW keeps serving the old app until
        // every tab is closed.
        skipWaiting: true,
        clientsClaim: true,
        // Never cache API JSON at the service-worker layer by default.
        // Specific endpoints can opt-in below with NetworkFirst.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            // Google Fonts — safe to cache for a year; immutable by URL.
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Services catalogue. NetworkFirst: try the network, fall
            // back to a tiny 2-minute cache only when offline/slow.
            urlPattern: /\/api\/services/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-services',
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 120, maxEntries: 10 },
            },
          },
          {
            // Platform plans — price changes must be instant.
            urlPattern: /\/api\/plans(\?|$)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-plans',
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60, maxEntries: 5 },
            },
          },
          {
            // Public vendor storefronts — their colours / templates /
            // published pages may change; a 1-minute cache is enough
            // to smooth out bursts but still looks "live".
            urlPattern: /\/api\/vendors\/public\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-vendors-public',
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 60, maxEntries: 50 },
            },
          },
          {
            // User-uploaded images (logos, gallery, before/after). They
            // are hash-like filenames, so CacheFirst is safe and fast.
            urlPattern: /\/uploads\/.*\.(png|jpe?g|webp|gif|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'user-uploads',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 200 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
