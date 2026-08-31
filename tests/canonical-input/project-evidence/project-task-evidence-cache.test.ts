import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildRawOneHopCacheLookupIdentity,
  rawOneHopCachePath,
  readRawOneHopCache,
  rebindOneHopProducerIndexProvenance,
  rebindOneHopScheduleProvenance,
  writeRawOneHopCache,
} from "../../../src/canonical-input/project-evidence/task-evidence-cache.ts";
import type { OneHopReconciliationResult } from "../../../src/contracts/canonical-artifacts.ts";
import type { TableProducerIndex } from "../../../src/canonical-input/project-evidence/task-evidence-cache.ts";
import {
  FIXTURE_INPUT_FINGERPRINT,
  FIXTURE_PRODUCER_INDEX_HASH,
  projectTopologyFixturePair,
} from "../../../tests/fixtures/project-topology/cases.ts";

function cacheRoot(): string {
  return mkdtempSync(join(tmpdir(), "project-task-evidence-cache-"));
}

function identity(scheduleRows: readonly Record<string, unknown>[] = []) {
  return buildRawOneHopCacheLookupIdentity({
    taskId: "root-1",
    taskInputContentHash: "c".repeat(64),
    machineFactsManifestHash: "d".repeat(64),
    scheduleRows,
    terminalConfigContentHash: "e".repeat(64),
  });
}

function producerIndex(
  input: {
    readonly contentHash?: string;
    readonly inputFingerprint?: string;
    readonly confirmedProducerEdges?: readonly Record<string, unknown>[];
  } = {},
): TableProducerIndex {
  return {
    schemaVersion: "1.1.0",
    artifactType: "TABLE_PRODUCER_INDEX",
    generatedAt: "2026-08-29T00:00:00.000Z",
    buildStatus: "SUCCESS",
    coverageSemantics: "OBSERVED_EVIDENCE_ONLY",
    inputFingerprint: input.inputFingerprint ?? FIXTURE_INPUT_FINGERPRINT,
    confirmedProducerEdges: input.confirmedProducerEdges ?? [],
    nonConfirmedRelations: [],
    intermediateMaterializations: [],
    counts: {},
    issues: [],
    boundaries: {},
    contentHash: input.contentHash ?? FIXTURE_PRODUCER_INDEX_HASH,
  } as unknown as TableProducerIndex;
}

function resultWithDirectRead(): OneHopReconciliationResult {
  const fixture = projectTopologyFixturePair().oneHop;
  return {
    ...fixture,
    currentTask: {
      ...fixture.currentTask,
      directReads: [
        {
          table: {
            platform: "hive",
            dataSource: "warehouse-a",
            qualifiedName: "dm.shared_source",
            identityStatus: "RESOLVED",
          },
        },
      ],
    },
  } as unknown as OneHopReconciliationResult;
}

