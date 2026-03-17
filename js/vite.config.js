import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'data',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        demo1: 'demo_001.html',
        demo2: 'demo_002.html',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
