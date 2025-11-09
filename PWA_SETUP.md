# PAPD Scheduler - Progressive Web App Setup Guide

This document explains how to set up and configure the Progressive Web App (PWA) features for the Port Arthur PD Scheduler.

## Features Implemented

### ✅ Core PWA Features
- **Web App Manifest** - App metadata and configuration
- **Service Worker** - Offline functionality and caching
- **Push Notifications** - Real-time notifications for schedule updates
- **Install Prompt** - Native app-like installation experience
- **Offline Support** - App works without internet connection

### ✅ Notification Features
- **Shift Reminders** - 30 minutes before shift starts
- **Schedule Updates** - When schedule changes occur
- **Emergency Alerts** - Department-wide notifications
- **Custom Notifications** - Test and custom scheduling

## File Structure

```
/public/
├── manifest.json              # PWA manifest configuration
├── service-worker.js          # Service worker for offline support
└── icons/                     # App icons
    ├── icon-192x192.png       # Standard icon
    ├── icon-512x512.png       # Large icon
    └── badge-72x72.png        # Notification badge

/src/
├── utils/
│   └── notifications.ts       # Notification service class
├── hooks/
│   └── useNotifications.ts    # React hook for notifications
└── components/
    ├── NotificationSettings.tsx  # Settings UI component
    └── PWAInstallPrompt.tsx      # Install prompt component
```

## Installation Instructions

### 1. Install Dependencies

```bash
npm install vite-plugin-pwa --save-dev
```

### 2. Update Vite Configuration

The `vite.config.ts` file has been updated with PWA plugin configuration. Key settings:

- **Register Type**: Auto-update for seamless updates
- **Workbox**: Caching strategies for different content types
- **Manifest**: PWA metadata and capabilities

### 3. Build and Deploy

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Notification Setup

### Push Notifications (Advanced)

For push notifications to work, you'll need:

1. **VAPID Keys**: Generate public/private key pair
2. **Push Service**: Set up a push notification service
3. **Server Endpoint**: API endpoint to receive subscriptions

#### Generating VAPID Keys

```bash
# Install web-push globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

#### Update Service Worker

Replace the demo public key in `/public/service-worker.js`:

```javascript
// Replace this demo key with your actual VAPID public key
const publicKey = 'YOUR_VAPID_PUBLIC_KEY_HERE';
```

#### Server Implementation

You'll need a server endpoint to handle push subscriptions:

```javascript
// Example server endpoint
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  // Save subscription to database
  // Use web-push library to send notifications
});
```

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: Full PWA support
- **Firefox**: PWA support (limited push notifications)
- **Safari**: PWA support on iOS 16.4+
- **Mobile Browsers**: Chrome Mobile, Samsung Internet, iOS Safari

### Feature Detection

The app automatically detects browser capabilities:
- Service Worker support
- Notification API support
- Push API support (for advanced notifications)

## Testing

### Manual Testing

1. **PWA Installation**:
   - Open the app in Chrome/Edge
   - Look for install prompt or use menu → "Install app"
   - Verify app installs and works offline

2. **Notifications**:
   - Enable notifications in settings
   - Test notification button
   - Verify permission requests work correctly

3. **Offline Mode**:
   - Install app
   - Turn off internet
   - Verify app still loads and basic functions work

### Automated Testing

```bash
# Lighthouse audit for PWA compliance
npm install -g lighthouse
lighthouse https://port-arthur-police-department.github.io/scheduler/ --chrome-flags="--headless"
```

## Customization

### App Appearance

1. **Icons**: Replace `/public/icons/` with your department's logo
2. **Colors**: Update theme colors in `manifest.json` and `vite.config.ts`
3. **Name**: Modify app name in `manifest.json`

### Notification Content

Customize notification messages in:
- `/src/utils/notifications.ts`
- `/public/service-worker.js`

### Caching Strategy

Modify caching behavior in `vite.config.ts`:
- Add new content types
- Adjust cache durations
- Implement custom caching strategies

## Troubleshooting

### Common Issues

1. **Service Worker Not Registering**:
   - Check browser console for errors
   - Verify HTTPS (required for service workers)
   - Ensure correct file paths

2. **Notifications Not Working**:
   - Check notification permissions
   - Verify service worker registration
   - Test on different browsers

3. **Install Prompt Not Showing**:
   - Check PWA criteria (HTTPS, manifest, service worker)
   - Clear browser data and try again
   - Verify manifest.json is valid

### Debug Mode

Enable debug logging in development:

```javascript
// In vite.config.ts
devOptions: {
  enabled: true,
  type: 'module'
}
```

## Security Considerations

1. **HTTPS Required**: PWA features only work on HTTPS
2. **CORS**: Configure CORS for API endpoints
3. **VAPID Security**: Keep private keys secure
4. **Data Protection**: Encrypt sensitive notification data

## Performance Optimization

1. **Lazy Loading**: Implement code splitting for better performance
2. **Image Optimization**: Use WebP format with fallbacks
3. **Cache Optimization**: Tune cache strategies for your content
4. **Bundle Size**: Monitor and optimize JavaScript bundle size

## Next Steps

1. **Deploy to Production**: Test thoroughly on GitHub Pages
2. **Set Up Push Notifications**: Implement VAPID keys and server
3. **Monitor Usage**: Track PWA installation and usage metrics
4. **Iterate**: Gather feedback and improve the experience

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Vite PWA Plugin](https://github.com/vite-pwa/vite-plugin-pwa)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## Support

For issues or questions:
1. Check browser console for errors
2. Verify PWA criteria are met
3. Test on multiple browsers/devices
4. Consult the resources above