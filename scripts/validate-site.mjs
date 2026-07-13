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
  walk(document, node => {
    if (!node.tagName) return;
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name.toLowerCase(), attr.value]));
    if (attrs.id) ids.add(attrs.id);
    if (node.tagName === 'a' && attrs.name) ids.add(attrs.name);
    for (const name of Object.keys(attrs)) {
      if (/^on/i.test(name)) errors.push(`${path.relative(root, file)}: unsafe inline event attribute "${name}"`);
    }
    for (const name of ['href', 'src', 'poster']) {
      if (attrs[name] !== undefined) references.push({ tag: node.tagName, name, value: attrs[name] });
    }
    if (attrs.srcset) {
      for (const candidate of attrs.srcset.split(',')) references.push({ tag: node.tagName, name: 'srcset', value: candidate.trim().split(/\s+/)[0] });
    }
  });
  documents.set(file, { ids, references });
}

const unsafeProtocol = /^[\u0000-\u0020]*(?:javascript|vbscript|data):/i;
for (const [file, { references }] of documents) {
  for (const { tag, name, value } of references) {
    const label = `${path.relative(root, file)}: <${tag}> ${name}="${value}"`;
    if (!value) {
      errors.push(`${label} is empty`);
      continue;
    }
    if (unsafeProtocol.test(value)) {
      errors.push(`${label} uses an unsafe URL protocol`);
      continue;
    }

    let url;
    try {
      const route = `/${path.relative(dist, file).split(path.sep).join('/')}`.replace(/\/index\.html$/, '/');
      url = new URL(value, `https://autonome.local${route}`);
    } catch {
      errors.push(`${label} is not a valid URL`);
      continue;
    }
    if (url.origin !== 'https://autonome.local') continue;

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      errors.push(`${label} contains invalid percent encoding`);
      continue;
    }
    if (pathname.includes('\0')) {
      errors.push(`${label} contains a null byte`);
      continue;
    }
    const relative = pathname.replace(/^\/+/, '');
    let target = path.join(dist, relative);
    if (!path.extname(target) || pathname.endsWith('/')) target = path.join(target, 'index.html');
    const normalized = path.resolve(target);
    if (normalized !== dist && !normalized.startsWith(`${dist}${path.sep}`)) {
      errors.push(`${label} resolves outside the built site`);
      continue;
    }
    let stat;
    try { stat = await fs.stat(normalized); } catch { /* reported below */ }
    if (!stat?.isFile()) {
      errors.push(`${label} points to missing internal target ${pathname}`);
      continue;
    }
    if (url.hash && normalized.endsWith('.html')) {
      const fragment = decodeURIComponent(url.hash.slice(1));
      const targetDocument = documents.get(normalized);
      if (!targetDocument?.ids.has(fragment)) errors.push(`${label} points to missing fragment #${fragment}`);
    }
  }
}

if (errors.length) throw new Error(`Site validation failed:\n- ${errors.join('\n- ')}`);
console.log(`Validated ${htmlFiles.length} HTML page(s): internal references and unsafe URL attributes are valid.`);
