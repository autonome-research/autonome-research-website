import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { renderMarkdown } from './content-utils.mjs';

const root = process.cwd();
const siteOrigin = 'https://autonomeresearch.com';
const font = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Manrope:wght@300;400;500;600&family=Libre+Baskerville:wght@400;700&display=swap';

const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoDate = date => date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
const formatDate = date => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate(date)}T00:00:00Z`));
const compactDate = date => isoDate(date).split('-').map(Number).join('-');

const manifestPath = path.join(root, '.generated-content.json');
const generatedMarker = '<!-- generated from content/**/*.md; do not edit -->';

function shell({ title, description, active, main, pathname, article = null }) {
  const item = (href, label, key, external = false) => `<a${active === key ? ' class="active"' : ''} href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  const pageTitle = `${title} — Autonome Research`;
  const canonical = `${siteOrigin}${pathname}`;
  const structuredData = article ? {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: article.title,
    datePublished: isoDate(article.date), description, url: canonical,
    publisher: { '@type': 'Organization', name: 'Autonome Research', url: siteOrigin }
  } : { '@context': 'https://schema.org', '@type': 'Organization', name: 'Autonome Research', url: siteOrigin, email: 'hello@autonomeresearch.com' };
  return `${generatedMarker}\n<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>try{const t=localStorage.getItem('autonome-theme');const s=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=s;document.documentElement.dataset.themeSource=t?'saved':'system'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.themeSource='system'}</script><meta name="description" content="${escape(description)}"><title>${escape(pageTitle)}</title><link rel="canonical" href="${canonical}"><meta property="og:type" content="${article ? 'article' : 'website'}"><meta property="og:title" content="${escape(pageTitle)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${siteOrigin}/original-mark.png"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(pageTitle)}"><meta name="twitter:description" content="${escape(description)}"><script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script><link rel="icon" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${font}" rel="stylesheet"><link rel="stylesheet" href="/src/style.css"></head><body><header class="site-header"><a class="wordmark" href="/">autonome <span>research</span></a><button class="menu-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-nav">menu</button><nav id="site-nav" aria-label="Main navigation">${item('/blog/','Blog','blog')}${item('/research/','Research','research')}${item('https://github.com/autonome-research','OSS','oss',true)}${item('/about/','About','about')}</nav></header>${main}<footer><img src="/mark.svg" alt=""><p>Autonome Research</p><p>Independent · Open · 2026</p></footer><script type="module" src="/src/main.js"></script></body></html>`;
}

