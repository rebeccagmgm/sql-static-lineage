import test from "node:test";
import assert from "node:assert/strict";
import { renderReading } from "./reading.mjs";

test("renders readable sections, tables and allowlisted evidence navigation", () => {
  const html = renderReading('# Title\n\n## Chapter\n\n| A | B |\n| --- | --- |\n| **amount** | `value` |\n\n[Source](evidence.md#e3)', { 'evidence.md': 'evidence' });
  assert.match(html, /<details[^>]+open>/);
  assert.match(html, /<th>A<\/th>/);
  assert.match(html, /<strong>amount<\/strong>/);
  assert.match(html, /data-reading="evidence" data-anchor="e3"/);
});

test("escapes HTML and SQL and rejects unregistered links", () => {
  const html = renderReading('# <img src=x onerror=alert(1)>\n\n```sql\n</pre><script>bad()</script>\n```');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;\/pre&gt;/);
  assert.throws(() => renderReading('[bad](javascript:alert)'), /Unmapped reading link/);
});

test("retains branching routes and configured-output qualifier from the source", () => {
  const html = renderReading('```mermaid\nflowchart LR\n A[base] --> B[daily]\n A --> C[income]\n B --> C\n C -.配置输出关联.-> D[target]\n```');
  assert.equal((html.match(/<li>/g) ?? []).length, 4);
  assert.match(html, /base<span[^>]+> →  <\/span>income/);
  assert.match(html, /配置输出关联/);
});

test("evidence anchors sit outside collapsed sections so navigation can open the target", () => {
  const html = renderReading('## First\ntext\n\n<a id="e3"></a>\n\n## Formula\ntext');
  assert.match(html, /<\/details><span id="reading-e3"[^>]*><\/span><details/);
});
