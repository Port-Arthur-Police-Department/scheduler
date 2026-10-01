import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isStackblitz = process.env.STACKBLITZ === 'true' ||
                     process.env.CODESANDBOX_HOST !== undefined;

// Determine if staging - check GITHUB_REF_NAME first (from CI), then VITE_BASE_PATH
const isStaging = process.env.GITHUB_REF_NAME === 'staging' ||
                  (process.env.VITE_BASE_PATH && process.env.VITE_BASE_PATH.includes('staging'));

// Set base path - priority: explicit staging > GITHUB_REF_NAME > VITE_BASE_PATH > default
let basePath = './';

if (isProduction) {
  if (isStaging) {
    basePath = '/scheduler/staging/';
    console.log('✅ Vite Config: Using /scheduler/staging/ base path (staging branch detected)');
  } else {
    basePath = '/scheduler/';
    console.log('✅ Vite Config: Using /scheduler/ base path (main branch detected)');
  }
} else {
  console.log('✅ Vite Config: Using ./ base path (development mode)');
}

export default defineConfig({
  plugins: [
    react(),
    // Enable PWA for both production and staging (both need push notifications)
    // Only disable on StackBlitz
    isProduction && !isStackblitz && VitePWA({
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
        scope: "./",
        start_url: "./",
        id: "./",
        categories: ["productivity", "business"],

        icons: [
          {
            src: "./icons/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "maskable any"
          },
          {
            src: "./icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any"
          }
        ],

       shortcuts: [
          {
            name: "Daily Schedule",
            short_name: "Schedule",
            description: "View today's riding list",
            url: "./#/daily-schedule",
            icons: [{ src: "./icons/icon-96x96.png", sizes: "96x96" }]
          }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf,json}'],
        navigateFallback: './index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },

      devOptions: {
        enabled: false,
      }
    })
  ].filter(Boolean), // Filter out false values

  base: basePath,
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    modulePreload: {
      polyfill: false
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  
server: {
  port: isStackblitz ? 5173 : (process.env.PORT || 3000),
  open: !isStackblitz, // Only auto-open locally
  host: true,
},
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
