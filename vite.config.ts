import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { applySocialOrigin } from './src/utils/socialMetadata.ts';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';

const sourceCommit = process.env.VERCEL_GIT_COMMIT_SHA || (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'development'; }
})();
// CLI previews can include uncommitted work, so the commit alone is not a release identity.
const buildId = process.env.VERCEL_DEPLOYMENT_ID || sourceCommit;

export default defineConfig({
  define: { __FLOWTASK_BUILD__: JSON.stringify(buildId) },
  plugins: [
    react(),
    { name: 'flowtask-social-origin', transformIndexHtml(html) {
      const configured = process.env.APP_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
      return applySocialOrigin(html, configured);
    } },
    { name: 'flowtask-build-identity', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ commit: sourceCommit, build: buildId }) });
    } },
    { name: 'flowtask-media-revisions', async generateBundle() {
      const revisions: Record<string, string> = {};
      const directory = path.resolve('public/media');
      const walk = async (root: string) => {
        for (const entry of await readdir(root, { withFileTypes: true })) {
          const target = path.join(root, entry.name);
          if (entry.isDirectory()) await walk(target);
          else if (entry.isFile() && /\.(webp|png|jpg|jpeg|svg|mp4|webm|mp3|wav|ogg)$/i.test(entry.name)) {
            revisions['/media/' + path.relative(directory, target).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(target)).digest('hex').slice(0, 12);
          }
        }
      };
      await walk(directory);
      this.emitFile({ type: 'asset', fileName: 'media-revisions.json', source: JSON.stringify(revisions) });
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
          '**/media-revisions.json',
          '**/firebase*.js',
          '**/ical*.js',
          '**/calendarService*.js',
          '**/brand/social-preview*',
          '**/brand/*.png',
          '**/*Modal*.js',
          '**/SettingsDrawer*.{js,css}',
          '**/WorkspaceVisualPicker*.{js,css}',
          '**/CopilotOmnibar*.{js,css}',
          '**/velocityCalibrator*.js',
          '**/ReviewView*.{js,css}',
          '**/TimelineView*.{js,css}',
          '**/FocusStudio*.{js,css}',
          '**/KanbanView*.js',
          '**/EisenhowerView*.js',
          '**/ProjectsView*.{js,css}',
          '**/StudyView*.js',
          '**/UpcomingView*.{js,css}',
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
            urlPattern: ({ url, sameOrigin }) => sameOrigin &&
              url.pathname.startsWith('/assets/') && /\.(?:js|css)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'flowtask-ondemand-runtime',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    manifest: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase';
            }
            if (id.includes('ical.js')) {
              return 'ical';
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
