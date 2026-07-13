import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const unsafeMarkup = /<(?:script|iframe|object|embed|svg|math)\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']?\s*(?:javascript|vbscript|data):/i;

/** Render CMS-authored Markdown through a strict allowlist. */
export function renderMarkdown(markdown, source = 'Markdown') {
  const rendered = marked.parse(markdown, { async: false });
  const clean = sanitizeHtml(rendered, {
    allowedTags: [
      'p', 'br', 'hr', 'blockquote', 'pre', 'code', 'strong', 'em', 'del',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub'
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard'
  });
  if (unsafeMarkup.test(clean)) throw new Error(`${source}: Markdown sanitizer produced unsafe HTML`);
  return clean;
}
