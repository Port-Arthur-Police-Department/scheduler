import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      
      // IMPORTANT: Include all icon assets
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',  // iOS icon
        'icon-192.png',          // Your icon
        'icon-512.png',          // Your icon
        'masked-icon.svg'
      ],
      
      manifest: {
        name: 'Port Arthur PD Scheduler',
        short_name: 'PAPD Scheduler',
        description: 'Officer scheduling system for Port Arthur Police Department',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/scheduler/',
        start_url: '/scheduler/',
        orientation: 'portrait',
        
        // CRITICAL: Icon paths must be correct
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
          },
          {
            src: '/scheduler/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'monochrome'
          }
        ],
        
        // Add iOS specific icons
        apple: {
          icon: [
            {
              src: '/scheduler/apple-touch-icon.png',
              sizes: '180x180'
            }
          ]
        }
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/scheduler/index.html',
        globIgnores: ['**/OneSignalSDKWorker.js']
      },
      
      injectRegister: false,
      devOptions: {
        enabled: true // Enable in dev to test icons
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
