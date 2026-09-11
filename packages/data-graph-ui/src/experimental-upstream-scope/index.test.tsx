import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UpstreamScopePanel, UpstreamScopeStatus, type ScopedOverview } from "./index";

describe("experimental upstream scope presentation", () => {
  it("starts inactive with the requested escaped pattern and an explicit apply action", () => {
    const html = renderToStaticMarkup(<UpstreamScopePanel patterns={[]} onApply={() => {}} onExit={() => {}} />);
    expect(html).toContain("%t01\\_%");
    expect(html).toContain("当前未启用范围筛选");
    expect(html).toContain("应用范围");
    expect(html).toContain("退出范围");
  });
  it("distinguishes completed closure from a limited canvas", () => {
    const overview = { scope: { rootCount: 2, tableCount: 2000, visibleTableCount: 1999, visibleRelationCount: 5000 }, truncated: { regions: false, flows: true } } as ScopedOverview;
    const html = renderToStaticMarkup(<UpstreamScopeStatus overview={overview} />);
    expect(html).toContain("2000");
    expect(html).toContain("范围已算完，但区域画布只展示限额内的部分结果");
  });
});
