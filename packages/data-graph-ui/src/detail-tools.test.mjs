import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SqlCode, highlightSql } from "./components/SqlCode";
import { ResizableWorkspace, clampDetailWidth, draggedDetailWidth, maxDetailWidth } from "./components/ResizableWorkspace";

describe("resizable details", () => {
  it("grows to the left and keeps both detail and canvas usable", () => {
    const max=maxDetailWidth(1080);
    expect(draggedDetailWidth(340,800,700,max)).toBe(440);
    expect(draggedDetailWidth(340,800,100,max)).toBe(max);
    expect(draggedDetailWidth(340,800,1000,max)).toBe(320);
    expect(max+260+320+8+3).toBeLessThanOrEqual(1080);
    expect(clampDetailWidth(Number.NaN,max)).toBe(340);
  });
  it("provides a focusable vertical separator and retains all three panels", () => {
    const html=renderToStaticMarkup(createElement(ResizableWorkspace,null,
      createElement("aside",null,"navigation"),createElement("main",null,"graph"),createElement("aside",null,"detail"),
    ));
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('tabindex="0"');
    for(const text of ["navigation","graph","detail"])expect(html).toContain(text);
  });
});
describe("SQL presentation", () => {
  it("highlights keywords, literals and comments without allowing source HTML to execute", () => {
    const html=highlightSql("SELECT '中文 <img src=x onerror=alert(1)>' AS label, 42\n-- 保留注释\nFROM trades;");
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-string');
    expect(html).toContain('hljs-comment');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("\n");
  });
  it("retains SQL text, indentation and newlines with line numbers and copy control", () => {
    const sql="SELECT a,\n  '值' AS b\nFROM trades;\n";
    const highlighted=highlightSql(sql);
    const text=highlighted.replace(/<[^>]*>/g,"").replaceAll("&#x27;","'").replaceAll("&quot;",'\"').replaceAll("&gt;",">").replaceAll("&lt;","<").replaceAll("&amp;","&");
    expect(text).toBe(sql);
    const html=renderToStaticMarkup(createElement(SqlCode,{source:sql}));
    expect(html).toContain("复制 SQL");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("1\n2\n3\n4");
    expect(html).toContain('language-sql');
  });
});

