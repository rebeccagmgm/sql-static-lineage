import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileNarrative, renderProse } from "./narrative.mjs";

const records = JSON.parse(
  readFileSync(new URL("analysis-sales.json", import.meta.url), "utf8"),
);
test("authored explanations cover every stage exactly once and retain usable prose", () => {
  for (const record of records.filter((r) => r.narrativeFile)) {
    const markdown = readFileSync(
      new URL(record.narrativeFile, import.meta.url),
      "utf8",
    );
    const result = compileNarrative(markdown, record);
    assert.deepEqual(
      result.sections.map((s) => s.id),
      record.stages.map((s) => s.id),
    );
    assert.ok(result.intro.includes("<p>"));
    assert.ok(result.sections.every((s) => s.html.length > 100));
    assert.throws(
      () =>
        compileNarrative(
          markdown.replace(/^## .+\r?\n/m, "## Unknown stage\n"),
          record,
        ),
      /NARRATIVE_STAGE_MISSING/,
    );
  }
});
test("a missing or repeated stage cannot silently disappear from the reading path", () => {
  const record = {
    taskId: "example",
    stages: [
      { id: "a", title: "First" },
      { id: "b", title: "Second" },
    ],
  };
  for (const markdown of [
    "Intro\n\n## First\nBody",
    "Intro\n\n## First\nBody\n\n## First\nAgain",
  ])
    assert.throws(
      () => compileNarrative(markdown, record),
      /NARRATIVE_STAGE_COVERAGE/,
    );
});
test("Markdown is escaped and malformed source structures fail explicitly", () => {
  const html = renderProse(
    '<img src=x onerror="alert(1)"> **emphasis** `a < b`\n\n```text\n</script>\n```\n\n|Rule|Result|\n|---|---|\n|`key`|<value>|',
  );
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("</script>"));
  assert.ok(html.includes("<strong>emphasis</strong>"));
  assert.ok(html.includes("<code>a &lt; b</code>"));
  assert.ok(html.includes("<td>&lt;value&gt;</td>"));
  assert.throws(
    () => renderProse("```sql\nunclosed"),
    /NARRATIVE_UNCLOSED_CODE/,
  );
  assert.throws(
    () => renderProse("|header|\n|not a delimiter|"),
    /NARRATIVE_INVALID_TABLE/,
  );
});