describe("raw one-hop Task-local cache", () => {
  it("uses one canonical file per Task and atomically replaces stale or corrupt entries", () => {
    const root = cacheRoot();
    const expectedIdentity = identity();
    const index = producerIndex();
    const result = projectTopologyFixturePair().oneHop;
    const path = rawOneHopCachePath(root, "root-1");

    expect(readRawOneHopCache(root, expectedIdentity, index)).toMatchObject({
      status: "MISS",
      reason: "NOT_FOUND",
      path,
    });
    expect(
      writeRawOneHopCache(root, expectedIdentity, index, result).status,
    ).toBe("CREATED");
    expect(readRawOneHopCache(root, expectedIdentity, index)).toMatchObject({
      status: "HIT",
      result,
    });
    expect(
      readRawOneHopCache(
        root,
        identity([{ task_id: "changed-parent" }]),
        index,
      ),
    ).toMatchObject({ status: "MISS", reason: "TASK_INPUT_CHANGED", path });

    writeFileSync(path, "{corrupt", "utf8");
    expect(readRawOneHopCache(root, expectedIdentity, index)).toMatchObject({
      status: "INVALID",
      path,
    });
    expect(
      writeRawOneHopCache(root, expectedIdentity, index, result).status,
    ).toBe("REPLACED");
    expect(readRawOneHopCache(root, expectedIdentity, index).status).toBe(
      "HIT",
    );
  });

  it("ignores unrelated Input Pack growth but invalidates a relevant producer change", () => {
    const root = cacheRoot();
    const expectedIdentity = identity();
    const originalIndex = producerIndex();
    const result = resultWithDirectRead();
    writeRawOneHopCache(root, expectedIdentity, originalIndex, result);

    const unrelatedGrowth = producerIndex({
      contentHash: "1".repeat(64),
      inputFingerprint: "2".repeat(64),
      confirmedProducerEdges: [
        {
          taskId: "unrelated-producer",
          taskCategory: "sql",
          taskContentHash: "3".repeat(64),
          table: {
            platform: "hive",
            dataSource: "warehouse-a",
            qualifiedName: "dm.unrelated_table",
            identityStatus: "RESOLVED",
          },
          writes: [],
        },
      ],
    });
    const unrelatedRead = readRawOneHopCache(
      root,
      expectedIdentity,
      unrelatedGrowth,
    );
    expect(unrelatedRead.status).toBe("HIT");
    if (unrelatedRead.status !== "HIT") throw new Error("expected cache hit");
    expect(
      rebindOneHopProducerIndexProvenance(unrelatedRead.result, unrelatedGrowth)
        .producerIndex,
    ).toMatchObject({
      contentHash: "1".repeat(64),
      inputFingerprint: "2".repeat(64),
    });

    const relevantGrowth = producerIndex({
      contentHash: "4".repeat(64),
      inputFingerprint: "5".repeat(64),
      confirmedProducerEdges: [
        {
          taskId: "new-relevant-producer",
          taskCategory: "sql",
          taskContentHash: "6".repeat(64),
          table: {
            platform: "hive",
            dataSource: "warehouse-a",
            qualifiedName: "dm.shared_source",
            identityStatus: "RESOLVED",
          },
          writes: [
            {
              observationKind: "SQL_EXPLICIT_WRITE",
              dataPathRole: "PRODUCER",
              partition: [],
              evidence: [],
            },
          ],
        },
      ],
    });
    expect(
      readRawOneHopCache(root, expectedIdentity, relevantGrowth),
    ).toMatchObject({
      status: "MISS",
      reason: "PRODUCER_EVIDENCE_CHANGED",
    });
  });

  it("rebinds current schedule acquisition provenance without changing semantics", () => {
    const relationEvidence = {
      source: "HORAE_RELATION",
      provider: "old-provider",
      locator: "old-locator",
      observedAt: "2026-08-28T00:00:00.000Z",
      detail: {
        direction: "up",
        depth: 1,
        relationDirection: "上游",
      },
    } as const;
    const rootEvidence = {
      ...relationEvidence,
      detail: {
        direction: "up",
        depth: 1,
        rowsProvided: 1,
        cacheStatus: "MISS",
        cachePath: "old-cache",
      },
    } as const;
    const fixture = projectTopologyFixturePair().oneHop;
    const cached = {
      ...fixture,
      schedule: {
        direction: "UPSTREAM",
        depth: 1,
        parents: [
          {
            taskId: "parent-1",
            taskName: "parent",
            evidence: [relationEvidence],
          },
        ],
        evidence: [rootEvidence],
      },
      parents: [
        {
          taskId: "parent-1",
          taskName: "parent",
          scheduleEvidence: [relationEvidence],
          inputPackStatus: "MISSING",
          resolutionStatus: "MISSING",
          confirmedWrites: [],
          unconfirmedTargets: [],
          issues: [],
        },
      ],
    } as unknown as OneHopReconciliationResult;

    const rebound = rebindOneHopScheduleProvenance(cached, {
      rows: [{ task_id: "parent-1", direction: "上游" }],
      provider: "opencli:horae.relation",
      locator: "current-locator",
      observedAt: "2026-08-29T00:00:00.000Z",
      cacheStatus: "HIT",
      cachePath: "current-cache",
    });

    expect(rebound.schedule.evidence[0]).toMatchObject({
      provider: "opencli:horae.relation",
      locator: "current-locator",
      observedAt: "2026-08-29T00:00:00.000Z",
      detail: { cacheStatus: "HIT", cachePath: "current-cache" },
    });
    expect(rebound.schedule.parents[0]).toMatchObject({
      evidence: [
        { locator: "current-locator", detail: { relationDirection: "上游" } },
      ],
    });
    expect(rebound.parents[0]).toMatchObject({
      scheduleEvidence: [{ locator: "current-locator" }],
    });
  });
});
