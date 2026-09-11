import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CardTopics } from "./CardTopics";

it("shows at most two topic names and indicates the remainder", () => {
  const html = renderToStaticMarkup(<CardTopics value={{ topics: [{ name: "a", label: "主题甲" }, { name: "b", label: "主题乙" }, { name: "c", label: "主题丙" }], total: 3, incomplete: false }} />);
  expect(html).toContain("主题甲");
  expect(html).toContain("主题乙");
  expect(html).not.toContain("主题丙");
  expect(html).toContain("另有 1 个");
});
it("distinguishes missing topics from loading and request failure", () => {
  expect(renderToStaticMarkup(<CardTopics />)).toContain("读取中");
  expect(renderToStaticMarkup(<CardTopics failed />)).toContain("暂不可用");
  expect(renderToStaticMarkup(<CardTopics value={{ topics: [], total: 0, incomplete: true }} />)).toContain("主题未确认");
});
