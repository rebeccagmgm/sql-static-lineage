import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { expectQueryCliParity } from "./fixtures/query-cli-parity.ts";

import { canonicalJson } from "../src/contracts/runtime.ts";
import { buildFieldEvidenceProjection } from "../src/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../src/project-graph/field-evidence/field-evidence-source.ts";
import { parseTargetCausalOverlayCli } from "../src/project-graph/target-causal-overlay/target-causal-overlay-cli.ts";
import { buildQueryIndex } from "../src/project-graph/query-index/query-index-builder.ts";
import { InMemoryQueryIndexStore } from "../src/project-graph/query-index/in-memory-query-index-store.ts";
import {
  explainIndexedTargetCausalAssessment,
  getIndexedTargetCausalOverlay,
  getIndexedTargetCausalTaskRollup,
} from "../src/project-graph/query-index/indexed-target-causal-overlay-query.ts";
import { runRequiredQueryIndexParity } from "../src/project-graph/query-index/query-index-parity.ts";
import { loadQueryIndexSource } from "../src/project-graph/query-index/query-index-source.ts";
import { buildTargetCausalOverlayProjection } from "../src/project-graph/target-causal-overlay/target-causal-overlay-projector.ts";
import {
  loadTargetCausalOverlayDirectory,
  publishTargetCausalOverlay,
} from "../src/project-graph/target-causal-overlay/target-causal-overlay-publication.ts";
import {
  explainTargetCausalAssessment,
  getTargetCausalOverlay,
  getTargetCausalTaskRollup,
} from "../src/project-graph/target-causal-overlay/target-causal-overlay-query.ts";
import {
  TARGET_CAUSAL_OVERLAY_SOURCE_CONTRACT,
  loadTargetCausalOverlaySource,
} from "../src/project-graph/target-causal-overlay/target-causal-overlay-source.ts";
import {
  canonicalAssessment,
  canonicalizeTargetTableArtifact,
  type TargetTableCausalClosureArtifact,
} from "../src/contracts/canonical-artifacts.ts";
import type { CandidateBranch } from "../src/contracts/canonical-artifacts.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  fieldLineageFixture,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function temporary(label: string): string {
  return mkdtempSync(join(tmpdir(), `${label}-`));
}

function setup() {
  const root = temporary("target-causal-overlay");
  const materialized = materializeFieldEvidenceFixture(join(root, "source"), {
    projectKey: "target-causal-overlay-fixture",
    field: fieldLineageFixture(),
  });
  const fieldSource = loadFieldEvidenceSource({
    projectTopologyDirectory: materialized.projectTopologyDirectory,
    fieldLineagePath: materialized.fieldLineagePath,
    rootTaskId: "root-1",
    writeObservationId: FIELD_FIXTURE_WRITE_ID,
    target: FIELD_FIXTURE_TARGET,
    rootFields: ["delta"],
  });
  const fieldDirectory = publishFieldEvidence(
    buildFieldEvidenceProjection(fieldSource),
    { outputRoot: materialized.outputRoot },
  ).directory;
  const causalPath = join(root, "target-table-causal.json");
  const artifact = causalArtifact(
    fieldSource.project.projection.snapshot.sources.find(
      ({ rootTaskId }) => rootTaskId === "root-1",
    )!.multiHop.contentSha256,
    fieldSource.fieldSource.contentSha256,
  );
  writeFileSync(causalPath, canonicalJson(artifact), "utf8");
  return {
    root,
    materialized,
    fieldDirectory,
    causalPath,
    artifact,
    source: loadTargetCausalOverlaySource({
      projectTopologyDirectory: materialized.projectTopologyDirectory,
      fieldEvidenceDirectory: fieldDirectory,
      causalArtifactPath: causalPath,
    }),
  };
}

