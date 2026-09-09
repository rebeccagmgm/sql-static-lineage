import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadFieldEvidenceDirectory } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import {
  explainFieldEvidenceRecord,
  getFieldEvidence,
  traceFieldValuePath,
} from "../src/project-graph/field-evidence/field-evidence-query.ts";
import { runFileQueryCli } from "../src/project-graph/query/file-query-cli.ts";
import {
  explainTopologyEdge,
  getProjectTopology,
  traceProjectUpstream,
} from "../src/project-graph/query/project-topology-query.ts";
import { loadTargetCausalOverlayDirectory } from "../src/project-graph/target-causal-overlay/target-causal-overlay-publication.ts";
import {
  explainTargetCausalAssessment,
  getTargetCausalOverlay,
  getTargetCausalTaskRollup,
} from "../src/project-graph/target-causal-overlay/target-causal-overlay-query.ts";
import { loadProjectTopologyDirectory } from "../src/project-graph/topology/project-topology-publication.ts";

const acceptanceRoot = process.env.DATA_GRAPH_ACCEPTANCE_ROOT;
const topologyDirectory = join(
  acceptanceRoot ?? "",
  "snapshots",
  "project-snapshot-fa0f0ed6fe71fa2c5c9efb82d6e512c2e444d80fc0b57f334369f08648375fce",
);
const fieldEvidenceDirectory = join(
  acceptanceRoot ?? "",
  "field-evidence",
  "field-evidence-1f42b891b585ad81c814ef89003222f39f00a1e0fda605904a202d0735f1121e",
);
const causalOverlayDirectory = join(
  acceptanceRoot ?? "",
  "target-causal-overlays",
  "target-causal-overlay-83ddd89c5c90f03d7fd3fe753628daced1ec479f2680a7caa35732b1a84e658d",
);
const realArtifactsAvailable = [
  topologyDirectory,
  fieldEvidenceDirectory,
  causalOverlayDirectory,
].every((directory) => existsSync(join(directory, "projection-manifest.json")));

