import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  canonicalHash,
  type JsonValue,
} from "../scripts/input/shared/input-pack.ts";
import {
  createPhysicalFieldExpander,
  type PhysicalFieldExpanderTaskPack,
} from "../scripts/reconcile/consumer/field-lineage/physical-field-expander.ts";
import {
  createCachedPhysicalFieldExpander,
  createExpansionCacheCounters,
} from "../scripts/reconcile/consumer/field-lineage/expansion-cache-service.ts";
import type { CurrentBundleLoad } from "../scripts/query/current-task-bundle.ts";
import type {
  PhysicalTableCatalog,
  PhysicalTableCatalogEntry,
} from "../scripts/machine-facts/input-pack-machine-facts.ts";
import type { PhysicalFieldIdentity } from "../scripts/reconcile/consumer/field-lineage/field-lineage-contract.ts";

function table(qualifiedName: string, columns: readonly string[]): PhysicalTableCatalogEntry {
  return {
    platform: "hive",
    dataSource: "warehouse",
    stableTableId: `${qualifiedName}__warehouse`,
    qualifiedName,
    guid: null,
    partitionFields: null,
    columns,
    tablePath: `${qualifiedName}.json`,
    ddlPath: `${qualifiedName}.sql`,
    tableContentHash: "table-hash",
    ddlSha256: "ddl-hash",
  };
}

function catalog(entries: readonly PhysicalTableCatalogEntry[]): PhysicalTableCatalog {
  const byQualifiedName = new Map<string, readonly PhysicalTableCatalogEntry[]>();
  for (const entry of entries)
    byQualifiedName.set(entry.qualifiedName, [
      ...(byQualifiedName.get(entry.qualifiedName) ?? []),
      entry,
    ]);
  return {
    entries,
    issues: [],
    byPhysicalKey: new Map(),
    byQualifiedName,
    byNameTail: new Map(),
  };
}

function load(
  taskId: string,
  records: Readonly<Record<string, Record<string, any>[]>>,
): CurrentBundleLoad {
  return {
    state: "CURRENT_L1",
    factsRoot: "facts",
    taskId,
    bundleDir: `facts/${taskId}`,
    indexPath: `facts/${taskId}/index.jsonl`,
    statusPath: `facts/${taskId}/analysis-status.json`,
    manifest: { schema_version: "2.0.0" },
    records,
    evidence: {
      "dataset-io.jsonl": `machine-facts:tasks/${taskId}/dataset-io.jsonl`,
      "relation-nodes.jsonl": `machine-facts:tasks/${taskId}/relation-nodes.jsonl`,
      "output-field-bindings.jsonl": `machine-facts:tasks/${taskId}/output-field-bindings.jsonl`,
    },
    issues: [],
  };
}

function pack(taskId: string, target: PhysicalTableCatalogEntry): PhysicalFieldExpanderTaskPack {
  return {
    document: {
      taskId,
      taskCategory: "hiveTask",
      taskName: `task-${taskId}`,
      target: {
        platform: target.platform,
        dataSource: target.dataSource,
        qualifiedName: target.qualifiedName,
      },
    } as unknown as PhysicalFieldExpanderTaskPack["document"],
    path: `tasks/${taskId}/task.json`,
    target,
  };
}

