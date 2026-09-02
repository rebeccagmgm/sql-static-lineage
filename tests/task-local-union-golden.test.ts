import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { traceUnionUpstream } from "../src/project-graph/topology/task-local-union/task-local-union-continuation.ts";
import { mergeTaskLocalUnion } from "../src/project-graph/topology/task-local-union/task-local-union-merge.ts";
import {
  loadProducerIndex,
  writersForQualifiedName,
} from "../src/project-graph/topology/task-local-union/task-local-union-producer-index.ts";
import { loadTaskLocalUnionSources } from "../src/project-graph/topology/task-local-union/task-local-union-source.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const DEFAULT_GOLDEN_ROOT = join(REPO_ROOT, "tmp", "task-local-union-golden");
const DEFAULT_PRODUCER_INDEX = resolve(
  REPO_ROOT,
  "../../sql-static-lineage-data.producer-index/producer-index.json",
);

function goldenPaths(): {
  readonly projectGraphRoot: string;
  readonly manifestPath: string;
  readonly producerIndexPath: string;
} | null {
  const projectGraphRoot = resolve(
    process.env.TASK_LOCAL_UNION_GOLDEN_ROOT?.trim() || DEFAULT_GOLDEN_ROOT,
  );
  const producerIndexPath = resolve(
    process.env.TASK_LOCAL_UNION_PRODUCER_INDEX?.trim() ||
      DEFAULT_PRODUCER_INDEX,
  );
  const manifestPath = join(projectGraphRoot, "batch-manifest.json");
  const envelopes = ["105387", "119044", "176827"].map((taskId) =>
    join(projectGraphRoot, "tasks", taskId, "task-local-projection.json"),
  );
  if (
    ![manifestPath, producerIndexPath, ...envelopes].every((path) =>
      existsSync(path),
    )
  ) {
    return null;
  }
  return { projectGraphRoot, manifestPath, producerIndexPath };
}

const paths = goldenPaths();
const requireGolden =
  process.env.TASK_LOCAL_UNION_GOLDEN_REQUIRED === "1" ||
  process.env.TASK_LOCAL_UNION_GOLDEN_REQUIRED === "true";
if (requireGolden && !paths) {
  throw new Error(
    "TASK_LOCAL_UNION_GOLDEN_REQUIRED is set but golden envelopes / producer-index are missing.",
  );
}
const describeGolden = paths ? describe : describe.skip;

function datasetNodeIdByQualifiedName(
  nodes: readonly {
    nodeId: string;
    nodeType: string;
    properties: Readonly<Record<string, unknown>>;
  }[],
  qualifiedName: string,
): string {
  const key = qualifiedName.trim().toLowerCase();
  const matches = nodes.filter(
    (node) =>
      node.nodeType === "PHYSICAL_DATASET" &&
      String(node.properties.qualifiedName ?? "")
        .trim()
        .toLowerCase() === key,
  );
  expect(matches, `dataset ${qualifiedName}`).toHaveLength(1);
  return matches[0]!.nodeId;
}

