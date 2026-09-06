import { describe, expect, it } from "vitest";
import { AssetGraphStore } from "../packages/data-graph/src/asset-graph/store.ts";

const record = (values: Record<string, unknown>) => ({
  get: (name: string) => values[name],
});
const node = (id: string, kind: string, detail: Record<string, unknown> = {}) => ({
  id,
  kind,
  label: id,
  detail: JSON.stringify(detail),
  table: "ref.config",
  column: kind.endsWith("FIELD") ? "code" : undefined,
});
const edge = (from: string, to: string) => ({
  key: `${from}->${to}`,
  from,
  to,
  kind: "FIELD_DIRECT",
  layer: "field",
  status: "CONFIRMED",
  detail: "{}",
});

type StoreDriver = ConstructorParameters<typeof AssetGraphStore>[0];

function fakeDriver(options: {
  anchors: Record<string, unknown>[];
  neighbors?: Record<string, unknown>[];
}): StoreDriver & { expansionCalls: number } {
  let expansionCalls = 0;
  const driver = {
    session: () => ({
      run: async (query: string) => {
        if (query.includes("RETURN properties(g) AS g"))
          return { records: [record({ g: { state: "READY", version: "v1" } })] };
        if (query.includes("UNWIND $keys AS anchor")) {
          expansionCalls += 1;
          return {
            records: (options.neighbors ?? []).map((n) =>
              record({ source: node("task:root", "WRITE_FIELD"), node: n, edge: edge(String(n.id), "task:root") }),
            ),
          };
        }
        return {
          records: options.anchors.map((n) => record({ node: n })),
        };
      },
      close: async () => undefined,
    }),
    get expansionCalls() {
      return expansionCalls;
    },
  } as unknown as StoreDriver & { expansionCalls: number };
  return driver;
}

describe("asset graph reference-config terminals", () => {
  it("keeps a terminal read visible and does not expand it upstream", async () => {
    const terminal = node("read:ref", "READ_FIELD", {
      continuationDisposition: "POLICY_TERMINAL",
      boundaryRole: "REFERENCE_CONFIG",
      terminalReason: "按定义/参数表规则停止展开",
      terminalRuleRef: "config/ref.json#/tables/ref.config",
      terminalConfigHash: "sha256:test",
    });
    const store = new AssetGraphStore(
      fakeDriver({ anchors: [node("task:root", "WRITE_FIELD")], neighbors: [terminal] }),
      "db",
      "graph",
    );
    const result = await store.traverse({
      taskId: "root",
      column: "code",
      layer: "field",
      depth: 4,
    });
    expect(result.terminalNodes).toEqual([
      {
        nodeId: "read:ref",
        role: "REFERENCE_CONFIG",
        reason: "按定义/参数表规则停止展开",
        ruleRef: "config/ref.json#/tables/ref.config",
      },
    ]);
    expect(result.nodes.map((n) => n.id)).toEqual(["task:root", "read:ref"]);
    expect(result.truncated).toBe(false);
    expect(result.stoppedBy).toBeNull();
    expect((store.driver as unknown as { expansionCalls: number }).expansionCalls).toBe(1);
  });

  it("treats a terminal anchor as a normal complete result", async () => {
    const terminal = node("read:ref", "READ_FIELD", {
      continuationDisposition: "POLICY_TERMINAL",
      boundaryRole: "REFERENCE_CONFIG",
      terminalReason: "按定义/参数表规则停止展开",
      terminalRuleRef: "rule-1",
    });
    const driver = fakeDriver({ anchors: [terminal], neighbors: [node("read:unexpected", "READ_FIELD")] });
    const result = await new AssetGraphStore(driver, "db", "graph").traverse({
      nodeId: "read:ref",
      layer: "field",
      direction: "up",
      depth: 0,
    });
    expect(result.terminalNodes[0]?.nodeId).toBe("read:ref");
    expect(result.stoppedBy).toBeNull();
    expect(driver.expansionCalls).toBe(0);
  });
});
