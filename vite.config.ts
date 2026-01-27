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
      includeAssets: ['icons/*.png', 'vite.svg'],
      
      manifest: {
        name: "Port Arthur PD Scheduler",
        short_name: "PAPD Scheduler",
        description: "Officer scheduling system for Port Arthur Police Department",
        theme_color: "#1e40af",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/scheduler/",
        start_url: "/scheduler/",
        id: "/scheduler/",
        categories: ["productivity", "business"],
        
        icons: [
          {
            src: "icons/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any"
          }
        ],
        
        screenshots: [
          {
            src: "screenshots/desktop.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Desktop View"
          }
        ],
        
        shortcuts: [
          {
            name: "Daily Schedule",
            short_name: "Schedule",
            description: "View today's riding list",
            url: "/scheduler/#/daily-schedule",
            icons: [{ src: "icons/icon-96x96.png", sizes: "96x96" }]
          }
        ]
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf,json}'],
        navigateFallback: '/scheduler/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_/],
        cleanupOutdatedCaches: true,
        
        // FIX: Add this to increase cache size limit
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-static-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      },
      
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  
  base: '/scheduler/',
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    
    // FIX: chunkSizeWarningLimit goes here, not in rollupOptions
    chunkSizeWarningLimit: 1000,
    
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      // FIX: Correct manual chunks syntax
      output: {
        manualChunks(id) {
          // Split large dependencies into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@mui')) {
              return 'vendor-mui';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (id.includes('date-fns') || id.includes('lodash') || id.includes('axios')) {
              return 'vendor-utils';
            }
            // Group all other node_modules into vendor chunk
            return 'vendor';
          }
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
