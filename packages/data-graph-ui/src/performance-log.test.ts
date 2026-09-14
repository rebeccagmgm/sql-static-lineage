import { expect, it } from "vitest";
import { PerformanceHistory } from "./performance-log";

it("retains only bounded, whitelisted performance values", () => {
  const history = new PerformanceHistory(2);
  history.add({kind:"api", name:"search", durationMs:1, query:"private"} as never);
  history.add({kind:"long-task", name:"unknown", durationMs:180});
  history.add({kind:"api", name:"trace", durationMs:15, nodes:92, edges:129});
  const items = history.snapshot();
  expect(items).toHaveLength(2);
  expect(items[1]).toMatchObject({name:"trace", nodes:92, edges:129});
  expect(JSON.stringify(items)).not.toContain("private");
});

it("ignores malformed old storage and sanitizes restored events", () => {
  const history = new PerformanceHistory(2, [{kind:"api", name:"search", durationMs:8, sql:"private"}, null, {kind:"api", name:"select * secret"}]);
  expect(history.snapshot()).toHaveLength(1);
  expect(JSON.stringify(history.snapshot())).not.toContain("private");
});
