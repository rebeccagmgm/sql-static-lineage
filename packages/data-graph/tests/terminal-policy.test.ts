import { describe, expect, it } from "vitest";
import {
  buildTerminalPolicySnapshot,
  assertTerminalPolicySnapshot,
  terminalPolicyConfigHash,
  terminalNodeDetails,
} from "../src/asset-graph/terminal-policy.ts";
import type { UnionContinuationIndex } from "../src/project-graph/topology/task-local-union/union-continuation-index.ts";

const config = {
  version: "1.0.0",
  stopRoles: ["REFERENCE_CONFIG"],
  roles: { REFERENCE_CONFIG: { qualifiedNameTerms: ["grp_def", "_param"] } },
};
const index = {
  contentHash: "index-hash",
  entries: [
    {
      consumerTaskId: "1",
      readOccurrenceId: "r1",
      qualifiedName: "dm.grp_def",
      identityStatus: "CONFIRMED",
      candidates: [{ l1Eligible: true }],
    },
    {
      consumerTaskId: "2",
      readOccurrenceId: "r2",
      qualifiedName: "dm.contract_param",
      identityStatus: "CONFIRMED",
      candidates: [],
    },
    {
      consumerTaskId: "3",
      readOccurrenceId: "r3",
      qualifiedName: "dm.grp_def",
      identityStatus: "UNKNOWN",
      candidates: [],
    },
    {
      consumerTaskId: "4",
      readOccurrenceId: "r4",
      qualifiedName: "dm.trades",
      identityStatus: "CONFIRMED",
      candidates: [],
    },
  ],
} as unknown as UnionContinuationIndex;

describe("published terminal policy", () => {
  it("marks identified reads regardless of writer availability, preserving the raw INDEX", () => {
    const before = JSON.stringify(index);
    const snapshot = buildTerminalPolicySnapshot(index, config);
    expect(snapshot.reads.map((r) => r.readOccurrenceId)).toEqual(["r1", "r2"]);
    expect(snapshot.reads[0]).toMatchObject({ role: "REFERENCE_CONFIG" });
    expect(snapshot.reads[0].ruleRef).toContain("grp_def");
    expect(JSON.stringify(index)).toBe(before);
    expect(() =>
      assertTerminalPolicySnapshot(
        snapshot,
        index.contentHash,
        snapshot.contentHash,
      ),
    ).not.toThrow();
  });

  it("binds the snapshot to both INDEX and the frozen policy content", () => {
    const snapshot = buildTerminalPolicySnapshot(index, config);
    expect(() =>
      assertTerminalPolicySnapshot(
        snapshot,
        "other-index",
        snapshot.contentHash,
      ),
    ).toThrow();
    expect(() =>
      assertTerminalPolicySnapshot(
        { ...snapshot, reads: [] },
        index.contentHash,
        snapshot.contentHash,
      ),
    ).toThrow();
    expect(terminalPolicyConfigHash({ ...config, stopRoles: [] })).not.toBe(
      snapshot.configHash,
    );
  });

  it("provides explicit human-readable graph terminal metadata", () => {
    expect(terminalNodeDetails("dm.grp_def", config)).toMatchObject({
      continuationDisposition: "POLICY_TERMINAL",
      boundaryRole: "REFERENCE_CONFIG",
      terminalReason: "按定义/参数表规则停止展开",
    });
    expect(terminalNodeDetails("dm.trades", config)).toBeNull();
  });
});
