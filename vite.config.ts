import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        globPatterns: [],          // let Vite decide → no “empty glob” warning
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      },
      manifestFilename: 'manifest.json',   // <-- add this
      manifest: {
        name: 'Port Arthur PD Scheduler',
        short_name: 'PAPD Scheduler',
        description: 'Shift scheduling system for Port Arthur Police Department',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/scheduler/',
        start_url: '/scheduler/',
        lang: 'en-US',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: 'icons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['icons/*.png', 'icons/*.ico', 'icons/*.svg']
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  base: '/scheduler/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    copyPublicDir: true
  },
  publicDir: 'public'
})
