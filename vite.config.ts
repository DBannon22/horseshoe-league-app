import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  // Firebase makes the main bundle ~600 kB (≈170 kB gzipped), which is fine here.
  build: { chunkSizeWarningLimit: 800 },
});
