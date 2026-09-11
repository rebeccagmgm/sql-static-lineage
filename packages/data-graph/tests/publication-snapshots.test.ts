import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  sha256,
} from "../../../scripts/machine-facts/machine-facts-contract.ts";
import { digest } from "../src/asset-graph/compile.ts";
import { buildPublicationSnapshots } from "../src/asset-graph/publication-snapshots.ts";
import {
  assertSourceEndpointBoundarySnapshot,
  augmentIndexWithSourceEndpointBoundaries,
  buildSourceEndpointBoundarySnapshot,
} from "../src/asset-graph/source-endpoint-boundary.ts";
import {
  assertTerminalPolicySnapshot,
  buildTerminalPolicySnapshot,
} from "../src/asset-graph/terminal-policy.ts";
import {
  assertUnionContinuationIndex,
  unionContinuationIndexContentHash,
  type UnionContinuationIndex,
  type UnionContinuationIndexEntry,
} from "../src/continuation/continuation-index.ts";

const terminalConfig = {
  version: "1.0.0",
  stopRoles: ["REFERENCE_CONFIG"],
  roles: { REFERENCE_CONFIG: { qualifiedNameTerms: ["_param"] } },
};
const boundaryConfig = {
  version: "1.0.0",
  roles: { TITANS_SOURCE: { qualifiedNamePrefixes: ["titans_dm."] } },
};

function makeIndex(tables: string[]): UnionContinuationIndex {
  const body: Omit<UnionContinuationIndex, "contentHash"> = {
    schemaVersion: "1.0.0",
    artifactType: "UNION_CONTINUATION_INDEX",
    generatedAt: "2026-09-08T00:00:00.000Z",
    input: {
      batchManifestRef: {
        path: "fixture/manifest.json",
        contentHash: "manifest",
      },
      producerIndex: { contentHash: "writers", inputFingerprint: "facts" },
      taskProjections: [],
    },
    entries: tables.map((qualifiedName, i): UnionContinuationIndexEntry => ({
      consumerTaskId: "consumer",
      readOccurrenceId: `read:${i}`,
      readOccurrenceNodeId: `node:read:${i}`,
      datasetNodeId: `dataset:${qualifiedName}`,
      qualifiedName,
      identityStatus: "CONFIRMED",
      partitionPredicateStatus: "NONE",
      candidates: [],
      prunedWriteObservationIds: [],
      gaps: [
        {
          gapId: `no-writer:${i}`,
          reasonCode: "NO_KNOWN_WRITE_OBSERVATION",
          message: "No known write observation",
          details: {},
        },
      ],
    })),
  };
  return { ...body, contentHash: unionContinuationIndexContentHash(body) };
}

function makeInput(tables: string[]) {
  const rawIndex = makeIndex(tables);
  const boundarySnapshotDraft = buildSourceEndpointBoundarySnapshot({
    index: rawIndex,
    config: boundaryConfig,
    taskCategoryFor: () => "sparkIndex",
    unionTaskIds: new Set(["consumer"]),
    catalog: null,
  });
  return { rawIndex, terminalConfig, boundarySnapshotDraft };
}

function assertConsumable(
  result: ReturnType<typeof buildPublicationSnapshots>,
) {
  // Readers consume serialized artifacts and validate both identity and content.
  const { index, terminalPolicy, boundarySnapshot } = JSON.parse(
    JSON.stringify(result),
  );
  assertUnionContinuationIndex(index);
  assertTerminalPolicySnapshot(
    terminalPolicy,
    index.contentHash,
    terminalPolicy.contentHash,
  );
  assertSourceEndpointBoundarySnapshot(
    boundarySnapshot,
    index.contentHash,
    boundarySnapshot.contentHash,
  );
}

