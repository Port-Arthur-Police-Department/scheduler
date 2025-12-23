import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Plugin to inject environment variables into HTML
function htmlEnvPlugin() {
  return {
    name: 'html-env',
    transformIndexHtml(html) {
      const onesignalAppId = process.env.VITE_ONESIGNAL_APP_ID || 
                            process.env.VITE_PUBLIC_ONESIGNAL_APP_ID || 
                            '3417d840-c226-40ba-92d6-a7590c31eef3';
      
      console.log('🔧 HTML Transform - OneSignal App ID:', onesignalAppId.substring(0, 10) + '...');
      
      let transformedHtml = html;
      
      transformedHtml = transformedHtml.replace(
        /%%ONESIGNAL_APP_ID%%/g,
        onesignalAppId
      );
      
      transformedHtml = transformedHtml.replace(
        /appId: "3417d840-c226-40ba-92d6-a7590c31eef3"/g,
        `appId: "${onesignalAppId}"`
      );
      
      return transformedHtml;
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    htmlEnvPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/scheduler/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // IMPORTANT: Set the correct glob directory for subdirectory
        globDirectory: 'dist',
        // Generate service worker with correct base
        swDest: 'dist/sw.js',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.onesignal\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onesignal-cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      },
      manifestFilename: 'manifest.json',
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
    copyPublicDir: true,
    // Ensure assets are built with correct paths
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      }
    }
  },
  publicDir: 'public',
  define: {
    'import.meta.env.VITE_ONESIGNAL_APP_ID': JSON.stringify(process.env.VITE_ONESIGNAL_APP_ID),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.VITE_APP_URL)
  }
})
