import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 7777,
    open: false,
    host: true
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: 0,
  }
});
