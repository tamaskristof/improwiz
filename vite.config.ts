/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/improwiz/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // The piano samples (~32 MB across all layers) are deliberately NOT precached — that would
        // force the whole set onto every install. Instead cache them lazily as they're played, so a
        // user only stores the velocity layers they actually use, and they work offline thereafter.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/salamander/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'piano-samples',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'ImproWiz',
        short_name: 'ImproWiz',
        description: 'Piano improvisation practice: random key/mode picks with live scale highlighting and scoring.',
        theme_color: '#161514',
        background_color: '#161514',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        // Both form factors are required for the richer install UI: Chrome shows the
        // `wide` shot in the desktop install dialog and a non-`wide` (mobile) shot on Android.
        screenshots: [
          {
            src: 'screenshots/wide.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'ImproWiz on desktop: scale notes, chords, and the live keyboard.',
          },
          {
            src: 'screenshots/narrow.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'ImproWiz on mobile: the current scale and its notes.',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
