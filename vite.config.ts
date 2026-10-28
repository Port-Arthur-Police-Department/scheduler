import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isStackblitz = process.env.STACKBLITZ === 'true' ||
                     process.env.CODESANDBOX_HOST !== undefined;

// Debug: Log environment variables
console.log('🔍 Vite Config Debug:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  GITHUB_REF_NAME:', process.env.GITHUB_REF_NAME);
console.log('  VITE_BASE_PATH (raw):', process.env.VITE_BASE_PATH);

// Normalize VITE_BASE_PATH if it was converted to Windows path by Git Bash
let normalizedBasePath = process.env.VITE_BASE_PATH || '';
if (normalizedBasePath.match(/^[A-Z]:/i)) {
  normalizedBasePath = normalizedBasePath.replace(/\\/g, '/');
  const idx = normalizedBasePath.indexOf('/scheduler/');
  if (idx !== -1) {
    normalizedBasePath = normalizedBasePath.substring(idx);
  } else {
    normalizedBasePath = '/scheduler/';
  }
}
console.log('  VITE_BASE_PATH (normalized):', normalizedBasePath);

// Determine base path
let basePath = './';

if (normalizedBasePath) {
  basePath = normalizedBasePath;
  console.log('✅ Vite Config: Using normalized VITE_BASE_PATH:', basePath);
} else if (isProduction) {
  if (process.env.GITHUB_REF_NAME === 'staging') {
    basePath = '/scheduler/staging/';
    console.log('✅ Vite Config: Using /scheduler/staging/ (staging branch)');
  } else {
    basePath = '/scheduler/';
    console.log('✅ Vite Config: Using /scheduler/ (production/main branch)');
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
        short_name: "Schedule",
        description: "Officer scheduling system for Port Arthur Police Department",
        theme_color: "#1e40af",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        scope: basePath,
        start_url: basePath,
        id: basePath,
        categories: ["productivity", "business"],

        icons: [
          { src: `${basePath}icons/favicon.ico`, sizes: "32x32", type: "image/x-icon", purpose: "any" },
          { src: `${basePath}icons/apple-touch-icon.png`, sizes: "180x180", type: "image/png", purpose: "any" },
          { src: `${basePath}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `${basePath}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: `${basePath}icons/icon-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `${basePath}icons/icon-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any" }
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
  ].filter(Boolean),

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
    port: isStackblitz ? 5173 : (process.env.PORT ? Number(process.env.PORT) : 3000),
    open: !isStackblitz,
    host: true,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
