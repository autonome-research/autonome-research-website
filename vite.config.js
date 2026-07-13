import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import matter from 'gray-matter';

const root = __dirname;
const input = {
  home: resolve(root, 'index.html'),
  blog: resolve(root, 'blog/index.html'),
  research: resolve(root, 'research/index.html'),
  about: resolve(root, 'about/index.html'),
  notFound: resolve(root, '404.html'),
};

// Build inputs come from published Markdown, never from whatever generated folders
// happen to be present in the checkout.
for (const type of ['blog', 'research']) {
  const contentDirectory = resolve(root, 'content', type);
  for (const file of readdirSync(contentDirectory).filter(name => name.endsWith('.md')).sort()) {
    const { data } = matter(readFileSync(resolve(contentDirectory, file), 'utf8'));
    if (!data.published) continue;
    const page = resolve(root, type, String(data.slug), 'index.html');
    if (!existsSync(page)) throw new Error(`Missing generated page for ${contentDirectory}/${file}: ${page}`);
    input[`${type}-${data.slug}`] = page;
  }
}

export default defineConfig({
  build: { rollupOptions: { input } },
});
