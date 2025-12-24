import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// Custom plugin to copy files to dist root
const copyFilesToRoot = () => {
  return {
    name: 'copy-files-to-root',
    closeBundle() {
      const sourceDir = resolve(__dirname, 'public');
      const targetDir = resolve(__dirname, 'dist');
      
      // Ensure dist directory exists
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      
      // Files to copy to root
      const filesToCopy = [
        'OneSignalSDKWorker.js',
        'OneSignalSDKUpdaterWorker.js', 
        'manifest.json',
        'service-worker.js'
      ];
      
      filesToCopy.forEach(file => {
        const sourceFile = resolve(sourceDir, file);
        const targetFile = resolve(targetDir, file);
        
        if (existsSync(sourceFile)) {
          copyFileSync(sourceFile, targetFile);
          console.log(`✅ Copied ${file} to dist root`);
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    copyFilesToRoot() // Add this plugin
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
