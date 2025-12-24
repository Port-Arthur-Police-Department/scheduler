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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Port Arthur PD Scheduler',
        short_name: 'PAPD Scheduler',
        description: 'Officer scheduling system',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/scheduler/',
        start_url: '/scheduler/',
        orientation: 'portrait',
        
        icons: [
          {
            src: '/scheduler/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/scheduler/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/scheduler/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        
        // IMPORTANT: exclude needs to be in an array and inside globIgnores
        globIgnores: [
          '**/node_modules/**/*',
          '**/OneSignalSDKWorker.js',
          '**/OneSignalSDKUpdaterWorker.js',
          '**/sw.js'
        ],
        
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.onesignal\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onesignal-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      },
      
      // Disable auto-injection since we handle OneSignal manually
      injectRegister: false,
      
      devOptions: {
        enabled: false // Disable in dev to avoid conflicts
      },
      
      // Explicitly define mode
      mode: 'production'
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
          // Split vendor chunks better
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          'utils-vendor': ['date-fns', 'lodash', 'jsPDF'],
          'sonner-vendor': ['sonner']
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000
  },
  
  server: {
    port: 3000
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
