import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Схемы и типы API — общие с backend (см. docs/PLAN.md)
      '@contracts': fileURLToPath(new URL('../backend/src/contracts/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    // API ходит через тот же origin — cookie сессии работают без CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
});
