const fs = require('fs');
const path = require('path');

console.log('🛠️ Fixing GitHub Pages deployment...');

const distDir = path.join(__dirname, '../dist');
const schedulerDir = path.join(distDir, 'scheduler');

// Create directories if they don't exist
if (!fs.existsSync(schedulerDir)) {
  fs.mkdirSync(schedulerDir, { recursive: true });
  console.log('✅ Created dist/scheduler/ directory');
}

// Files to copy (removed OneSignal files)
const files = [
  'service-worker.js',
  'manifest.json',
  'sw.js' // Vite PWA service worker
];

files.forEach(file => {
  const source = path.join(__dirname, '../public', file);
  const destRoot = path.join(distDir, file);
  const destScheduler = path.join(schedulerDir, file);

  if (fs.existsSync(source)) {
    try {
      fs.copyFileSync(source, destRoot);
      fs.copyFileSync(source, destScheduler);
      console.log(`✅ Copied ${file} to both locations`);
    } catch (error) {
      console.log(`⚠️ Could not copy ${file}:`, error.message);
    }
  } else {
    console.log(`ℹ️ ${file} not found in public directory`);
  }
});

// Check if Vite generated sw.js exists
const viteSwPath = path.join(distDir, 'sw.js');
if (fs.existsSync(viteSwPath)) {
  try {
    fs.copyFileSync(viteSwPath, path.join(schedulerDir, 'sw.js'));
    console.log('✅ Copied Vite sw.js to scheduler/');
  } catch (error) {
    console.log('⚠️ Could not copy Vite sw.js:', error.message);
  }
}

console.log('🎉 GitHub Pages deployment fix completed!');
