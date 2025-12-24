import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// Custom plugin to copy OneSignal files to dist root
const copyOneSignalFiles = () => {
  return {
    name: 'copy-onesignal-files',
    closeBundle() {
      const sourceDir = resolve(__dirname, 'public');
      const targetDir = resolve(__dirname, 'dist');
      
      // Ensure dist directory exists
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      
      // Copy OneSignal files
      const filesToCopy = ['OneSignalSDKWorker.js', 'OneSignalSDKUpdaterWorker.js', 'manifest.json'];
      
      filesToCopy.forEach(file => {
        const sourceFile = resolve(sourceDir, file);
        const targetFile = resolve(targetDir, file);
        
        if (existsSync(sourceFile)) {
          copyFileSync(sourceFile, targetFile);
          console.log(`✅ Copied ${file} to dist root`);
        } else {
          console.warn(`⚠️ ${file} not found in public folder`);
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    copyOneSignalFiles() // Add this plugin
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
