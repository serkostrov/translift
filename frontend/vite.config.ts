import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * PWA, минимальная версия (docs/PLAN.md): установка на телефон, своё окно без
     * панелей браузера, кеш оболочки приложения. API и фото НЕ кешируем — данные всегда свежие.
     */
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Транслифт — контроль монтажа лифтов',
        short_name: 'Транслифт',
        description: 'Объекты, этапы монтажа, фото бригадиров, отчёты',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2F3742',
        theme_color: '#2F3742',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Запросы к API и файлы — только из сети
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Схемы и типы API — общие с backend (см. docs/PLAN.md)
      '@contracts': fileURLToPath(new URL('../backend/src/contracts/index.ts', import.meta.url)),
    },
  },
  build: {
    // Базовые библиотеки (React, роутер, Radix, Zod) ~500 КБ / ~160 КБ gzip; страницы грузятся отдельно
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5174,
    strictPort: true,
    // API ходит через тот же origin — cookie сессии работают без CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
});
