const fs = require('fs');
const path = require('path');

console.log('🛠️ Fixing GitHub Pages deployment...');

// Ensure service workers exist in both locations
const files = [
  'OneSignalSDKWorker.js',
  'OneSignalSDKUpdaterWorker.js',
  'service-worker.js'
];

const distDir = path.join(__dirname, '../dist');
const schedulerDir = path.join(distDir, 'scheduler');

// Create directories if they don't exist
if (!fs.existsSync(schedulerDir)) {
  fs.mkdirSync(schedulerDir, { recursive: true });
}

// Copy service workers to both locations
files.forEach(file => {
  const source = path.join(__dirname, '../public', file);
  const destRoot = path.join(distDir, file);
  const destScheduler = path.join(schedulerDir, file);
  
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destRoot);
    fs.copyFileSync(source, destScheduler);
    console.log(`✅ Copied ${file} to both locations`);
  } else {
    console.warn(`⚠️ ${file} not found in public directory`);
  }
});

// Create a redirect HTML file for root OneSignal requests
const redirectHtml = `
<!DOCTYPE html>
<html>
<head>
  <script>
    // Redirect OneSignal requests to /scheduler/ subdirectory
    if (window.location.pathname.includes('OneSignal') || 
        window.location.pathname.includes('service-worker')) {
      window.location.href = '/scheduler' + window.location.pathname;
    }
  </script>
</head>
<body>
  <p>Redirecting to scheduler app...</p>
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, 'index.html'), redirectHtml);
console.log('✅ Created root redirect HTML');

console.log('🎉 GitHub Pages deployment fix completed!');
