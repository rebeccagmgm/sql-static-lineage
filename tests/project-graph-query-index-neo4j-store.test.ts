import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  Neo4jQueryIndexStore,
  QUERY_INDEX_LABELS,
  QUERY_INDEX_RELATIONSHIP_TYPES,
  QUERY_INDEX_SCHEMA_STATEMENTS,
} from "../src/project-graph/query-index/neo4j-query-index-store.ts";

describe("query-index Neo4j namespace", () => {
  it("uses only the fixed Phase 3 labels, relationships and schema statements", () => {
    expect(QUERY_INDEX_LABELS).toEqual([
      "SLQueryIndexProject",
      "SLQueryIndexBuild",
      "SLIndexedNode",
    ]);
    expect(QUERY_INDEX_RELATIONSHIP_TYPES).toEqual([
      "SL_HAS_INDEX_BUILD",
      "SL_CURRENT_INDEX",
      "SL_HAS_INDEXED_NODE",
      "SL_INDEX_EDGE",
    ]);
    expect(QUERY_INDEX_SCHEMA_STATEMENTS).toHaveLength(5);
    for (const statement of QUERY_INDEX_SCHEMA_STATEMENTS) {
      expect(statement).toMatch(/^(CREATE CONSTRAINT|CREATE INDEX)/u);
      expect(statement).not.toMatch(/KGNode|ScheduleTask|Dataset|Column/u);
    }
  });

  it("keeps all deletion build-scoped and all domain values parameterized", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/project-graph/query-index/neo4j-query-index-store.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("MATCH (n) DETACH DELETE n");
    expect(source).not.toContain("MATCH (n) DELETE n");
    expect(source).not.toMatch(/KGNode|ScheduleTask|:Dataset|:Column/u);
    expect(source).toContain(
      "MATCH (n:SLIndexedNode {indexBuildId: $indexBuildId})",
    );
    expect(source).toContain("UNWIND $rows AS row");
    expect(source).toContain(
      "MATCH (from:SLIndexedNode {recordKey: row.fromRecordKey})",
    );
    expect(source).toContain(
      "MATCH (to:SLIndexedNode {recordKey: row.toRecordKey})",
    );
    expect(source).toContain("WHERE from.indexBuildId = $indexBuildId");
    expect(source).toContain("AND to.indexBuildId = $indexBuildId");
    expect(source).not.toContain(
      "MATCH (b)-[:SL_HAS_INDEXED_NODE]->(from:SLIndexedNode",
    );
    expect(
      source.match(/SKIP toInteger\(\$offset\) LIMIT toInteger\(\$limit\)/gu),
    ).toHaveLength(2);
    expect(source).toContain("session.executeWrite(work)");
  });

  it("exposes a bounded graph-native upstream path query", async () => {
    const calls: {
      readonly statement: string;
      readonly parameters: unknown;
    }[] = [];
    const transaction = {
      run: async (statement: string, parameters: unknown) => {
        calls.push({ statement, parameters });
        return {
          records: [
            {
              get: (key: string) =>
                key === "nodeIds"
                  ? ["task:root", "task:producer"]
                  : ["edge:bridge"],
            },
          ],
        };
      },
    };
    const driver = {
      session: () => ({
        executeRead: async (
          work: (value: typeof transaction) => Promise<unknown>,
        ) => work(transaction),
        close: async () => undefined,
      }),
    } as never;
    const store = new Neo4jQueryIndexStore(driver, "neo4j");
    const paths = await store.traceProjectUpstreamGraphNative({
      indexBuildId: "build-1",
      projectionSnapshotId: "snapshot-1",
      startNodeId: "task:root",
      maxHops: 3,
      limit: 2,
    });
    expect(paths).toEqual([
      { nodeIds: ["task:root", "task:producer"], edgeIds: ["edge:bridge"] },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.statement).toContain("ALL(r IN relationships(p)");
    expect(calls[0]!.statement).toContain("LIMIT toInteger($limit)");
    expect(calls[0]!.statement).not.toContain("RETURN n");
  });
});
