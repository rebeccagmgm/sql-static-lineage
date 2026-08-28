import { mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { writeTableInput, writeTaskInput } from "../scripts/input/shared/input-pack.ts";
import { inputPackTaskBatches } from "../scripts/reconcile/consumer/one-hop/reconcile-one-hop-autofill.ts";
import { runInputPackClosure } from "../scripts/pipeline/input-pack-closure.ts";

const FIXED_NOW = "2026-08-27T00:00:00.000Z";

function root(): string {
  return mkdtempSync(join(tmpdir(), "sql-lineage-input-pack-closure-"));
}

function writeTable(rootPath: string, qualifiedName: string): void {
  const [schema, name] = qualifiedName.split(".");
  writeTableInput(rootPath, {
    platform: "hive",
    dataSource: "gfhive",
    qualifiedName,
    schema,
    name,
    objectType: "TABLE",
    ddl: `CREATE TABLE ${qualifiedName} (id bigint)`,
    evidenceProvider: "fixture:table",
    collectedAt: FIXED_NOW,
  });
}

function writeTask(rootPath: string, taskId: string, sql: string, target?: string): void {
  writeTaskInput(rootPath, {
    taskId,
    taskCategory: "hiveTask-2.0",
    collectedAt: FIXED_NOW,
    evidenceProvider: "fixture:task",
    ...(target
      ? {
          target: {
            platform: "hive",
            dataSource: "gfhive",
            qualifiedName: target,
          },
          targetEvidenceKind: "DIRECT_PLATFORM_TARGET" as const,
          writeMode: "OVERWRITE" as const,
        }
      : {}),
    sql: {
      query: {
        content: sql,
        evidenceProvider: "fixture:sql",
      },
    },
  });
}

describe("input pack closure", () => {
  it("splits collection requests at the collector hard limit", () => {
    const batches = inputPackTaskBatches(
      Array.from({ length: 1201 }, (_, index) => String(index + 1)),
    );
    expect(batches.map((batch) => batch.length)).toEqual([1000, 201]);
    expect(batches.flat()).toHaveLength(1201);
  });

  it("discovers and collects a producer when the table is missing from the local index", () => {
    const dataRoot = root();
    writeTable(dataRoot, "odata.source_table");
    writeTask(dataRoot, "A", "SELECT id FROM odata.source_table");
    const collected: string[] = [];
    let discoveryCalls = 0;

    const result = runInputPackClosure({
      taskId: "A",
      dataRoot,
      producerIndexCacheRoot: join(dirname(dataRoot), `${dataRoot.split(/[\\/]/).at(-1)}-producer-index-cache`),
      maxDepth: 3,
      maxTasks: 20,
      maxRounds: 4,
      maxDiscoveryTables: 10,
      discoveryMinIntervalMs: 0,
      discoveryAttempts: 1,
      discoverTableProducerTaskIds: (qualifiedName) => {
        discoveryCalls += 1;
        expect(qualifiedName).toBe("odata.source_table");
        return ["B"];
      },
      collectTaskPacks: (_root, taskIds) => {
        collected.push(...taskIds);
        expect(taskIds).toEqual(["B"]);
        writeTask(dataRoot, "B", "INSERT OVERWRITE TABLE odata.source_table SELECT 1 AS id", "odata.source_table");
      },
    });

    expect(discoveryCalls).toBe(1);
    expect(collected).toEqual(["B"]);
    expect(result.status).toBe("COMPLETE");
    expect(result.taskIds).toEqual(["A", "B"]);
    expect(result.collectedTaskIds).toEqual(["B"]);
    expect(result.rounds).toBe(2);
  });

  it("does not discover producers behind a configured terminal reference table", () => {
    const dataRoot = root();
    writeTable(dataRoot, "pdata_n.ref_cd_cvt_map");
    writeTask(dataRoot, "A", "SELECT id FROM pdata_n.ref_cd_cvt_map");
    const terminalTableConfig = {
      version: "test",
      stopRoles: ["REFERENCE_CONFIG"],
      roles: {
        REFERENCE_CONFIG: {
          qualifiedNameExact: ["pdata_n.ref_cd_cvt_map"],
          qualifiedNameTerms: ["never-match"],
        },
      },
    } as const;
    let discoveryCalls = 0;

    const result = runInputPackClosure({
      taskId: "A",
      dataRoot,
      producerIndexCacheRoot: join(
        dirname(dataRoot),
        `${dataRoot.split(/[\\/]/).at(-1)}-producer-index-cache`,
      ),
      maxDepth: 3,
      maxTasks: 20,
      maxRounds: 4,
      terminalTableConfig,
      discoverTableProducerTaskIds: () => {
        discoveryCalls += 1;
        throw new Error("terminal table must not be discovered");
      },
      collectTaskPacks: () => {
        throw new Error("terminal table must not collect a producer");
      },
    });

    expect(discoveryCalls).toBe(0);
    expect(result.status).toBe("COMPLETE");
    expect(result.taskIds).toEqual(["A"]);
    expect(result.discoveredTaskIds).toEqual(["A"]);
  });
});