function context(options: {
  readonly occurrence?: object;
  readonly producerBinding?: boolean;
  readonly multipleWrites?: boolean;
  readonly artifactWriteEvidence?: boolean;
  readonly mismatchedProducerTarget?: boolean;
  readonly legacyScheduleFallback?: boolean;
  readonly skippedProducer?: boolean;
} = {}) {
  const sourceTable = table("demo.source", ["src_a"]);
  const consumerTable = table("demo.root", ["out_a"]);
  const producerTarget = options.mismatchedProducerTarget
    ? table("demo.other", ["src_a"])
    : options.legacyScheduleFallback
      ? null
      : sourceTable;
  const producer = producerTarget ? pack("200", producerTarget) : {
    ...pack("200", sourceTable),
    target: null,
  };
  const skippedProducer = options.skippedProducer
    ? {
        ...pack("201", sourceTable),
        document: {
          ...pack("201", sourceTable).document,
          taskCategory: "checkdbflag",
          contentHash: "e".repeat(64),
        },
      }
    : undefined;
  const consumer = pack("100", consumerTable);
  const producerRecords: Record<string, Record<string, any>[]> = options.producerBinding
    ? {
        "dataset-io.jsonl": (options.multipleWrites
          ? ["INSERT_OVERWRITE", "INSERT_INTO"]
          : ["PLATFORM_TARGET_QUERY_OUTPUT"]
        ).map((writeKind, index) => ({
          task_id: "200",
          direction: "WRITE",
          physical_dataset: "demo.source",
          provenance: options.multipleWrites ? "SQL_PARSE" : "PLATFORM_TARGET",
          write_kind: writeKind,
          write_observation_id: `write-observation:200:${index}`,
        })),
        "output-field-bindings.jsonl": [
          ...(options.multipleWrites ? [0, 1] : [0]).map((index) => ({
            binding_id: `binding:200:${index}:0`,
            task_id: "200",
            write_observation_id: `write-observation:200:${index}`,
            target_dataset: "demo.source",
            target_field: "src_a",
            binding_status: "RESOLVED",
          })),
        ],
      }
    : {};
  const consumerLoad = load("100", {});
  const producerLoad = load("200", producerRecords);
  const source: PhysicalFieldIdentity = {
    platform: "hive",
    dataSource: "warehouse",
    stableTableId: sourceTable.stableTableId,
    qualifiedName: sourceTable.qualifiedName,
    column: "src_a",
    identityStatus: "SCHEMA_BACKED",
  };
  const tableLineageWithoutHash = {
    taskNodes: [
      {
        taskId: "100",
        upstreamDecision: {
          primary: ["200", ...(skippedProducer ? ["201"] : [])],
          additional: [],
          unknown: [],
        },
      },
    ],
    producerBridges: options.legacyScheduleFallback ? [] : [
      {
        consumerTaskId: "100",
        producerTaskId: "200",
        table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.source" },
        producerRole: "PRIMARY",
        readOccurrence: options.occurrence ?? null,
      },
      ...(skippedProducer
        ? [{
            consumerTaskId: "100",
            producerTaskId: "201",
            table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.source" },
            producerRole: "PRIMARY",
            readOccurrence: options.occurrence ?? null,
          }]
        : []),
    ],
    ...(options.legacyScheduleFallback
      ? {
          scheduleEdges: [{ consumerTaskId: "100", producerTaskId: "200" }],
          readEdges: [{
            consumerTaskId: "100",
            recursionStatus: "ELIGIBLE",
            table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.source" },
          }],
        }
      : {}),
    ...(options.producerBinding && options.artifactWriteEvidence !== false
      ? {
          writeEdges: [{
            producerTaskId: "200",
            table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.source" },
            writes: [options.multipleWrites
              ? {
                  observationKind: "SQL_EXPLICIT_WRITE",
                  declaredWriteMode: null,
                  sqlWriteKind: "INSERT_OVERWRITE",
                  partition: [],
                  evidence: [],
                }
              : {
                  observationKind: "DIRECT_TARGET",
                  targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
                  declaredWriteMode: null,
                  sqlWriteKind: null,
                  partition: [],
                  evidence: [],
                }],
          }],
        }
      : {}),
  };
  const tableLineage = {
    ...tableLineageWithoutHash,
    contentHash: canonicalHash(
      tableLineageWithoutHash as unknown as JsonValue,
      ["generatedAt", "contentHash"],
    ),
  };
  const taskPacks = new Map<string, PhysicalFieldExpanderTaskPack | undefined>([
    ["100", consumer],
    ["200", producer],
    ["201", skippedProducer],
  ]);
  const loadFacts = (taskId: string): CurrentBundleLoad =>
    taskId === "100" ? consumerLoad : producerLoad;
  const expander = createPhysicalFieldExpander({
    dataRoot: "data",
    catalog: catalog([consumerTable, sourceTable]),
    tableLineage,
    taskPacks: { get: (taskId) => taskPacks.get(taskId) },
    loadFacts,
    factsPolicy: "current-only",
  });
  return { expander, consumer, consumerLoad, source, tableLineage, taskPacks, loadFacts };
}

const occurrence = {
  occurrenceId: "query#0:root.s.read.source",
  readRelationId: "root.s.read.source",
  statementIndex: 0,
  relationPath: ["root.s.read.source"],
};

