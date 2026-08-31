import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getIndexedFieldEvidence } from "../src/project-graph/query-index/indexed-field-evidence-query.ts";
import { getIndexedProjectTopology } from "../src/project-graph/query-index/indexed-project-topology-query.ts";
import { getIndexedTargetCausalOverlay } from "../src/project-graph/query-index/indexed-target-causal-overlay-query.ts";
import { buildQueryIndex } from "../src/project-graph/query-index/query-index-builder.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import { runRequiredQueryIndexParity } from "../src/project-graph/query-index/query-index-parity.ts";
import { loadQueryIndexSource } from "../src/project-graph/query-index/query-index-source.ts";

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
    "consumes topology, field evidence, and causal overlay through one index build",
    async () => {
      const source = loadQueryIndexSource({
        topologyDirectory,
        fieldEvidenceDirectories: [fieldEvidenceDirectory],
        targetCausalOverlayDirectories: [causalOverlayDirectory],
      });
      expect(source.descriptor.projectKey).toBe(
        "joint-176827-181058-209119-acceptance",
      );
      expect(source.fieldEvidence).toHaveLength(1);
      expect(source.targetCausalOverlays).toHaveLength(1);
      expect(source.topology.projection.snapshot.snapshotId).toBe(
        "project-snapshot-fa0f0ed6fe71fa2c5c9efb82d6e512c2e444d80fc0b57f334369f08648375fce",
      );
      expect(
        source.fieldEvidence[0]!.projection.snapshot.projectSource.snapshotId,
      ).toBe(source.topology.projection.snapshot.snapshotId);
      expect(
        source.targetCausalOverlays[0]!.projection.snapshot.projectSource
          .snapshotId,
      ).toBe(source.topology.projection.snapshot.snapshotId);
      expect(
        source.targetCausalOverlays[0]!.projection.snapshot.fieldEvidenceSource
          .snapshotId,
      ).toBe(source.fieldEvidence[0]!.projection.snapshot.snapshotId);

      const store = new InMemoryQueryIndexStore();
      const auditRoot = mkdtempSync(join(tmpdir(), "data-graph-real-audit-"));
      try {
        const result = await buildQueryIndex({
          source,
          store,
          auditOutputRoot: auditRoot,
          batchSize: 500,
          runParity: async (staged) =>
            runRequiredQueryIndexParity({ source: staged.source, store }),
        });
        expect(result.outcome).toBe("CREATED");
        expect(result.audit.manifest.indexedCounts.nodes).toBeGreaterThan(0);
        expect(result.audit.manifest.indexedCounts.edges).toBeGreaterThan(0);

        const expected = {
          store,
          projectKey: source.descriptor.projectKey,
          expectedSourceDescriptorHash: source.descriptorHash,
        };
        const topology = await getIndexedProjectTopology(expected, {
          limit: 1,
        });
        const field = await getIndexedFieldEvidence(
          {
            ...expected,
            fieldEvidenceSnapshotId:
              source.fieldEvidence[0]!.projection.snapshot.snapshotId,
          },
          { limit: 1 },
        );
        const causal = await getIndexedTargetCausalOverlay(
          {
            ...expected,
            targetCausalOverlaySnapshotId:
              source.targetCausalOverlays[0]!.projection.snapshot.snapshotId,
          },
          { limit: 1 },
        );
        expect(topology.status).toMatch(/^(ok|partial)$/u);
        expect(field.status).toMatch(/^(ok|partial)$/u);
        expect(causal.status).toMatch(/^(ok|partial)$/u);
        expect(topology.result.nodes.length).toBeLessThanOrEqual(1);
        expect(field.result.nodes.length).toBeLessThanOrEqual(1);
        expect(causal.result.assessments.length).toBeLessThanOrEqual(1);
      } finally {
        rmSync(auditRoot, { recursive: true, force: true });
        await store.close();
      }
    },
    120_000,
  );
});
