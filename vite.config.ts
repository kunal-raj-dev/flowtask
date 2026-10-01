import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
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
            if (id.includes('lucide-react') || id.includes('canvas-confetti') || id.includes('chrono-node')) {
              return 'ui-libs';
            }
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