function causalArtifact(
  tableMultiHopHash: string,
  fieldLineageHash: string,
): TargetTableCausalClosureArtifact {
  const targetWriteId = "target-write:fixture";
  const root = branch({
    candidateBranchId: "branch:root",
    branchKind: "ROOT_WRITE",
    consumerTaskId: null,
    producerTaskId: "root-1",
    table: null,
    readOccurrence: null,
    writeObservationId: FIELD_FIXTURE_WRITE_ID,
  });
  const confirmed = branch({
    candidateBranchId: "branch:confirmed",
    consumerTaskId: "root-1",
    producerTaskId: "shared-producer",
  });
  const unknown = branch({
    candidateBranchId: "branch:unknown",
    branchKind: "BLOCKED_READ",
    consumerTaskId: "root-1",
    producerTaskId: null,
    gapRefs: ["gap:blocked"],
    boundaryReason: "READ_EVIDENCE_BLOCKED",
  });
  const assessments = [
    canonicalAssessment({
      targetWriteId,
      candidateBranchId: root.candidateBranchId,
      relationStatus: "CONFIRMED_RELATED",
      channelAssessments: [],
      evidenceRefs: ["target-write:evidence"],
      gapRefs: [],
      negativeProofs: [],
    }),
    canonicalAssessment({
      targetWriteId,
      candidateBranchId: confirmed.candidateBranchId,
      relationStatus: "CONFIRMED_RELATED",
      channelAssessments: [
        {
          channel: "FIELD_VALUE",
          status: "CONFIRMED",
          proofRefs: ["field-proof"],
          witnessRefs: ["field-witness"],
          gapRefs: [],
          affectedTargetFields: ["delta"],
        },
      ],
      evidenceRefs: ["field-proof", "field-witness"],
      gapRefs: [],
      negativeProofs: [],
    }),
    canonicalAssessment({
      targetWriteId,
      candidateBranchId: unknown.candidateBranchId,
      relationStatus: "UNKNOWN",
      channelAssessments: [
        {
          channel: "ROW_MEMBERSHIP",
          status: "UNKNOWN",
          proofRefs: [],
          witnessRefs: [],
          gapRefs: ["gap:blocked"],
        },
      ],
      evidenceRefs: [],
      gapRefs: ["gap:blocked"],
      negativeProofs: [],
    }),
  ];
  return canonicalizeTargetTableArtifact({
    schemaVersion: "1.1.0",
    artifactType: "TARGET_TABLE_UPSTREAM_CAUSAL_CLOSURE",
    generatedAt: "2026-08-29T12:00:00.000Z",
    targetWrite: {
      identity: {
        targetWriteId,
        taskId: "root-1",
        targetTableKey: FIELD_FIXTURE_TARGET.qualifiedName,
        sqlSourceId: "task:root-1:slot:query",
        statementOrdinal: 0,
        taskWriteOrdinal: 0,
        rootRelationId: "task:root-1:statement:0:relation:root",
        writeObservationId: FIELD_FIXTURE_WRITE_ID,
        evidenceRefs: ["target-write:evidence"],
      },
      snapshot: {
        inputPackFingerprint: "input-fingerprint",
        machineFactsHash: "machine-facts-hash",
        producerIndexHash: "historical-producer-index-hash",
        tableMultiHopHash,
        fieldLineageHash,
        semanticRuleVersion: "fixture-v1",
      },
    },
    candidateUniverse: {
      rootTaskId: "root-1",
      status: "INCOMPLETE",
      branches: [root, confirmed, unknown],
      boundaryGapRefs: ["gap:blocked"],
      coverage: {
        sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
        sourceCoverageStatus: "PARTIAL",
        sourceCoverageSemantics: null,
        sourceLimitsTruncated: false,
      },
    },
    assessments,
    taskRollup: [
      {
        producerTaskId: "shared-producer",
        branchIds: [confirmed.candidateBranchId],
        relationStatus: "CONFIRMED_RELATED",
        impactChannels: ["FIELD_VALUE"],
        evidenceRefs: ["field-proof", "field-witness"],
        gapRefs: [],
      },
    ],
    minimumCertainTaskIds: ["shared-producer"],
    conservativeSafetyTaskIds: ["shared-producer"],
    runtimeRerunDecision: "NOT_EVALUATED",
    relationSummaries: [],
    metrics: {
      candidateBranchCount: 3,
      assessmentCount: 3,
      upstreamTaskCount: 1,
      fieldValueEvidenceScanCount: 1,
      evidenceClosureRate: 1,
      decisionCoverage: { numerator: 3, denominator: 3, rate: 1 },
      bridgeStats: { resolved: 1, ambiguous: 0, missing: 1 },
      peakMemoryBytes: 1,
      confirmedAssessmentCount: 2,
      writeScopedConfirmedCount: 2,
      crossChannelConfirmedBranchCount: 0,
      crossWriteScopeLeakCount: 0,
    },
    stages: [],
    gaps: [
      {
        gapId: "gap:blocked",
        reasonCode: "CAUSAL_EVIDENCE_INCOMPLETE",
        message: "blocked read",
        evidenceRefs: ["blocked:evidence"],
      },
    ],
  });
}

