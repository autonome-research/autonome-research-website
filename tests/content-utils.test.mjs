import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../scripts/content-utils.mjs';

test('sanitizer removes executable elements and event attributes', () => {
  const html = renderMarkdown('<script>alert(1)</script><img src="https://example.com/x.png" onerror="alert(1)">');
  assert.doesNotMatch(html, /script|onerror/i);
  assert.match(html, /<img/);
});

test('sanitizer removes unsafe URL protocols', () => {
  const html = renderMarkdown('[bad](javascript:alert(1))\n\n<img src="data:text/html,boom">');
  assert.doesNotMatch(html, /javascript:|data:/i);
});

test('sanitizer preserves safe academic article markup', () => {
  const html = renderMarkdown('## Heading\n\nA **strong** [reference](https://example.com).\n\n- one\n- two');
  assert.match(html, /<h2>Heading<\/h2>/);
  assert.match(html, /<strong>strong<\/strong>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /<ul>/);
});
