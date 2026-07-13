import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

const root = process.cwd();
const dist = path.join(root, 'dist');
const errors = [];

async function filesUnder(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }));
  return nested.flat().sort();
}

const files = await filesUnder(dist);
const inventory = new Set(files.map(file => path.resolve(file)));
const htmlFiles = files.filter(file => file.endsWith('.html'));
const documents = new Map();

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
  if (node.content) walk(node.content, visit);
}

for (const file of htmlFiles) {
  const source = await fs.readFile(file, 'utf8');
  const document = parse(source);
  const ids = new Set();
  const references = [];
  const metadata = { title: '', description: '', canonical: '', ogTitle: '', ogDescription: '', twitterCard: '', jsonLd: [] };
  walk(document, node => {
    if (!node.tagName) return;
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name.toLowerCase(), attr.value]));
    const text = (node.childNodes || []).map(child => child.value || '').join('').trim();
    if (node.tagName === 'title') metadata.title = text;
    if (node.tagName === 'meta' && attrs.name === 'description') metadata.description = attrs.content || '';
    if (node.tagName === 'meta' && attrs.property === 'og:title') metadata.ogTitle = attrs.content || '';
    if (node.tagName === 'meta' && attrs.property === 'og:description') metadata.ogDescription = attrs.content || '';
    if (node.tagName === 'meta' && attrs.name === 'twitter:card') metadata.twitterCard = attrs.content || '';
    if (node.tagName === 'link' && attrs.rel === 'canonical') metadata.canonical = attrs.href || '';
    if (node.tagName === 'script' && attrs.type === 'application/ld+json') metadata.jsonLd.push(text);
    if (attrs.id) ids.add(attrs.id);
    if (node.tagName === 'a' && attrs.name) ids.add(attrs.name);
    for (const name of Object.keys(attrs)) {
      if (/^on/i.test(name)) errors.push(`${path.relative(root, file)}: unsafe inline event attribute "${name}"`);
    }
    for (const name of ['href', 'src', 'poster']) {
      if (attrs[name] !== undefined) references.push({ context: `<${node.tagName}> ${name}`, value: attrs[name] });
    }
    if (attrs.srcset) {
      for (const candidate of attrs.srcset.split(',')) references.push({ context: `<${node.tagName}> srcset`, value: candidate.trim().split(/\s+/)[0] });
    }
  });
  documents.set(path.resolve(file), { ids, references, metadata });
}

const canonicals = new Map();
for (const [file, { metadata }] of documents) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  if (!metadata.title || !metadata.description || !metadata.canonical) errors.push(`${relative}: missing title, description, or canonical metadata`);
  if (relative !== '404.html' && (!metadata.ogTitle || !metadata.ogDescription || !metadata.twitterCard || metadata.jsonLd.length === 0)) errors.push(`${relative}: missing social or structured metadata`);
  if (metadata.canonical) {
    if (!metadata.canonical.startsWith('https://autonomeresearch.com/')) errors.push(`${relative}: canonical URL must use the production origin`);
    if (canonicals.has(metadata.canonical)) errors.push(`${relative}: duplicate canonical URL also used by ${canonicals.get(metadata.canonical)}`);
    else canonicals.set(metadata.canonical, relative);
  }
  for (const json of metadata.jsonLd) {
    try { JSON.parse(json); } catch { errors.push(`${relative}: invalid JSON-LD`); }
  }
}

// Include emitted CSS url(...) values and root/relative URL string literals in JS.
const assetReferences = new Map();
for (const file of files.filter(file => /\.(?:css|js)$/.test(file))) {
  const source = await fs.readFile(file, 'utf8');
  const references = [];
  if (file.endsWith('.css')) {
    for (const match of source.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)) references.push({ context: 'CSS url()', value: match[2].trim() });
  } else {
    for (const match of source.matchAll(/(['"`])((?:\/|\.\.?\/)[^'"`\s]+)\1/g)) references.push({ context: 'JavaScript URL literal', value: match[2] });
  }
  assetReferences.set(path.resolve(file), references);
}

const unsafeProtocol = /^[\u0000-\u0020]*(?:javascript|vbscript|data):/i;
async function validateReference(file, { context, value }) {
  const label = `${path.relative(root, file)}: ${context}="${value}"`;
  if (!value) return errors.push(`${label} is empty`);
  if (value.startsWith('#')) return;
  if (unsafeProtocol.test(value)) return errors.push(`${label} uses an unsafe URL protocol`);

  let url;
  try {
    const relativeFile = path.relative(dist, file).split(path.sep).join('/');
    const basePath = file.endsWith('.html') ? `/${relativeFile}`.replace(/\/index\.html$/, '/') : `/${relativeFile}`;
    url = new URL(value, `https://autonome.local${basePath}`);
  } catch {
    return errors.push(`${label} is not a valid URL`);
  }
  if (url.origin !== 'https://autonome.local') return;

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return errors.push(`${label} contains invalid percent encoding`); }
  if (pathname.includes('\0')) return errors.push(`${label} contains a null byte`);

  const relative = pathname.replace(/^\/+/, '');
  let target = path.join(dist, relative);
  if (!path.extname(target) || pathname.endsWith('/')) target = path.join(target, 'index.html');
  const normalized = path.resolve(target);
  if (normalized !== dist && !normalized.startsWith(`${dist}${path.sep}`)) return errors.push(`${label} resolves outside the built site`);
  if (!inventory.has(normalized)) return errors.push(`${label} points to missing internal target ${pathname}`);

  if (url.hash && normalized.endsWith('.html')) {
    let fragment;
    try { fragment = decodeURIComponent(url.hash.slice(1)); }
    catch { return errors.push(`${label} contains invalid fragment encoding`); }
    if (!documents.get(normalized)?.ids.has(fragment)) errors.push(`${label} points to missing fragment #${fragment}`);
  }
}

for (const [file, document] of documents) {
  for (const reference of document.references) await validateReference(file, reference);
}
for (const [file, references] of assetReferences) {
  for (const reference of references) await validateReference(file, reference);
}

if (errors.length) throw new Error(`Site validation failed:\n- ${errors.join('\n- ')}`);
console.log(`Validated ${htmlFiles.length} HTML page(s) and emitted CSS/JS references.`);
