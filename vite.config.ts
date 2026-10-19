import { applySocialOrigin } from './src/utils/socialMetadata.ts';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';

const buildId = process.env.VERCEL_GIT_COMMIT_SHA || (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'development'; }
})();

export default defineConfig({
  define: { __FLOWTASK_BUILD__: JSON.stringify(buildId) },
  plugins: [
    react(),
    { name: 'flowtask-social-origin', transformIndexHtml(html) {
      const configured = process.env.APP_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
      return applySocialOrigin(html, configured);
    } },
    { name: 'flowtask-build-identity', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ commit: buildId }) });
    } },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: [
          '**/media/**',
          '**/firebase*.js',
          '**/brand/social-preview*',
          '**/*Modal*.js',
          '**/ReviewView*.js',
          '**/TimelineView*.js',
          '**/FocusStudio*.js',
          '**/KanbanView*.js',
          '**/EisenhowerView*.js',
          '**/ProjectsView*.js',
          '**/StudyView*.js',
          '**/UpcomingView*.js',
          '**/OnboardingFlow*.js',
          '**/CommandPalette*.js',
          '**/standupGenerator*.js',
          '**/cloudWorkspace*.js',
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'flowtask-media-v2',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('/assets/firebase') ||
              url.pathname.includes('/assets/rolldown-runtime') ||
              url.pathname.includes('/assets/motion') ||
              (url.pathname.includes('/assets/') &&
                (url.pathname.includes('Modal') ||
                  url.pathname.includes('SettingsDrawer') ||
                  url.pathname.includes('ReviewView') ||
                  url.pathname.includes('TimelineView') ||
                  url.pathname.includes('FocusStudio') ||
                  url.pathname.includes('KanbanView') ||
                  url.pathname.includes('EisenhowerView') ||
                  url.pathname.includes('ProjectsView') ||
                  url.pathname.includes('StudyView') ||
                  url.pathname.includes('UpcomingView') ||
                  url.pathname.includes('WelcomePage') ||
                  url.pathname.includes('OnboardingFlow') ||
                  url.pathname.includes('CommandPalette') ||
                  url.pathname.includes('FeedbackForm') ||
                  url.pathname.includes('standupGenerator') ||
                  url.pathname.includes('cloudWorkspace'))),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'flowtask-ondemand-runtime',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('chrono-node')) {
              return 'nlp';
            }
            if (id.includes('lucide-react') || id.includes('canvas-confetti')) {
              return 'ui-libs';
            }
          }
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.{idea,git,cache,output,temp}/**'],
  },
});