describeGolden("TU-7 golden union chain (105387→119044→176827)", () => {
  const loaded = loadTaskLocalUnionSources({
    manifestPath: paths!.manifestPath,
    projectGraphRoot: paths!.projectGraphRoot,
    producerIndexPath: paths!.producerIndexPath,
  });
  const merge = mergeTaskLocalUnion(loaded);
  const producer = loadProducerIndex(paths!.producerIndexPath);

  it("projects all three goldens and keeps one PHYSICAL_DATASET per shared table", () => {
    expect(loaded.tasks.map((task) => task.taskSource.taskId)).toEqual([
      "105387",
      "119044",
      "176827",
    ]);
    expect(
      loaded.tasks.every(
        (task) => task.taskSource.coverageStatus === "PROJECTED",
      ),
    ).toBe(true);

    for (const qualifiedName of [
      "pdata_n.t98_sb_otc_opt_comp_info",
      "pdata_n.t03_agt_stati_info_h",
    ]) {
      const datasets = merge.nodes.filter(
        (node) =>
          node.nodeType === "PHYSICAL_DATASET" &&
          String(node.properties.qualifiedName ?? "")
            .trim()
            .toLowerCase() === qualifiedName,
      );
      expect(datasets, qualifiedName).toHaveLength(1);
    }
    expect(
      merge.report.gaps.filter(
        (gap) => gap.reasonCode === "DATASET_IDENTITY_DIVERGENT",
      ),
    ).toEqual([]);
  });

  it("has no TASK→TASK local data edges", () => {
    const taskTask = merge.edges.filter((edge) => {
      const from = merge.nodes.find((node) => node.nodeId === edge.fromNodeId);
      const to = merge.nodes.find((node) => node.nodeId === edge.toNodeId);
      return from?.nodeType === "TASK" && to?.nodeType === "TASK";
    });
    expect(taskTask).toEqual([]);
  });

  it("§5.1: 176827 READ t98 → in-union writer 119044 without producer-index", () => {
    const datasetNodeId = datasetNodeIdByQualifiedName(
      merge.nodes,
      "pdata_n.t98_sb_otc_opt_comp_info",
    );
    const result = traceUnionUpstream({
      merge,
      datasetNodeId,
      enableDerivedProducerBridge: false,
    });
    expect(result.inUnionWriterTaskIds).toContain("119044");
    expect(result.derivedEdges).toEqual([]);
  });

  it("§5.1: 119044 READ t03_agt → in-union writer 105387", () => {
    const datasetNodeId = datasetNodeIdByQualifiedName(
      merge.nodes,
      "pdata_n.t03_agt_stati_info_h",
    );
    const result = traceUnionUpstream({
      merge,
      datasetNodeId,
      enableDerivedProducerBridge: false,
    });
    expect(result.inUnionWriterTaskIds).toContain("105387");
  });

  it("§5.2: t03_otc_opt_comp_info has no in-union writer; producer-index boundary", () => {
    const datasetNodeId = datasetNodeIdByQualifiedName(
      merge.nodes,
      "pdata_n.t03_otc_opt_comp_info",
    );
    const indexWriters = writersForQualifiedName(
      producer.writers,
      "pdata_n.t03_otc_opt_comp_info",
    );
    expect(indexWriters.map((writer) => writer.taskId).sort()).toEqual([
      "103943",
      "209862",
    ]);
    const result = traceUnionUpstream({
      merge,
      datasetNodeId,
      producerIndexWriters: indexWriters,
      enableDerivedProducerBridge: true,
    });
    expect(result.inUnionWriterTaskIds).toEqual([]);
    expect(result.producerIndexBoundaryTaskIds).toEqual(["103943", "209862"]);
    expect(result.gaps.map((gap) => gap.reasonCode)).toContain(
      "WRITER_NOT_IN_UNION",
    );
    expect(
      result.derivedEdges.every((edge) => edge.edgeType === "PRODUCER_BRIDGE"),
    ).toBe(true);

    const disabled = traceUnionUpstream({
      merge,
      datasetNodeId,
      producerIndexWriters: indexWriters,
      enableDerivedProducerBridge: false,
    });
    expect(disabled.derivedEdges).toEqual([]);
    expect(disabled.producerIndexBoundaryTaskIds).toEqual(["103943", "209862"]);
  });

  it("105387 DATASET_CONTROL refs stay off 176827 READS", () => {
    const task176827 = loaded.tasks.find(
      (task) => task.taskSource.taskId === "176827",
    )!;
    const task105387 = loaded.tasks.find(
      (task) => task.taskSource.taskId === "105387",
    )!;
    const controlTables = new Set(
      task105387.projection.edges
        .filter((edge) => {
          const record = edge as { edgeType?: string; fromNodeId?: string };
          return record.edgeType === "DATASET_CONTROL";
        })
        .map((edge) => {
          const record = edge as { fromNodeId: string };
          const node = task105387.projection.nodes.find(
            (item) => (item as { nodeId: string }).nodeId === record.fromNodeId,
          ) as { properties?: { qualifiedName?: string } } | undefined;
          return String(node?.properties?.qualifiedName ?? "")
            .trim()
            .toLowerCase();
        })
        .filter(Boolean),
    );
    expect(controlTables.size).toBeGreaterThan(0);

    const readTables = new Set(
      task176827.projection.edges
        .filter((edge) => (edge as { edgeType?: string }).edgeType === "READS")
        .map((edge) => {
          const record = edge as { toNodeId: string };
          const node = task176827.projection.nodes.find(
            (item) => (item as { nodeId: string }).nodeId === record.toNodeId,
          ) as { properties?: { qualifiedName?: string } } | undefined;
          return String(node?.properties?.qualifiedName ?? "")
            .trim()
            .toLowerCase();
        })
        .filter(Boolean),
    );
    for (const table of controlTables) {
      expect(readTables.has(table)).toBe(false);
    }
  });

  it("119044 zipper READs are NON_LITERAL_PRESENT (no false unique writer prune)", () => {
    const task119044 = loaded.tasks.find(
      (task) => task.taskSource.taskId === "119044",
    )!;
    const datasetNodeId = datasetNodeIdByQualifiedName(
      merge.nodes,
      "pdata_n.t03_agt_stati_info_h",
    );
    const reads = task119044.projection.edges.filter((edge) => {
      const record = edge as {
        edgeType?: string;
        toNodeId?: string;
        properties?: { partitionPredicateStatus?: string };
      };
      return record.edgeType === "READS" && record.toNodeId === datasetNodeId;
    }) as Array<{
      properties: { partitionPredicateStatus?: string };
    }>;
    expect(reads.length).toBeGreaterThanOrEqual(2);
    expect(
      reads.every(
        (edge) =>
          edge.properties.partitionPredicateStatus === "NON_LITERAL_PRESENT",
      ),
    ).toBe(true);

    const result = traceUnionUpstream({
      merge,
      datasetNodeId,
      readPartition: { partitionPredicateStatus: "NON_LITERAL_PRESENT" },
    });
    expect(result.gaps.map((gap) => gap.reasonCode)).toContain(
      "READ_PREDICATE_NON_LITERAL",
    );
    expect(result.inUnionWriterTaskIds).toContain("105387");
  });
});
