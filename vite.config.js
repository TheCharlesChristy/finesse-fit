import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Settings' About card answers "has the change I just merged actually reached
// my phone?". package.json's version alone can't tell you that, so the commit
// and the build time are baked in alongside it (see src/buildInfo.js). Building
// outside a git checkout (a tarball, a CI export) must still work, hence the fallback.
function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico'],
      manifest: {
        name: 'Finesse Fit',
        short_name: 'Finesse Fit',
        description: 'Local-first workout and nutrition tracker',
        theme_color: '#08111f',
        background_color: '#08111f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        // Long-press the home-screen icon. Handled by the ?action= effect in App.jsx.
        shortcuts: [
          { name: 'Scan barcode', short_name: 'Scan', url: '/?action=scan', icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }] },
          { name: 'Log workout', short_name: 'Workout', url: '/?action=workout', icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }] },
          { name: 'Log food', short_name: 'Food', url: '/?action=food', icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globDirectory: 'dist',
        navigateFallback: '/index.html',
        // Label-scan OCR is opt-in and rarely opened, but its worker script,
        // wasm core and language data under public/tesseract/ are ~8.5MB —
        // all of it would otherwise match the glob above and get pulled into
        // every install and every update. Fetched (and then cached below)
        // only the first time someone actually opens that flow.
        globIgnores: ['tesseract/**', 'assets/vendor-ocr-*.js'],
        runtimeCaching: [
          {
            // Tesseract's worker/core/language files, plus its own script
            // chunk — all same-origin, none precached (see globIgnores
            // above), all cached after first use so label scanning keeps
            // working offline from then on.
            urlPattern: ({ url, sameOrigin }) => (
              sameOrigin && (url.pathname.includes('/tesseract/') || /\/vendor-ocr-[^/]*\.js$/.test(url.pathname))
            ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-assets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // tesseract.js is only ever reached via a dynamic import() from the
          // label-scan flow (src/ocr.js) — its own chunk keeps it out of
          // every other page's download.
          if (id.includes('/tesseract.js/') || id.includes('/tesseract.js-core/')) return 'vendor-ocr';
        }
      }
    }
  }
});
