import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        blog: resolve(__dirname, 'blog/index.html'),
        firstPost: resolve(__dirname, 'blog/notes-from-autonome-research/index.html'),
        research: resolve(__dirname, 'research/index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
        about: resolve(__dirname, 'about/index.html'),
      },
    },
  },
});
