# Push-Up Discipline PWA

A lightweight, offline-first Progressive Web App for tracking daily push-up discipline. Built with zero dependencies (except Chart.js for analytics) using vanilla HTML, CSS, and JavaScript.

## Features

- **Two Daily Sessions**: Morning (3 sets) + Evening (3 sets)
- **Interactive Calendar**: Review, backfill, and edit any past date
- **Streak Tracking**: Consecutive day tracking with midnight grace window (00:00-03:00)
- **Analytics Dashboard**: Daily reps, morning vs evening, 7-day rolling averages
- **Personal Records**: Best set, session, and day
- **Offline-First**: Works 100% offline after first load (IndexedDB + Service Worker)
- **Data Portability**: 1-click JSON export/import for complete data ownership
- **Cross-Platform**: Optimized for both iPhone (standalone PWA) and MacBook (desktop browsers)

## File Structure

```
PUSH-UPPWA/
├── index.html          # Single-page application entry point
├── styles.css          # Complete design system (OLED dark theme)
├── app.js              # All application logic (1100+ lines)
├── sw.js               # Service worker for offline caching
├── manifest.json       # PWA manifest for home screen install
├── icons/              # PWA icons (add your own)
│   ├── icon-192.png    # 192x192 app icon
│   └── icon-512.png    # 512x512 app icon
├── docs/
│   └── ARCHITECTURE.md # Technical architecture spec
└── README.md           # This file
```

## Deployment

### Option 1: Any Static Web Server

Simply copy all files to your web server's document root:

```bash
# Via SCP
scp -r ./* user@yourserver.com:/var/www/pushups/

# Via rsync
rsync -avz --exclude='.git' ./ user@yourserver.com:/var/www/pushups/

# Via FTP (using lftp)
lftp -u user,password yourserver.com -e "mirror -R ./ /var/www/pushups/; quit"
```

### Option 2: Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name pushups.yourdomain.com;

    root /var/www/pushups;
    index index.html;

    # Enable gzip
    gzip on;
    gzip_types text/html text/css application/javascript application/json;

    # Cache static assets
    location ~* \.(css|js|json|png|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Option 3: Apache (.htaccess)

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Gzip
AddOutputFilterByType DEFLATE text/html text/css application/javascript

# Cache
<FilesMatch "\.(css|js|json|png)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
```

### Option 4: Local Development

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open http://localhost:8000

## Adding to iPhone Home Screen

1. Open the PWA URL in Safari on your iPhone
2. Tap the Share button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Name it "Push-Ups" and tap **Add**
5. The app will now launch in fullscreen standalone mode

## Creating App Icons

Place two PNG icons in the `icons/` folder:
- `icon-192.png` — 192×192 pixels
- `icon-512.png` — 512×512 pixels

Use a simple design: dark background (#000000) with a white/blue push-up or dumbbell icon.

You can generate these with any image editor or online PWA icon generator.

## HTTPS Requirement

PWA features (Service Worker, Add to Home Screen) require HTTPS. For local development, `localhost` is exempt. For production:
- Use Let's Encrypt for free SSL certificates
- Or deploy behind Cloudflare for automatic HTTPS

## Data & Privacy

- All data is stored locally in your browser (IndexedDB)
- No data is sent to any server
- Export/import your data anytime via Settings → Export/Import
- You own 100% of your data

## Native iOS App (Capacitor)

The repository includes a native iOS shell powered by Ionic Capacitor and Swift Package Manager (SPM). This locks the orientation to **Portrait only** on iOS (just like Instagram, Spotify, or TikTok) with zero rotation or viewport glitches.

### Prerequisites
- macOS with Xcode installed
- Node.js & npm

### Commands
```bash
# 1. Install dependencies
npm install

# 2. Build web bundle & sync to iOS
npm run cap:sync

# 3. Open project in Xcode
npm run cap:open
# or open ios/App/App.xcodeproj in Xcode
```

In Xcode:
1. Select your target device (your connected iPhone or an iPhone Simulator).
2. Under **Signing & Capabilities**, select your Apple Developer Team.
3. Click **Run** (`Cmd + R`) to launch directly on your phone or distribute via TestFlight.

## Tech Stack

- **HTML5** — Semantic markup, Web App meta tags
- **CSS3** — Custom properties, CSS Grid, safe-area-inset, animations
- **Vanilla JavaScript (ES6+)** — Zero framework dependencies
- **Chart.js 4.4.4** — Charting library (loaded via CDN, cached by SW)
- **IndexedDB** — Primary offline storage
- **Service Worker** — Offline caching with cache-first strategy
- **Capacitor 8** — Native iOS wrapper with SPM for 100% hardware-locked portrait mode

## License

MIT