function branch(overrides: Partial<CandidateBranch>): CandidateBranch {
  return {
    candidateBranchId: "branch:base",
    branchKind: "PHYSICAL_PRODUCER",
    rootTaskId: "root-1",
    consumerTaskId: "root-1",
    producerTaskId: "shared-producer",
    table: {
      platform: "hive",
      dataSource: "warehouse-a",
      qualifiedName: "dm.shared_source",
      stableTableId: "guid-shared-warehouse-a",
      identityStatus: "SCHEMA_BACKED",
    },
    readOccurrence: {
      occurrenceId: "read:shared",
      readRelationId: "read:shared",
      sqlSourceId: "task:root-1:slot:query",
      statementIndex: 0,
      rootRelationId: "task:root-1:statement:0:relation:root",
      relationPath: ["root", "read:shared"],
    },
    writeObservationId: "write:shared:0",
    producerRole: "PRIMARY",
    writeScope: {
      sqlSourceId: "task:shared-producer:slot:query",
      statementOrdinal: 0,
      rootRelationId: "task:shared-producer:statement:0:relation:root",
    },
    evidenceRefs: [
      {
        evidenceRefId: "branch:evidence",
        source: "TEST",
        locator: "fixture",
      },
    ],
    gapRefs: [],
    boundaryReason: null,
    ...overrides,
  };
}

describe("target causal overlay source and projection", () => {
  it("binds immutable topology, field and causal hashes without runtime inference", () => {
    const fixture = setup();
    expect(TARGET_CAUSAL_OVERLAY_SOURCE_CONTRACT).toMatchObject({
      externalCalls: 0,
      runtimeInference: "DISABLED",
      negativeProofs: "DISABLED",
      historicalProducerIndexReplay: "NOT_ATTEMPTED",
    });
    const projection = buildTargetCausalOverlayProjection(fixture.source);
    expect(projection.snapshot).toMatchObject({
      runtimeRerunDecision: "NOT_EVALUATED",
      sourceValidation: {
        topologyAndFieldHashes: "MATCHED",
        causalArtifactHash: "MATCHED",
        historicalProducerIndexReplay: "NOT_ATTEMPTED",
      },
      summary: {
        candidateUniverseStatus: "INCOMPLETE",
        coverageStatus: "PARTIAL",
        candidateBranches: 3,
        assessments: 3,
        minimumCertainTasks: 1,
        conservativeSafetyTasks: 1,
        gaps: 1,
        negativeProofs: 0,
      },
    });
    expect(
      projection.nodes.filter(({ nodeType }) => nodeType === "TARGET_WRITE"),
    ).toHaveLength(1);
    expect(
      projection.nodes.filter(
        ({ nodeType }) => nodeType === "CHANNEL_ASSESSMENT",
      ),
    ).toHaveLength(2);
    expect(
      projection.edges.some(({ edgeType }) => edgeType === "ASSESSES_BRANCH"),
    ).toBe(true);
    expect(
      projection.edges.some(({ edgeType }) => edgeType === "CHANNEL_HAS_GAP"),
    ).toBe(true);
  });

  it("fails closed on causal bytes, topology hash and field hash mismatches", () => {
    const causalHashFixture = setup();
    const changed = {
      ...causalHashFixture.artifact,
      contentHash: "0".repeat(64),
    };
    writeFileSync(causalHashFixture.causalPath, canonicalJson(changed), "utf8");
    expect(() =>
      loadTargetCausalOverlaySource({
        projectTopologyDirectory:
          causalHashFixture.materialized.projectTopologyDirectory,
        fieldEvidenceDirectory: causalHashFixture.fieldDirectory,
        causalArtifactPath: causalHashFixture.causalPath,
      }),
    ).toThrow("TARGET_CAUSAL_OVERLAY_CAUSAL_HASH_INVALID");

    const topologyFixture = setup();
    const { contentHash: _topologyContentHash, ...topologyArtifactBody } =
      topologyFixture.artifact;
    const wrongTopology = canonicalizeTargetTableArtifact({
      ...topologyArtifactBody,
      targetWrite: {
        ...topologyFixture.artifact.targetWrite,
        snapshot: {
          ...topologyFixture.artifact.targetWrite.snapshot,
          tableMultiHopHash: "f".repeat(64),
        },
      },
    });
    writeFileSync(
      topologyFixture.causalPath,
      canonicalJson(wrongTopology),
      "utf8",
    );
    expect(() =>
      loadTargetCausalOverlaySource({
        projectTopologyDirectory:
          topologyFixture.materialized.projectTopologyDirectory,
        fieldEvidenceDirectory: topologyFixture.fieldDirectory,
        causalArtifactPath: topologyFixture.causalPath,
      }),
    ).toThrow("TARGET_CAUSAL_OVERLAY_MULTI_HOP_HASH_MISMATCH");
  });
});

