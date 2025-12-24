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
        
        // IMPORTANT: Exclude OneSignal worker
        exclude: [/OneSignalSDKWorker\.js$/],
        
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
          }
        ]
      },
      
      // OneSignal integration
      injectRegister: false, // We'll handle OneSignal manually
      
      // Disable VitePWA's auto-registration since we have OneSignal
      devOptions: {
        enabled: false // Disable in dev to avoid conflicts
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
    port: 3000
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
