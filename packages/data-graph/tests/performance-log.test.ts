import { expect, it } from "vitest";
import { RequestPerformanceLog } from "../src/asset-graph/performance-log.ts";

it("keeps a bounded request history and exposes unfinished work without query content", () => {
  let now = 100;
  const log = new RequestPerformanceLog(2, () => now);
  const pending = log.start("/api/search?secret=never-log");
  for (let i = 0; i < 3; i++) { const id = log.start("/api/trace"); now += 50; log.finish(id, 200); }
  const snapshot = log.snapshot();
  expect(snapshot.recent).toHaveLength(2);
  expect(snapshot.pending).toEqual([{id:pending, path:"/api/search", elapsedMs:150}]);
  expect(JSON.stringify(snapshot)).not.toContain("secret");
  log.disconnect(pending);
  expect(log.snapshot().pending[0]).toMatchObject({id:pending,clientDisconnected:true});
  log.finish(pending, 0, true);
  log.finish(pending, 200);
  expect(log.snapshot().pending).toHaveLength(0);
  expect(log.snapshot().recent.at(-1)).toMatchObject({aborted:true, status:0, durationMs:150});
});

it("retains sanitized browser reports and never logs its own transport", () => {
  const log = new RequestPerformanceLog();
  const clientId = "12345678-abcd-1234-abcd-123456789abc";
  log.recordBrowser({clientId,browserFamily:"edge",events:[{kind:"long-task",name:"search",durationMs:1450,sql:"do not retain"}, {kind:"action",name:"private table name"}]});
  expect(log.snapshot().browsers[0]?.browserFamily).toBe("edge");
  expect(log.snapshot().browsers[0]?.events).toHaveLength(1);
  expect(log.snapshot().browsers[0]?.events[0]).toMatchObject({durationMs:1450,name:"search"});
  expect(JSON.stringify(log.snapshot())).not.toContain("do not retain");
  log.start("/api/diagnostics/browser");
  expect(log.snapshot().pending).toHaveLength(0);
  expect(() => log.recordBrowser({clientId:"bad",events:[]})).toThrow("INVALID_BROWSER_DIAGNOSTICS");
  expect(() => log.recordBrowser({clientId,events:Array(201).fill({})})).toThrow("INVALID_BROWSER_DIAGNOSTICS");
});