async function collection(directory) {
  const files = (await fs.readdir(path.join(root, directory))).filter(file => file.endsWith('.md')).sort();
  return Promise.all(files.map(async file => {
    const relative = `${directory}/${file}`;
    const source = await fs.readFile(path.join(root, relative), 'utf8');
    try {
      const parsed = matter(source);
      return { ...parsed.data, body: parsed.content, source: relative, frontmatter: parsed.matter };
    } catch (error) {
      throw new Error(`${relative}: cannot parse front matter: ${error.message}`);
    }
  }));
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requiredStrings = {
  blog: ['title', 'articleTitle', 'slug', 'summary'],
  research: ['title', 'slug', 'field', 'summary'],
};

async function filesUnder(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files.sort();
}

function validateContent(collections, generatedPaths, publicFiles) {
  const errors = [];
  const slugs = new Map();
  const routes = new Map();
  const researchOrders = new Map();
  const generated = new Set(generatedPaths);
  const publicRoutes = new Set(publicFiles);

  for (const [type, entries] of Object.entries(collections)) {
    for (const entry of entries) {
      for (const field of requiredStrings[type]) {
        if (typeof entry[field] !== 'string' || entry[field].trim() === '') errors.push(`${entry.source}: required "${field}" must be a non-empty string`);
      }
      if (typeof entry.published !== 'boolean') errors.push(`${entry.source}: required "published" must be true or false`);
      if (typeof entry.slug === 'string' && !slugPattern.test(entry.slug)) errors.push(`${entry.source}: "slug" must match ${slugPattern}`);

      if (typeof entry.slug === 'string') {
        const slugKey = `${type}/${entry.slug}`;
        if (slugs.has(slugKey)) errors.push(`${entry.source}: duplicate slug "${entry.slug}" (also used by ${slugs.get(slugKey)})`);
        else slugs.set(slugKey, entry.source);

        const route = `${type}/${entry.slug}/index.html`;
        if (routes.has(route)) errors.push(`${entry.source}: route /${type}/${entry.slug}/ conflicts with ${routes.get(route)}`);
        else routes.set(route, entry.source);

        const existingPage = path.join(root, route);
        if (publicRoutes.has(route)) errors.push(`${entry.source}: route /${type}/${entry.slug}/ conflicts with public/${route}`);
        if (!generated.has(route) && existsSync(existingPage)) errors.push(`${entry.source}: route /${type}/${entry.slug}/ conflicts with an existing authored page at ${route}`);
      }

      if (type === 'blog') {
        const dateLine = entry.frontmatter.match(/^date:\s*["']?([^"'\s]+)["']?\s*$/m);
        const dateText = dateLine?.[1];
        const match = dateText?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const date = match && new Date(`${dateText}T00:00:00Z`);
        if (!match || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) errors.push(`${entry.source}: required "date" must be a real calendar date in YYYY-MM-DD format`);
      } else {
        if (!Number.isInteger(entry.order)) errors.push(`${entry.source}: required "order" must be an integer`);
        else if (researchOrders.has(entry.order)) errors.push(`${entry.source}: duplicate research order ${entry.order} (also used by ${researchOrders.get(entry.order)})`);
        else researchOrders.set(entry.order, entry.source);
      }
    }
  }
  if (errors.length) throw new Error(`Content validation failed:\n- ${errors.join('\n- ')}`);
}

// Only paths recorded by this generator are removable. This preserves authored static
// pages while allowing a clean build to retire routes whose Markdown was deleted or drafted.
let previousOutputs = [];
try {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  previousOutputs = Array.isArray(manifest.outputs) ? manifest.outputs : [];
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error(`Cannot read ${path.relative(root, manifestPath)}: ${error.message}`);
}

// Validate every document, including drafts, before touching generated output.
const allContent = {
  blog: await collection('content/blog'),
  research: await collection('content/research'),
};
const publicFiles = await filesUnder(path.join(root, 'public'));
validateContent(allContent, previousOutputs, publicFiles);

for (const output of previousOutputs) {
  if (!/^(blog|research)\/[^/]+\/index\.html$/.test(output)) {
    throw new Error(`Refusing to remove invalid generated path from manifest: ${output}`);
  }
  await fs.rm(path.dirname(path.join(root, output)), { recursive: true, force: true });
}

const generatedOutputs = [];
const posts = allContent.blog.filter(post => post.published).sort((a, b) =>
  isoDate(b.date).localeCompare(isoDate(a.date)) || a.slug.localeCompare(b.slug) || a.source.localeCompare(b.source)
);
const postRows = posts.map(post => `<a class="article-row" href="/blog/${escape(post.slug)}/"><time datetime="${isoDate(post.date)}">${formatDate(post.date)}</time><h1>${escape(post.title)}</h1><span aria-hidden="true">↗</span></a>`).join('');
await fs.mkdir(path.join(root, 'blog'), { recursive: true });
await fs.writeFile(path.join(root, 'blog/index.html'), shell({ title: 'Blog', description: 'Notes and essays from Autonome Research.', active: 'blog', pathname: '/blog/', main: `<main class="page-main blog-index"><section class="article-list">${postRows || '<div class="empty-note">Writing forthcoming.</div>'}</section></main>` }));

for (const post of posts) {
  const target = path.join(root, 'blog', post.slug);
  await fs.mkdir(target, { recursive: true });
  const body = renderMarkdown(post.body, post.source);
  const main = `<main class="page-main post"><article><header class="post-header"><a href="/blog/">← Blog</a><h1>${escape(post.title)}</h1><time datetime="${isoDate(post.date)}">${compactDate(post.date)}</time><p class="post-subtitle">${escape(post.articleTitle || '')}</p></header><div class="post-body">${body}</div></article></main>`;
  await fs.writeFile(path.join(target, 'index.html'), shell({ title: post.articleTitle || post.title, description: post.summary || post.title, active: 'blog', pathname: `/blog/${post.slug}/`, article: post, main }));
  generatedOutputs.push(`blog/${post.slug}/index.html`);
}

const research = allContent.research.filter(item => item.published).sort((a, b) =>
  a.order - b.order || a.slug.localeCompare(b.slug) || a.source.localeCompare(b.source)
);
const cards = research.map(item => `<article><a class="research-card" href="/research/${escape(item.slug)}/"><span>${escape(item.field)}</span><h2>${escape(item.title)}</h2><p>${escape(item.summary)}</p><small>${escape(item.status || 'Read research')}</small></a></article>`).join('');
await fs.mkdir(path.join(root, 'research'), { recursive: true });
await fs.writeFile(path.join(root, 'research/index.html'), shell({ title: 'Research', description: 'Research from Autonome Research.', active: 'research', pathname: '/research/', main: `<main class="page-main research-index"><section class="page-grid">${cards}</section></main>` }));

for (const item of research) {
  const target = path.join(root, 'research', item.slug);
  await fs.mkdir(target, { recursive: true });
  const main = `<main class="page-main post research-detail"><article><header class="post-header"><a href="/research/">← Research</a><dl class="research-meta"><div><dt>Field</dt><dd>${escape(item.field)}</dd></div><div><dt>Status</dt><dd>${escape(item.status || 'Research forthcoming')}</dd></div></dl><h1>${escape(item.title)}</h1><p class="post-subtitle">${escape(item.summary)}</p></header><div class="post-body">${renderMarkdown(item.body, item.source)}</div></article></main>`;
  await fs.writeFile(path.join(target, 'index.html'), shell({ title: item.title, description: item.summary, active: 'research', pathname: `/research/${item.slug}/`, main }));
  generatedOutputs.push(`research/${item.slug}/index.html`);
}

generatedOutputs.sort();
await fs.writeFile(manifestPath, `${JSON.stringify({ outputs: generatedOutputs }, null, 2)}\n`);

const xmlEscape = value => escape(value).replace(/'/g, '&apos;');
const rssItems = posts.map(post => `<item><title>${xmlEscape(post.title)}</title><link>${siteOrigin}/blog/${post.slug}/</link><guid>${siteOrigin}/blog/${post.slug}/</guid><pubDate>${new Date(`${isoDate(post.date)}T00:00:00Z`).toUTCString()}</pubDate><description>${xmlEscape(post.summary)}</description></item>`).join('');
await fs.writeFile(path.join(root, 'public/feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Autonome Research</title><link>${siteOrigin}/blog/</link><description>Notes and essays from Autonome Research.</description>${rssItems}</channel></rss>\n`);
const publicRoutes = ['/', '/about/', '/blog/', ...posts.map(post => `/blog/${post.slug}/`), '/research/', ...research.map(item => `/research/${item.slug}/`)];
const sitemapUrls = publicRoutes.map(route => `<url><loc>${siteOrigin}${route}</loc></url>`).join('');
await fs.writeFile(path.join(root, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}</urlset>\n`);
await fs.writeFile(path.join(root, 'public/robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`);
console.log(`Generated ${posts.length} blog post(s), ${research.length} research field(s), RSS, and sitemap.`);
