import { describe, it, expect, vi } from "vitest";
import { parseAgentArgs, assetGraphMain } from "../src/asset-graph/cli.ts";

// These factories fail even if a module is imported but none of its exports are used.
vi.mock("../src/asset-graph/publish.ts", () => {
  throw new Error("HELP_LOADED_PUBLISH");
});
vi.mock("../src/asset-graph/config.ts", () => {
  throw new Error("HELP_LOADED_DATABASE");
});
vi.mock("../src/asset-graph/service.ts", () => {
  throw new Error("HELP_LOADED_SERVICE");
});
vi.mock("../src/asset-graph/agent-api.ts", () => {
  throw new Error("HELP_LOADED_PROCESSING");
});
vi.mock("../src/asset-graph/continuation-metrics-query.ts", () => {
  throw new Error("HELP_LOADED_METRICS");
});
vi.mock("../src/asset-graph/continuation-candidates-query.ts", () => {
  throw new Error("HELP_LOADED_CANDIDATES");
});
describe("agent CLI argument contract", () => {
  it("accepts an exact processing relation and requires its value", () => {
    const a = parseAgentArgs([
      "processing",
      "--task-id",
      "220650",
      "--relation-id",
      "relation:aggregate",
    ]);
    expect(a.option("--relation-id")).toBe("relation:aggregate");
    expect(() => parseAgentArgs(["processing", "--relation-id"])).toThrow(
      "ARGUMENT_VALUE_REQUIRED",
    );
  });
  it("rejects misspelled options instead of broadening a query", () => {
    expect(() => parseAgentArgs(["trace", "--task-idsx", "86842"])).toThrow(
      "INVALID_ARGUMENT",
    );
  });
  it("rejects missing values and unbounded traversal requests", () => {
    expect(() => parseAgentArgs(["trace", "--column"])).toThrow(
      "ARGUMENT_VALUE_REQUIRED",
    );
    const a = parseAgentArgs(["trace", "--depth", "100"]);
    expect(() => a.integer("--depth", 4, 12)).toThrow("INVALID_ARGUMENT");
  });
  it("preserves explicit field scope and candidate policy", () => {
    const a = parseAgentArgs([
      "trace",
      "--task-id",
      "86842",
      "--column",
      "init_nom_prin",
      "--write-id",
      "write-observation:86842:8",
      "--confirmed-only",
    ]);
    expect(a.option("--write-id")).toBe("write-observation:86842:8");
    expect(a.flag("--confirmed-only")).toBe(true);
  });
  it("accepts bounded published read-candidate query options", () => {
    const a = parseAgentArgs([
      "query-read-candidates",
      "--read-occurrence-id",
      "read-occurrence:119044:0",
      "--consumer-task-id",
      "119044",
      "--publication-version",
      "f88164",
      "--limit",
      "25",
    ]);
    expect(a.option("--read-occurrence-id")).toBe("read-occurrence:119044:0");
    expect(a.option("--publication-version")).toBe("f88164");
    expect(a.integer("--limit", 25, 100, 1)).toBe(25);
  });
  it("returns help without loading the publish pipeline", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((value) => {
      logs.push(String(value));
    });
    try {
      await assetGraphMain(["help"]);
      expect(logs).toHaveLength(1);
      const payload = JSON.parse(logs[0]!);
      expect(payload.ok).toBe(true);
      expect(payload.name).toBe("lineage-graph");
      expect(payload.metaTiming?.elapsedMs).toContain("assetGraphMain()");
    } finally {
      spy.mockRestore();
    }
  });
});