describe("target causal overlay publication and queries", () => {
  it("publishes atomically, reuses exact bytes and exposes bounded explanations", () => {
    const fixture = setup();
    const projection = buildTargetCausalOverlayProjection(fixture.source);
    const first = publishTargetCausalOverlay(projection, {
      outputRoot: fixture.materialized.outputRoot,
    });
    expect(first.status).toBe("CREATED");
    const bytes = [
      "snapshot.json",
      "target-causal.nodes.jsonl",
      "target-causal.edges.jsonl",
      "projection-manifest.json",
    ].map((name) => readFileSync(join(first.directory, name), "utf8"));
    const second = publishTargetCausalOverlay(projection, {
      outputRoot: fixture.materialized.outputRoot,
    });
    expect(second.status).toBe("REUSED");
    expect(
      [
        "snapshot.json",
        "target-causal.nodes.jsonl",
        "target-causal.edges.jsonl",
        "projection-manifest.json",
      ].map((name) => readFileSync(join(second.directory, name), "utf8")),
    ).toEqual(bytes);
    expect(
      loadTargetCausalOverlayDirectory(first.directory).projection,
    ).toEqual(projection);

    const confirmed = getTargetCausalOverlay(first.directory, {
      relationStatuses: ["CONFIRMED_RELATED"],
      limit: 10,
    });
    expect(confirmed.status).toBe("partial");
    expect(confirmed.result.assessments).toHaveLength(2);
    expect(confirmed.warnings).toContain("RUNTIME_RERUN_NOT_EVALUATED");
    const field = getTargetCausalOverlay(first.directory, {
      channels: ["FIELD_VALUE"],
      limit: 10,
    });
    expect(field.result.assessments).toHaveLength(1);

    const rollup = getTargetCausalTaskRollup(
      first.directory,
      "shared-producer",
    );
    expect(rollup.result.task?.properties.inMinimumCertainSet).toBe(true);
    expect(rollup.result.assessments).toHaveLength(1);

    const unknown = projection.nodes.find(
      (node) =>
        node.nodeType === "CAUSAL_ASSESSMENT" &&
        node.properties.relationStatus === "UNKNOWN",
    )!;
    const explanation = explainTargetCausalAssessment(
      first.directory,
      String(unknown.properties.assessmentId),
    );
    expect(explanation.result.assessment).toEqual(unknown);
    expect(explanation.result.gaps).toHaveLength(1);
    expect(explanation.result.channels).toHaveLength(1);
    expect(
      explainTargetCausalAssessment(first.directory, "missing").status,
    ).toBe("not_found");
  });

  it("does not expose an interrupted publication", () => {
    const fixture = setup();
    const projection = buildTargetCausalOverlayProjection(fixture.source);
    const expected = join(
      fixture.materialized.outputRoot,
      "projects",
      projection.snapshot.projectKey,
      "target-causal-overlays",
      projection.snapshot.snapshotId,
    );
    expect(() =>
      publishTargetCausalOverlay(projection, {
        outputRoot: fixture.materialized.outputRoot,
        beforeInstall: () => {
          throw new Error("simulated interruption");
        },
      }),
    ).toThrow("simulated interruption");
    expect(existsSync(expected)).toBe(false);
  });

  it("parses publish and query commands without hidden defaults", () => {
    const absoluteRoot = temporary("target-causal-cli");
    expect(
      parseTargetCausalOverlayCli([
        "publish",
        "--topology",
        join(absoluteRoot, "topology"),
        "--field",
        join(absoluteRoot, "field"),
        "--causal",
        join(absoluteRoot, "causal.json"),
        "--output-root",
        join(absoluteRoot, "output"),
      ]).command,
    ).toBe("publish");
    expect(() =>
      parseTargetCausalOverlayCli([
        "get",
        "--directory",
        absoluteRoot,
        "--relation-status",
        "CAUSES",
      ]),
    ).toThrow("TARGET_CAUSAL_OVERLAY_RELATION_STATUS_INVALID");
  });
});

