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
      
      // Complete manifest configuration
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
        lang: 'en-US',
        dir: 'ltr',
        categories: ['productivity', 'business'],
        
        icons: [
          {
            src: 'icons/icon-192.png',
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
          },
          {
            src: 'icons/icon-384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        
        shortcuts: [
          {
            name: 'Daily Schedule',
            short_name: 'Schedule',
            description: 'View today\'s riding list',
            url: '/scheduler/#/daily-schedule',
            icons: [
              {
                src: 'icons/shortcut-schedule.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'The Book',
            short_name: 'Book',
            description: 'Weekly schedule management',
            url: '/scheduler/#/weekly-schedule',
            icons: [
              {
                src: 'icons/shortcut-book.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Notifications',
            short_name: 'Alerts',
            description: 'Emergency notifications',
            url: '/scheduler/#/dashboard?tab=notifications',
            icons: [
              {
                src: 'icons/shortcut-alerts.png',
                sizes: '96x96',
                type: 'image/png'
              }
            ]
          }
        ],
        
        screenshots: [
          {
            src: 'screenshots/desktop.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Desktop view of the scheduler'
          },
          {
            src: 'screenshots/mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mobile view of the scheduler'
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
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      },
      
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html'
      },
      
      // Include assets for PWA
      includeAssets: [
        'icons/*.png',
        'screenshots/*.png',
        'fonts/*.woff2',
        'robots.txt',
        'favicon.ico'
      ]
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
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  
  server: {
    port: 3000,
    open: true,
    host: true
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});