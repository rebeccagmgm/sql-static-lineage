import { expect } from "vitest";
import { runFileQueryCli } from "../../src/project-graph/query/file-query-cli.ts";
import {
  parseQueryIndexCli,
  runIndexedQuery,
} from "../../src/project-graph/query-index/query-index-cli.ts";
import type { QueryIndexStore } from "../../src/project-graph/query-index/query-index-store.ts";
import type { LoadedQueryIndexSource } from "../../src/project-graph/query-index/query-index-source.ts";
import {
  getProjectTopology,
  traceProjectUpstream,
  explainTopologyEdge,
} from "../../src/project-graph/query/project-topology-query.ts";
import {
  getFieldEvidence,
  traceFieldValuePath,
  explainFieldEvidenceRecord,
} from "../../src/project-graph/field-evidence/field-evidence-query.ts";
import {
  getTargetCausalOverlay,
  getTargetCausalTaskRollup,
  explainTargetCausalAssessment,
} from "../../src/project-graph/target-causal-overlay/target-causal-overlay-query.ts";

/** Compare both CLI routes against the pre-existing file APIs, including evidence envelopes. */
export async function expectQueryCliParity(
  source: LoadedQueryIndexSource,
  store: QueryIndexStore,
): Promise<void> {
  const topology = source.topology;
  const field = source.fieldEvidence[0]!;
  const causal = source.targetCausalOverlays[0]!;
  const edge = topology.projection.edges[0]!;
  const rootField = Object.keys(
    field.projection.snapshot.selection.rootStateIds,
  )[0]!;
  const recordId = field.projection.nodes[0]!.nodeId;
  const assessmentId = String(
    causal.projection.nodes.find((n) => n.nodeType === "CAUSAL_ASSESSMENT")!
      .properties.assessmentId,
  );
  const taskId = String(
    causal.projection.nodes.find((n) => n.nodeType === "TASK_REF")!.properties
      .taskId,
  );
  const cases = [
    {
      directory: topology.directory,
      name: "get_project_topology",
      args: ["--limit", "1"],
      expected: () => getProjectTopology(topology.directory, { limit: 1 }),
    },
    {
      directory: topology.directory,
      name: "trace_project_upstream",
      args: ["--start-node-id", edge.fromNodeId, "--max-hops", "1"],
      expected: () =>
        traceProjectUpstream(topology.directory, {
          startNodeId: edge.fromNodeId,
          maxHops: 1,
        }),
    },
    {
      directory: topology.directory,
      name: "explain_topology_edge",
      args: ["--edge-id", edge.edgeId],
      expected: () => explainTopologyEdge(topology.directory, edge.edgeId),
    },
    {
      directory: field.directory,
      name: "get_field_evidence",
      args: ["--limit", "1"],
      expected: () => getFieldEvidence(field.directory, { limit: 1 }),
    },
    {
      directory: field.directory,
      name: "trace_field_value_path",
      args: ["--root-field", rootField, "--max-hops", "1"],
      expected: () =>
        traceFieldValuePath(field.directory, { rootField, maxHops: 1 }),
    },
    {
      directory: field.directory,
      name: "explain_field_evidence_record",
      args: ["--record-id", recordId],
      expected: () => explainFieldEvidenceRecord(field.directory, recordId),
    },
    {
      directory: causal.directory,
      name: "get_target_causal_overlay",
      args: ["--relation-status", "UNKNOWN", "--limit", "1"],
      expected: () =>
        getTargetCausalOverlay(causal.directory, {
          relationStatuses: ["UNKNOWN"],
          limit: 1,
        }),
    },
    {
      directory: causal.directory,
      name: "get_target_causal_task_rollup",
      args: ["--task-id", taskId, "--max-assessments", "1"],
      expected: () =>
        getTargetCausalTaskRollup(causal.directory, taskId, {
          maxAssessments: 1,
        }),
    },
    {
      directory: causal.directory,
      name: "explain_target_causal_assessment",
      args: ["--assessment-id", assessmentId, "--max-attachments", "1"],
      expected: () =>
        explainTargetCausalAssessment(causal.directory, assessmentId, {
          maxAttachments: 1,
        }),
    },
  ];
  for (const testCase of cases) {
    const args = ["--query", testCase.name, ...testCase.args];
    let output = "";
    await runFileQueryCli(["--directory", testCase.directory, ...args], {
      write: (text) => {
        output += text;
      },
    });
    const expected = testCase.expected();
    expect(JSON.parse(output), `${testCase.name}: file CLI`).toEqual(expected);
    const options = parseQueryIndexCli([
      "query",
      ...args,
      "--project-key",
      source.descriptor.projectKey,
      "--expected-descriptor-hash",
      source.descriptorHash,
      "--field-snapshot",
      field.projection.snapshot.snapshotId,
      "--causal-snapshot",
      causal.projection.snapshot.snapshotId,
      "--neo4j-uri",
      "neo4j://localhost:7687",
      "--neo4j-username",
      "test",
      "--neo4j-database",
      "test",
      "--password-env",
      "UNUSED_CLI_PARITY_SECRET",
    ]);
    if (options.command !== "query") throw new Error("Expected query command");
    expect(
      await runIndexedQuery(store, options),
      `${testCase.name}: index CLI`,
    ).toEqual(expected);
  }
}
