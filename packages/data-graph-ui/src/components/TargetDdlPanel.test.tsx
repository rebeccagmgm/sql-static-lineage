import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { api } from "../api";
import { TargetDdlPanel } from "./TargetDdlPanel";

it("starts collapsed and does not fetch DDL before expansion", () => {
  const fetch = vi.spyOn(api, "task");
  const html = renderToStaticMarkup(<TargetDdlPanel detail={{
    version: "v1", taskId: "78571", bindings: [], controls: [],
  }} />);
  expect(html).toContain("<summary>目标表 DDL</summary>");
  expect(html).not.toContain("open=");
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