describe("publication snapshot assembly", () => {
  it("binds both snapshots to the index after boundary augmentation", () => {
    const input = makeInput(["titans_dm.trade", "dm.contract_param"]);
    const before = structuredClone(input);
    const result = buildPublicationSnapshots(input);

    expect(result.index.contentHash).not.toBe(input.rawIndex.contentHash);
    expect(result.index.entries[0]!.gaps.map((gap) => gap.reasonCode)).toEqual([
      "NO_KNOWN_WRITE_OBSERVATION",
      "SOURCE_ENDPOINT_BOUNDARY",
    ]);
    expect(result.terminalPolicy.indexContentHash).toBe(
      result.index.contentHash,
    );
    expect(result.boundarySnapshot.indexContentHash).toBe(
      result.index.contentHash,
    );
    expect(
      result.terminalPolicy.reads.map((read) => read.readOccurrenceId),
    ).toEqual(["read:1"]);
    expect(() => assertConsumable(result)).not.toThrow();
    expect(input).toEqual(before);

    // The former ordering and JSON.stringify digest are rejected by the real readers.
    const oldPolicy = buildTerminalPolicySnapshot(
      input.rawIndex,
      terminalConfig,
    );
    expect(() =>
      assertTerminalPolicySnapshot(
        oldPolicy,
        result.index.contentHash,
        oldPolicy.contentHash,
      ),
    ).toThrow("TERMINAL_POLICY_SNAPSHOT_MISMATCH");
    const { contentHash: _oldHash, ...draftBody } = input.boundarySnapshotDraft;
    const oldBoundaryBody = {
      ...draftBody,
      indexContentHash: result.index.contentHash,
    };
    const oldBoundary = {
      ...oldBoundaryBody,
      contentHash: digest(oldBoundaryBody),
    };
    expect(() =>
      assertSourceEndpointBoundarySnapshot(
        oldBoundary,
        result.index.contentHash,
        oldBoundary.contentHash,
      ),
    ).toThrow("SOURCE_ENDPOINT_BOUNDARY_CONTENT_HASH_MISMATCH");
  });

  it("preserves boundary decisions, missing-writer evidence and existing index entries", () => {
    const input = makeInput(["titans_dm.交易_📈", "dm.expected_writer"]);
    const { contentHash: _oldHash, ...body } = input.boundarySnapshotDraft;
    const draftBody = {
      ...body,
      expectedWriterMissingReadOccurrenceIds: ["read:1"],
    };
    const boundarySnapshotDraft = {
      ...draftBody,
      contentHash: sha256(canonicalJson(draftBody)),
    };
    const result = buildPublicationSnapshots({
      ...input,
      boundarySnapshotDraft,
    });

    expect(result.boundarySnapshot.reads).toEqual(boundarySnapshotDraft.reads);
    expect(
      result.boundarySnapshot.expectedWriterMissingReadOccurrenceIds,
    ).toEqual(["read:1"]);
    expect(result.boundarySnapshot.config).toEqual(boundaryConfig);
    expect(result.boundarySnapshot.configHash).toBe(
      boundarySnapshotDraft.configHash,
    );
    expect(result.index.entries).toEqual(
      augmentIndexWithSourceEndpointBoundaries(
        input.rawIndex,
        boundarySnapshotDraft,
      ).entries,
    );
    expect(result.index.input).toEqual(input.rawIndex.input);
    expect(() => assertConsumable(result)).not.toThrow();
  });

  it.each([{ tables: [] }, { tables: ["dm.contract_param"] }])(
    "keeps an index without source boundaries consumable: $tables",
    ({ tables }) => {
      const input = makeInput(tables);
      const result = buildPublicationSnapshots(input);

      expect(result.index).toEqual(input.rawIndex);
      expect(result.boundarySnapshot).toEqual(input.boundarySnapshotDraft);
      expect(result.terminalPolicy.reads).toEqual(
        buildTerminalPolicySnapshot(input.rawIndex, terminalConfig).reads,
      );
      expect(() => assertConsumable(result)).not.toThrow();
    },
  );

  it("can rebind snapshots from an already augmented index without changing its content", () => {
    const input = makeInput(["titans_dm.trade", "dm.contract_param"]);
    const original = buildPublicationSnapshots(input);
    const rebound = buildPublicationSnapshots({
      ...input,
      rawIndex: original.index,
      boundarySnapshotDraft: original.boundarySnapshot,
    });

    expect(rebound).toEqual(original);
    expect(() => assertConsumable(rebound)).not.toThrow();
  });
});
