import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Plugin to inject environment variables into HTML
function htmlEnvPlugin() {
  return {
    name: 'html-env',
    transformIndexHtml(html) {
      // Get environment variables (with fallbacks)
      const onesignalAppId = process.env.VITE_ONESIGNAL_APP_ID || 
                            process.env.VITE_PUBLIC_ONESIGNAL_APP_ID || 
                            '3417d840-c226-40ba-92d6-a7590c31eef3';
      
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
      const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
      
      console.log('🔧 HTML Transform - OneSignal App ID:', onesignalAppId.substring(0, 10) + '...');
      
      // Replace placeholders in HTML
      let transformedHtml = html;
      
      // Replace OneSignal App ID placeholder
      transformedHtml = transformedHtml.replace(
        /%%ONESIGNAL_APP_ID%%/g,
        onesignalAppId
      );
      
      // Replace other placeholders if they exist
      transformedHtml = transformedHtml.replace(/%%SUPABASE_URL%%/g, supabaseUrl);
      transformedHtml = transformedHtml.replace(/%%SUPABASE_ANON_KEY%%/g, supabaseAnonKey);
      transformedHtml = transformedHtml.replace(/%%APP_URL%%/g, appUrl);
      
      // Also replace the hardcoded App ID with the environment variable
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
    htmlEnvPlugin(), // Add this plugin BEFORE VitePWA
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        globPatterns: [],          // let Vite decide → no "empty glob" warning
        navigateFallback: '/scheduler/index.html', // ✅ ensures correct fallback
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 }
            }
          },
          // Add OneSignal CDN caching
          {
            urlPattern: /^https:\/\/cdn\.onesignal\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onesignal-cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
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
    // Define global constants for client-side
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          onesignal: ['react-onesignal']
        }
      }
    }
  },
  publicDir: 'public',
  // Define global constants
  define: {
    'import.meta.env.VITE_ONESIGNAL_APP_ID': JSON.stringify(process.env.VITE_ONESIGNAL_APP_ID),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.VITE_APP_URL)
  }
})