describe("physical field expander", () => {
  it("returns a confirmed expansion only with occurrence-specific read and write evidence", () => {
    const { expander, consumer, consumerLoad, source } = context({
      occurrence,
      producerBinding: true,
    });
    const result = expander.expand({
      consumerTaskId: "100",
      consumerPack: consumer,
      consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source,
      expressionText: "s.src_a",
    });
    expect(result.producers).toHaveLength(1);
    expect(result.producers[0]).toMatchObject({
      producerTaskId: "200",
      evidenceStatus: "CONFIRMED",
      producerBindings: [{ binding_id: "binding:200:0:0" }],
    });
    expect(result.producers[0]!.evidenceRefs).toEqual(
      expect.arrayContaining([
        "field-lineage:consumer-read:100:query#0:root.s.read.source:root.s.read.source",
        "field-lineage:producer-write:200:write-observation:200:0:binding:200:0:0",
      ]),
    );
    expect(result.gaps).toEqual([]);
  });

  it("records a skipped producer consultation so its Pack change invalidates the cache", () => {
    const f = context({
      occurrence,
      producerBinding: true,
      skippedProducer: true,
    });
    const request = {
      consumerTaskId: "100",
      consumerPack: f.consumer,
      consumerLoad: f.consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source: f.source,
      expressionText: "s.src_a",
    };
    const firstExpansion = f.expander.expand(request);
    expect(firstExpansion.consultedProducerTaskIds).toEqual(["200", "201"]);
    expect(firstExpansion.reachablePrimaryProducerTaskIds).toEqual(["200", "201"]);
    expect(firstExpansion.producers.map((producer) => producer.producerTaskId)).toEqual(["200"]);

    let delegateCalls = 0;
    const counters = createExpansionCacheCounters();
    const cache = createCachedPhysicalFieldExpander(
      {
        expand: (currentRequest) => {
          delegateCalls += 1;
          return f.expander.expand(currentRequest);
        },
      },
      {
        cacheRoot: mkdtempSync(join(tmpdir(), "field-expansion-skipped-cache-")),
        dataRoot: "data",
        factsRoot: "facts",
        tableLineage: f.tableLineage,
        taskPacks: { get: (taskId) => f.taskPacks.get(taskId) },
        loadFacts: f.loadFacts,
        factsPolicy: "current-only",
        counters,
      },
    );
    cache.expand(request);
    f.taskPacks.set("201", {
      ...f.taskPacks.get("201")!,
      document: {
        ...f.taskPacks.get("201")!.document,
        contentHash: "f".repeat(64),
      },
    });
    cache.expand(request);

    expect(delegateCalls).toBe(2);
    expect(counters.stale).toBe(1);
    expect(counters.hits).toBe(0);
  });

  it("keeps the producer unresolved and records a gap when the bridge is not continuous", () => {
    const { expander, consumer, consumerLoad, source } = context();
    const result = expander.expand({
      consumerTaskId: "100",
      consumerPack: consumer,
      consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source,
      expressionText: "s.src_a",
    });
    expect(result.producers[0]!.evidenceStatus).toBe("UNRESOLVED");
    expect(result.producers[0]!.shouldRecurse).toBe(false);
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "CROSS_TASK_BRIDGE_EVIDENCE_INCOMPLETE",
        }),
      ]),
    );
  });

  it("filters producer bindings to the one artifact-proven write observation", () => {
    const { expander, consumer, consumerLoad, source } = context({
      occurrence,
      producerBinding: true,
      multipleWrites: true,
    });
    const result = expander.expand({
      consumerTaskId: "100",
      consumerPack: consumer,
      consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source,
      expressionText: "s.src_a",
    });
    expect(result.producers[0]).toMatchObject({
      evidenceStatus: "CONFIRMED",
      producerBindings: [
        {
          binding_id: "binding:200:0:0",
          write_observation_id: "write-observation:200:0",
        },
      ],
      shouldRecurse: true,
    });
    expect(result.producers[0]!.producerBindings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ write_observation_id: "write-observation:200:1" }),
      ]),
    );
  });

  it("does not fan out multiple writes without occurrence-specific write evidence", () => {
    const { expander, consumer, consumerLoad, source } = context({
      occurrence,
      producerBinding: true,
      multipleWrites: true,
      artifactWriteEvidence: false,
    });
    const result = expander.expand({
      consumerTaskId: "100",
      consumerPack: consumer,
      consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source,
      expressionText: "s.src_a",
    });
    expect(result.producers[0]).toMatchObject({
      evidenceStatus: "UNRESOLVED",
      producerBindings: [],
      shouldRecurse: false,
    });
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "CROSS_TASK_BRIDGE_EVIDENCE_INCOMPLETE",
        }),
      ]),
    );
  });

  it("blocks recursion when the producer physical table disagrees with the bridge table", () => {
    const { expander, consumer, consumerLoad, source } = context({
      occurrence,
      producerBinding: true,
      mismatchedProducerTarget: true,
    });
    const result = expander.expand({
      consumerTaskId: "100",
      consumerPack: consumer,
      consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source,
      expressionText: "s.src_a",
    });
    expect(result.producers[0]!.shouldRecurse).toBe(false);
    expect(result.producers[0]!.producerBindings).toEqual([]);
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "PHYSICAL_FIELD_IDENTITY_MISMATCH",
          taskId: "200",
        }),
      ]),
    );
  });

  it("keeps the legacy schedule/read fallback as an unresolved non-recursive gap", () => {
    const { expander, consumer, consumerLoad, source } = context({
      legacyScheduleFallback: true,
    });
    const result = expander.expand({
      consumerTaskId: "100",
      consumerPack: consumer,
      consumerLoad,
      sourceNodeId: "field-source-node:100:source:src_a",
      source,
      expressionText: "s.src_a",
    });
    expect(result.producers[0]!.shouldRecurse).toBe(false);
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "LEGACY_SCHEDULE_READ_FALLBACK_UNRESOLVED",
          taskId: "200",
        }),
      ]),
    );
  });
});
