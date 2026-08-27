import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { publishTargetFieldCausalSlice } from "../../scripts/reconcile/consumer/target-field-causal-slice/publish-causal-slice.ts";
import { canonicalizeCausalSliceArtifact, type CausalSliceArtifact } from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";
import { sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import { generateRerunSets } from "../../scripts/reconcile/consumer/target-field-causal-slice/rerun-sets.ts";
import { buildAssessmentPairSkeleton } from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";

const roots: string[] = [];

function artifact(): CausalSliceArtifact {
  const rootField = "hive|warehouse|target|db.target|amount";
  const rootBranch = {
    candidateBranchId: "candidate:root-write",
    branchKind: "ROOT_WRITE" as const,
    rootTaskId: "task-1",
    consumerTaskId: null,
    producerTaskId: "task-1",
    table: { platform: "hive", dataSource: "warehouse", qualifiedName: "db.target", stableTableId: "target", identityStatus: "SCHEMA_BACKED" },
    readOccurrence: null,
    writeObservationId: "write:task-1:0",
    producerRole: null,
    evidenceRefs: [],
    gapRefs: [],
    boundaryReason: null,
  };
  const candidateUniverse = {
    rootTaskId: "task-1",
    status: "COMPLETE_OBSERVED_EVIDENCE" as const,
    branches: [rootBranch],
    boundaryGapRefs: [],
    coverage: {
      sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE",
      sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
      sourceLimitsTruncated: false,
    },
  };
  const pair = buildAssessmentPairSkeleton([rootField], [rootBranch])[0]!;
  const gap = {
    gapId: "assessment-gap:root-write",
    rootTargetFieldId: rootField,
    candidateBranchId: rootBranch.candidateBranchId,
    reasonCode: "ROOT_WRITE_PROOF_MISSING" as const,
    evidenceRefs: [],
  };
  const assessments = [{
    assessmentId: "assessment:root-write",
    pairId: pair.pairId,
    rootTargetFieldId: rootField,
    candidateBranchId: rootBranch.candidateBranchId,
    status: "UNKNOWN" as const,
    reasonCode: "ROOT_WRITE_PROOF_MISSING" as const,
    positiveProofIds: [],
    negativeProofIds: [],
    gapRefs: [gap.gapId],
  }];
  const rerunSets = generateRerunSets({
    candidateUniverse,
    rootTargetFieldIds: [rootField],
    assessments,
  });
  return canonicalizeCausalSliceArtifact({
    request: {
      rootTaskId: "task-1",
      rootTable: "db.target",
      rootFields: [rootField],
      rootWriteObservationIds: ["write:task-1:0"],
      negativeProofMode: "SAFE_RULES_ONLY",
    },
    artifactType: "TARGET_FIELD_CAUSAL_SLICE",
    schemaVersion: "1.0.0",
    generatedAt: "2026-08-27T00:00:00Z",
    inputFingerprints: {
      inputPack: [{ fingerprint: sha256("input"), reference: "input" }],
      machineFacts: [{ fingerprint: sha256("facts"), reference: "facts" }],
      producerIndex: [{ fingerprint: sha256("producer"), reference: "producer" }],
      tableMultiHopArtifact: [{ fingerprint: sha256("table"), reference: "table" }],
    },
    dependencies: { definitions: [], applications: [], edges: [], gaps: [] },
    candidateUniverse,
    traversal: {
      options: { maxDepth: 10, maxValueStates: 10, maxValuePaths: 10, maxControlStates: 10, maxControlPaths: 10 },
      roots: [], sharedEvidenceRefs: [], edges: [], gaps: [],
    },
    limits: {
      maxDepth: 10,
      value: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] },
      control: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] },
    },
    assessments, positiveProofs: [], negativeProofs: [], assessmentGaps: [gap],
    rerunSets,
    boundaries: {
      staticSqlOnly: true,
      runtimeExecution: "NOT_EVALUATED",
      dataCorrectness: "NOT_EVALUATED",
      businessAcceptance: "NOT_EVALUATED",
    },
  });
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "publish-causal-slice-"));
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("isolated target-field causal-slice publication", () => {
  it("replaces only the new trio and preserves legacy files byte-for-byte", () => {
    const outputDir = fixture();
    const legacyJson = Buffer.from("legacy-json\0bytes");
    const legacyHtml = Buffer.from("legacy-html\0bytes");
    writeFileSync(join(outputDir, "field-lineage.json"), legacyJson);
    writeFileSync(join(outputDir, "field-lineage.html"), legacyHtml);
    publishTargetFieldCausalSlice({
      outputDir,
      artifact: artifact(),
      formatText: () => "new text",
      renderHtml: () => "new html",
    });
    expect(readFileSync(join(outputDir, "field-lineage.json"))).toEqual(
      legacyJson,
    );
    expect(readFileSync(join(outputDir, "field-lineage.html"))).toEqual(
      legacyHtml,
    );
    expect(
      readFileSync(join(outputDir, "target-field-causal-slice.txt"), "utf8"),
    ).toBe("new text");
    expect(
      readFileSync(join(outputDir, "target-field-causal-slice.html"), "utf8"),
    ).toBe("new html");
  });

  it("rolls back the new outputs when replacement fails and preserves all old bytes", () => {
    const outputDir = fixture();
    const old = {
      json: Buffer.from("old-json\0bytes"),
      text: Buffer.from("old-text\0bytes"),
      html: Buffer.from("old-html\0bytes"),
      legacyJson: Buffer.from("old-legacy-json\0bytes"),
      legacyHtml: Buffer.from("old-legacy-html\0bytes"),
    };
    writeFileSync(join(outputDir, "target-field-causal-slice.json"), old.json);
    writeFileSync(join(outputDir, "target-field-causal-slice.txt"), old.text);
    writeFileSync(join(outputDir, "target-field-causal-slice.html"), old.html);
    writeFileSync(join(outputDir, "field-lineage.json"), old.legacyJson);
    writeFileSync(join(outputDir, "field-lineage.html"), old.legacyHtml);
    expect(() =>
      publishTargetFieldCausalSlice({
        outputDir,
        artifact: artifact(),
        formatText: () => "new text",
        renderHtml: () => "new html",
        replaceFile: (staged, target) => {
          if (target.endsWith("target-field-causal-slice.html"))
            throw new Error("injected replace failure");
          writeFileSync(target, readFileSync(staged));
        },
      }),
    ).toThrow("injected replace failure");
    expect(
      readFileSync(join(outputDir, "target-field-causal-slice.json")),
    ).toEqual(old.json);
    expect(
      readFileSync(join(outputDir, "target-field-causal-slice.txt")),
    ).toEqual(old.text);
    expect(
      readFileSync(join(outputDir, "target-field-causal-slice.html")),
    ).toEqual(old.html);
    expect(readFileSync(join(outputDir, "field-lineage.json"))).toEqual(
      old.legacyJson,
    );
    expect(readFileSync(join(outputDir, "field-lineage.html"))).toEqual(
      old.legacyHtml,
    );
  });

  it("rejects a concurrent publisher while its owner process is alive", () => {
    const outputDir = fixture();
    writeFileSync(
      join(outputDir, ".target-field-causal-slice.lock"),
      `${JSON.stringify({ pid: process.pid })}\n`,
    );
    expect(() =>
      publishTargetFieldCausalSlice({ outputDir, artifact: artifact() }),
    ).toThrow(`CAUSAL_SLICE_PUBLICATION_LOCKED:${process.pid}`);
  });

  it("recovers an interrupted replacement before starting a new publication", () => {
    const outputDir = fixture();
    const staleStaging = join(outputDir, ".target-field-causal-slice-staging-stale");
    const staleBackup = join(outputDir, ".target-field-causal-slice-backup-stale");
    mkdirSync(staleStaging);
    mkdirSync(staleBackup);
    writeFileSync(join(outputDir, "target-field-causal-slice.json"), "partial-new");
    writeFileSync(join(staleBackup, "target-field-causal-slice.json"), "old-json");
    writeFileSync(
      join(outputDir, ".target-field-causal-slice-publish.json"),
      `${JSON.stringify({
        pid: 999999,
        stagingDir: staleStaging,
        backupDir: staleBackup,
        replaced: ["target-field-causal-slice.json"],
        backedUp: ["target-field-causal-slice.json"],
        status: "REPLACING",
      })}\n`,
    );

    expect(() =>
      publishTargetFieldCausalSlice({
        outputDir,
        artifact: artifact(),
        replaceFile: () => {
          throw new Error("stop after recovery");
        },
      }),
    ).toThrow("stop after recovery");
    expect(
      readFileSync(join(outputDir, "target-field-causal-slice.json"), "utf8"),
    ).toBe("old-json");
  });

  it("rejects a recovery journal that points outside the output directory", () => {
    const outputDir = fixture();
    const external = fixture();
    const marker = join(external, "keep.txt");
    writeFileSync(marker, "keep");
    writeFileSync(
      join(outputDir, ".target-field-causal-slice-publish.json"),
      `${JSON.stringify({
        pid: 999999,
        stagingDir: external,
        backupDir: external,
        replaced: [],
        backedUp: [],
        status: "REPLACING",
      })}\n`,
    );

    expect(() =>
      publishTargetFieldCausalSlice({ outputDir, artifact: artifact() }),
    ).toThrow("CAUSAL_SLICE_PUBLICATION_JOURNAL_INVALID");
    expect(readFileSync(marker, "utf8")).toBe("keep");
  });
});
