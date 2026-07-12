import { readdirSync, existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const input = {
  home: resolve(__dirname, 'index.html'),
  blog: resolve(__dirname, 'blog/index.html'),
  research: resolve(__dirname, 'research/index.html'),
  projects: resolve(__dirname, 'projects/index.html'),
  about: resolve(__dirname, 'about/index.html'),
};

const blogDirectory = resolve(__dirname, 'blog');
if (existsSync(blogDirectory)) {
  for (const entry of readdirSync(blogDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(resolve(blogDirectory, entry.name, 'index.html'))) {
      input[`blog-${entry.name}`] = resolve(blogDirectory, entry.name, 'index.html');
    }
  }
}

export default defineConfig({
  build: { rollupOptions: { input } },
});
