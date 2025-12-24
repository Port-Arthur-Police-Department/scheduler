import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Add this
      includeAssets: [
        'icons/favicon.ico',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'Port Arthur PD Scheduler',
        short_name: 'PAPD Scheduler',
        description: 'Officer scheduling system',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait', // Add this
        scope: '/scheduler/',
        start_url: '/scheduler/',
        
        icons: [
          {
            src: '/scheduler/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/scheduler/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/scheduler/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'monochrome'
          }
        ],
        
        // Add these for better PWA experience
        categories: ['productivity', 'business'],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'View officer dashboard',
            url: '/dashboard',
            icons: [{ src: '/scheduler/icons/icon-192.png', sizes: '192x192' }]
          }
        ],
        screenshots: [],
        prefer_related_applications: false
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/scheduler/index.html',
        // Better exclusion pattern for OneSignal
        exclude: [
          /OneSignal.*\.js$/,
          /OneSignalSDKWorker\.js$/,
          /OneSignalSDKUpdaterWorker\.js$/,
          /manifest\.webmanifest$/ // Exclude manifest from cache
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.onesignal\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onesignal-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      },
      
      // Changed from false to 'script' or 'auto'
      injectRegister: 'auto', // Changed from false to 'auto'
      
      devOptions: {
        enabled: true,
        type: 'module', // Add this for dev
        navigateFallbackAllowlist: [/^\/scheduler/]
      },
      
      // Add this for better PWA behavior
      strategies: 'generateSW',
      srcDir: 'src',
      filename: 'service-worker.js'
    })
  ],
  base: '/scheduler/',
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@/components/ui']
        }
      }
    }
  },
  
  server: {
    port: 3000,
    host: true
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
