import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
VitePWA({
  manifest: {
    name: 'Port Arthur PD Scheduler',
    short_name: 'PAPD Scheduler',
    description: 'Officer scheduling system',
    theme_color: '#1e40af',
    background_color: '#0f172a',
    display: 'standalone',
    scope: '/scheduler/',
    start_url: '/scheduler/',
    
    icons: [
      {
        src: '/scheduler/icons/icon-192.png', // Updated path
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/scheduler/icons/icon-512.png', // Updated path
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/scheduler/icons/icon-192.png', // Updated path
        sizes: '192x192',
        type: 'image/png',
        purpose: 'monochrome'
      }
    ]
  },
  includeAssets: [
    'icons/favicon.ico',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png'
  ],
      
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