describe("real published artifact closed loop", () => {
  const realIt = realArtifactsAvailable ? it : it.skip;

  realIt(
    "consumes topology, field evidence, and causal overlay through direct file queries",
    async () => {
      const topology = loadProjectTopologyDirectory(topologyDirectory);
      const field = loadFieldEvidenceDirectory(fieldEvidenceDirectory);
      const causal = loadTargetCausalOverlayDirectory(causalOverlayDirectory);

      expect(topology.projection.snapshot.projectKey).toBe(
        "joint-176827-181058-209119-acceptance",
      );
      expect(topology.projection.snapshot.snapshotId).toBe(
        "project-snapshot-fa0f0ed6fe71fa2c5c9efb82d6e512c2e444d80fc0b57f334369f08648375fce",
      );
      expect(field.projection.snapshot.projectSource.snapshotId).toBe(
        topology.projection.snapshot.snapshotId,
      );
      expect(causal.projection.snapshot.projectSource.snapshotId).toBe(
        topology.projection.snapshot.snapshotId,
      );
      expect(causal.projection.snapshot.fieldEvidenceSource.snapshotId).toBe(
        field.projection.snapshot.snapshotId,
      );
      for (const projection of [
        topology.projection,
        field.projection,
        causal.projection,
      ]) {
        expect(projection.nodes.length).toBeGreaterThan(0);
        expect(projection.edges.length).toBeGreaterThan(0);
      }

      const topologyResult = getProjectTopology(topologyDirectory, {
        limit: 1,
      });
      const fieldResult = getFieldEvidence(fieldEvidenceDirectory, {
        limit: 1,
      });
      const causalResult = getTargetCausalOverlay(causalOverlayDirectory, {
        limit: 1,
      });
      expect(topologyResult.status).toMatch(/^(ok|partial)$/u);
      expect(fieldResult.status).toMatch(/^(ok|partial)$/u);
      expect(causalResult.status).toMatch(/^(ok|partial)$/u);
      expect(topologyResult.result.nodes).toHaveLength(1);
      expect(fieldResult.result.nodes).toHaveLength(1);
      expect(causalResult.result.assessments).toHaveLength(1);

      const topologyEdge = topology.projection.edges[0];
      const rootField = Object.keys(
        field.projection.snapshot.selection.rootStateIds,
      )[0];
      const fieldRecord = field.projection.nodes[0];
      const assessment = causal.projection.nodes.find(
        ({ nodeType }) => nodeType === "CAUSAL_ASSESSMENT",
      );
      const task = causal.projection.nodes.find(
        ({ nodeType }) => nodeType === "TASK_REF",
      );
      expect(topologyEdge).toBeDefined();
      expect(rootField).toBeTruthy();
      expect(fieldRecord).toBeDefined();
      expect(assessment?.properties.assessmentId).toBeTruthy();
      expect(task?.properties.taskId).toBeTruthy();
      if (!topologyEdge || !rootField || !fieldRecord || !assessment || !task)
        throw new Error("REAL_ARTIFACT_QUERY_IDENTIFIERS_MISSING");
      const assessmentId = String(assessment.properties.assessmentId);
      const taskId = String(task.properties.taskId);

      const cases = [
        {
          directory: topologyDirectory,
          query: "get_project_topology",
          args: ["--limit", "1"],
          expected: topologyResult,
        },
        {
          directory: topologyDirectory,
          query: "trace_project_upstream",
          args: ["--start-node-id", topologyEdge.fromNodeId, "--max-hops", "1"],
          expected: traceProjectUpstream(topologyDirectory, {
            startNodeId: topologyEdge.fromNodeId,
            maxHops: 1,
          }),
        },
        {
          directory: topologyDirectory,
          query: "explain_topology_edge",
          args: ["--edge-id", topologyEdge.edgeId],
          expected: explainTopologyEdge(topologyDirectory, topologyEdge.edgeId),
        },
        {
          directory: fieldEvidenceDirectory,
          query: "get_field_evidence",
          args: ["--limit", "1"],
          expected: fieldResult,
        },
        {
          directory: fieldEvidenceDirectory,
          query: "trace_field_value_path",
          args: ["--root-field", rootField, "--max-hops", "1"],
          expected: traceFieldValuePath(fieldEvidenceDirectory, {
            rootField,
            maxHops: 1,
          }),
        },
        {
          directory: fieldEvidenceDirectory,
          query: "explain_field_evidence_record",
          args: ["--record-id", fieldRecord.nodeId],
          expected: explainFieldEvidenceRecord(
            fieldEvidenceDirectory,
            fieldRecord.nodeId,
          ),
        },
        {
          directory: causalOverlayDirectory,
          query: "get_target_causal_overlay",
          args: ["--relation-status", "UNKNOWN", "--limit", "1"],
          expected: getTargetCausalOverlay(causalOverlayDirectory, {
            relationStatuses: ["UNKNOWN"],
            limit: 1,
          }),
        },
        {
          directory: causalOverlayDirectory,
          query: "get_target_causal_task_rollup",
          args: ["--task-id", taskId, "--max-assessments", "1"],
          expected: getTargetCausalTaskRollup(causalOverlayDirectory, taskId, {
            maxAssessments: 1,
          }),
        },
        {
          directory: causalOverlayDirectory,
          query: "explain_target_causal_assessment",
          args: ["--assessment-id", assessmentId, "--max-attachments", "1"],
          expected: explainTargetCausalAssessment(
            causalOverlayDirectory,
            assessmentId,
            { maxAttachments: 1 },
          ),
        },
      ] as const;
      for (const testCase of cases) {
        let output = "";
        await runFileQueryCli(
          [
            "--directory",
            testCase.directory,
            "--query",
            testCase.query,
            ...testCase.args,
          ],
          { write: (text) => (output += text) },
        );
        expect(JSON.parse(output), testCase.query).toEqual(testCase.expected);
      }
    },
    120_000,
  );
});