describe("target causal overlay query-index projection", () => {
  it("indexes the third projection and preserves all causal query envelopes", async () => {
    const fixture = setup();
    const overlayDirectory = publishTargetCausalOverlay(
      buildTargetCausalOverlayProjection(fixture.source),
      { outputRoot: fixture.materialized.outputRoot },
    ).directory;
    const source = loadQueryIndexSource({
      topologyDirectory: fixture.materialized.projectTopologyDirectory,
      fieldEvidenceDirectories: [fixture.fieldDirectory],
      targetCausalOverlayDirectories: [overlayDirectory],
    });
    expect(source.descriptor.targetCausalOverlays).toHaveLength(1);
    expect(source.targetCausalOverlays).toHaveLength(1);
    const store = new InMemoryQueryIndexStore();
    const built = await buildQueryIndex({
      source,
      store,
      auditOutputRoot: join(fixture.root, "query-index-audit"),
      runParity: async () => runRequiredQueryIndexParity({ source, store }),
    });
    expect(built.audit.parityReport.status).toBe("PASSED");
    await expectQueryCliParity(source, store);
    expect(built.audit.parityReport.cases).toHaveLength(21);
    expect(
      built.audit.parityReport.cases.filter(({ caseId }) =>
        caseId.startsWith("causal:"),
      ),
    ).toHaveLength(7);
    const expected = {
      store,
      projectKey: source.descriptor.projectKey,
      expectedSourceDescriptorHash: source.descriptorHash,
      targetCausalOverlaySnapshotId:
        source.descriptor.targetCausalOverlays![0]!.snapshotId,
    };
    expect(
      await getIndexedTargetCausalOverlay(expected, {
        relationStatuses: ["CONFIRMED_RELATED"],
        limit: 10,
      }),
    ).toEqual(
      getTargetCausalOverlay(overlayDirectory, {
        relationStatuses: ["CONFIRMED_RELATED"],
        limit: 10,
      }),
    );
    expect(
      await getIndexedTargetCausalTaskRollup(expected, "shared-producer"),
    ).toEqual(getTargetCausalTaskRollup(overlayDirectory, "shared-producer"));
    const assessmentId = String(
      source.targetCausalOverlays[0]!.projection.nodes.find(
        ({ nodeType }) => nodeType === "CAUSAL_ASSESSMENT",
      )!.properties.assessmentId,
    );
    expect(
      await explainIndexedTargetCausalAssessment(expected, assessmentId),
    ).toEqual(explainTargetCausalAssessment(overlayDirectory, assessmentId));
  });

  it("requires the exact referenced field snapshot in the same index build", () => {
    const fixture = setup();
    const overlayDirectory = publishTargetCausalOverlay(
      buildTargetCausalOverlayProjection(fixture.source),
      { outputRoot: fixture.materialized.outputRoot },
    ).directory;
    expect(() =>
      loadQueryIndexSource({
        topologyDirectory: fixture.materialized.projectTopologyDirectory,
        targetCausalOverlayDirectories: [overlayDirectory],
      }),
    ).toThrow("QUERY_INDEX_CAUSAL_FIELD_MISMATCH");
  });
});
