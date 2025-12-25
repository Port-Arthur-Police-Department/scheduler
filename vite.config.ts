import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      
      // CRITICAL: Use relative paths that work in production
      manifest: {
        name: 'Port Arthur PD Scheduler',
        short_name: 'PAPD Scheduler',
        description: 'Officer scheduling system for Port Arthur Police Department - 129+ officers',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/scheduler/',
        start_url: '/scheduler/',
        id: '/scheduler/',
        orientation: 'portrait-primary',
        
        // KEY FIX: Use paths relative to public folder
        icons: [
          {
            src: 'icons/icon-192.png', // Relative to public folder
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        
        shortcuts: [
          {
            name: 'Daily Schedule',
            short_name: 'Schedule',
            description: 'View today\'s riding list',
            url: '/scheduler/#/daily-schedule'
          },
          {
            name: 'The Book',
            short_name: 'Book',
            description: 'Weekly schedule management',
            url: '/scheduler/#/weekly-schedule'
          },
          {
            name: 'Notifications',
            short_name: 'Alerts',
            description: 'Emergency notifications',
            url: '/scheduler/#/dashboard?tab=notifications'
          }
        ]
      },
      
      srcDir: 'src',
      filename: 'service-worker.js',
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        navigateFallback: '/scheduler/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globIgnores: [
          '**/OneSignalSDKWorker.js',
          '**/OneSignalSDKUpdaterWorker.js'
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.onesignal\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'onesignal-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      },
      
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  
  base: '/scheduler/',
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  
  server: {
    port: 3000,
    open: true
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});