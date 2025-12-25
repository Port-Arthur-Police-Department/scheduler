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
  
  // Remove manifest from here since you have static manifest.json
  manifest: false,
  
  srcDir: 'src',
  filename: 'service-worker.js', // CRITICAL: This must be service-worker.js
  
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
    navigateFallback: '/scheduler/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    
    // IMPORTANT: Include manifest in cache
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
    type: 'module'
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
    open: true
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});