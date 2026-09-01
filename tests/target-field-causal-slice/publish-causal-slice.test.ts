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
import {
  canonicalizeCausalSliceArtifact,
  type CausalSliceArtifact,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";
import { sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import {
  globalExpressionId,
  globalRelationId,
} from "../../scripts/machine-facts/plan-occurrence-id.ts";
import { generateRerunSets } from "../../scripts/reconcile/consumer/target-field-causal-slice/rerun-sets.ts";
import {
  buildAssessmentPairSkeleton,
  canonicalCandidateBranchId,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import { makeSemanticOccurrenceScope } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import {
  canonicalCausalAssessmentGapId,
  canonicalCausalAssessmentId,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-assessment.ts";
import {
  canonicalRootCriterionId,
  type RootCriterion,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/write-scoped-plan-inputs.ts";

const roots: string[] = [];

const ROOT_FIELD = "hive|warehouse|target|db.target|amount";

function rootCriterion(writeOrdinal: number): RootCriterion {
  const localRootRelationId = `root.project.${writeOrdinal}`;
  const localOutputExpressionId = `${localRootRelationId}:expression:project_expression:0`;
  const value: Omit<RootCriterion, "rootCriterionId"> = {
    rootTaskId: "task-1",
    targetTableKey: "hive|warehouse|target|db.target",
    targetFieldName: "amount",
    rootTargetFieldId: ROOT_FIELD,
    targetFieldBindingId: `target-binding:${writeOrdinal}`,
    rootWriteObservationId: `write:task-1:${writeOrdinal}`,
    writeKind: "INSERT",
    sqlSourceId: `sql:task-1:${writeOrdinal}`,
    sqlSnapshot: `snapshots/sql/task-1-${writeOrdinal}.sql`,
    sqlSha256: sha256(`sql:${writeOrdinal}`),
    writeStatementId: `write-statement:${writeOrdinal}`,
    writeStatementIndex: writeOrdinal,
    statementId: `query-statement:${writeOrdinal}`,
    statementIndex: writeOrdinal,
    queryProducerStatementId: `query-statement:${writeOrdinal}`,
    rootRelationId: globalRelationId(
      "task-1",
      writeOrdinal,
      localRootRelationId,
    ),
    outputExpressionId: globalExpressionId(
      "task-1",
      writeOrdinal,
      localOutputExpressionId,
    ),
    outputBindingId: `output-binding:${writeOrdinal}`,
    sourceOrdinal: 0,
    targetOrdinal: 0,
    producerOutputName: "amount",
    expressionRole: "PROJECT_EXPRESSION",
    localRootRelationId,
    localOutputExpressionId,
    evidenceRefs: [`write:task-1:${writeOrdinal}`],
  };
  return { rootCriterionId: canonicalRootCriterionId(value), ...value };
}

function artifact(): CausalSliceArtifact {
  const rootCriteria = [rootCriterion(0), rootCriterion(1)];
  const semanticScopes = rootCriteria.map((criterion) =>
    makeSemanticOccurrenceScope({ rootCriterion: criterion }),
  );
  const rootBranches = rootCriteria.map((criterion) => {
    const identity = {
      branchKind: "ROOT_WRITE" as const,
      rootTaskId: "task-1",
      consumerTaskId: null,
      producerTaskId: "task-1",
      table: {
        platform: "hive",
        dataSource: "warehouse",
        qualifiedName: "db.target",
        stableTableId: "target",
        identityStatus: "SCHEMA_BACKED" as const,
      },
      readOccurrence: null,
      writeObservationId: criterion.rootWriteObservationId,
      producerRole: null,
      evidenceRefs: [],
      gapRefs: [],
      boundaryReason: null,
    };
    return {
      ...identity,
      candidateBranchId: canonicalCandidateBranchId(identity),
    };
  });
  const candidateUniverse = {
    rootTaskId: "task-1",
    status: "COMPLETE_OBSERVED_EVIDENCE" as const,
    branches: rootBranches,
    boundaryGapRefs: [],
    coverage: {
      sourceArtifactType: "TABLE_MULTI_HOP_RECONCILIATION",
      sourceCoverageStatus: "COMPLETE_OBSERVED_EVIDENCE",
      sourceCoverageSemantics: "OBSERVED_EVIDENCE_ONLY",
      sourceLimitsTruncated: false,
    },
  };
  const pairs = buildAssessmentPairSkeleton(rootCriteria, rootBranches);
  const assessmentGaps = pairs.map((pair) => {
    const input = {
      rootCriterionId: pair.rootCriterionId,
      rootTargetFieldId: pair.rootTargetFieldId,
      candidateBranchId: pair.candidateBranchId,
      reasonCode: "ROOT_WRITE_PROOF_MISSING" as const,
      evidenceRefs: [],
    };
    return { gapId: canonicalCausalAssessmentGapId(input), ...input };
  });
  const assessments = pairs.map((pair, ordinal) => {
    const input = {
      pairId: pair.pairId,
      rootCriterionId: pair.rootCriterionId,
      rootTargetFieldId: pair.rootTargetFieldId,
      candidateBranchId: pair.candidateBranchId,
      status: "UNKNOWN" as const,
      reasonCode: "ROOT_WRITE_PROOF_MISSING" as const,
      positiveProofIds: [],
      negativeProofIds: [],
      gapRefs: [assessmentGaps[ordinal]!.gapId],
    };
    return { assessmentId: canonicalCausalAssessmentId(input), ...input };
  });
  const rerunSets = generateRerunSets({
    candidateUniverse,
    rootCriteria,
    assessments,
  });
  return canonicalizeCausalSliceArtifact({
    request: {
      rootTaskId: "task-1",
      rootTable: "db.target",
      rootFields: [ROOT_FIELD],
      rootWriteObservationIds: rootCriteria.map(
        (criterion) => criterion.rootWriteObservationId,
      ),
      negativeProofMode: "SAFE_RULES_ONLY",
    },
    rootCriteria,
    semanticScopes,
    scopeGaps: [],
    artifactType: "TARGET_FIELD_CAUSAL_SLICE",
    schemaVersion: "2.0.0",
    generatedAt: "2026-08-27T00:00:00Z",
    inputFingerprints: {
      inputPack: [{ fingerprint: sha256("input"), reference: "input" }],
      machineFacts: [{ fingerprint: sha256("facts"), reference: "facts" }],
      producerIndex: [
        { fingerprint: sha256("producer"), reference: "producer" },
      ],
      tableMultiHopArtifact: [
        { fingerprint: sha256("table"), reference: "table" },
      ],
    },
    dependencies: { definitions: [], applications: [], edges: [], gaps: [] },
    candidateUniverse,
    traversal: {
      options: {
        maxDepth: 10,
        maxValueStates: 10,
        maxValuePaths: 10,
        maxControlStates: 10,
        maxControlPaths: 10,
      },
      roots: [],
      sharedEvidenceRefs: [],
      edges: [],
      gaps: [],
    },
    limits: {
      maxDepth: 10,
      value: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] },
      control: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] },
    },
    assessments,
    positiveProofs: [],
    negativeProofs: [],
    assessmentGaps,
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
  it("keeps same-field write criteria distinct in the default text output", () => {
    const outputDir = fixture();
    const value = artifact();

    publishTargetFieldCausalSlice({
      outputDir,
      artifact: value,
      renderHtml: () => "html",
    });

    const output = readFileSync(
      join(outputDir, "target-field-causal-slice.txt"),
      "utf8",
    );
    for (const criterion of value.rootCriteria) {
      expect(output).toContain(criterion.rootCriterionId);
      expect(output).toContain(criterion.rootWriteObservationId);
    }
    expect(output.match(/^Root criterion:/gm)).toHaveLength(2);
  });

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
    const staleStaging = join(
      outputDir,
      ".target-field-causal-slice-staging-stale",
    );
    const staleBackup = join(
      outputDir,
      ".target-field-causal-slice-backup-stale",
    );
    mkdirSync(staleStaging);
    mkdirSync(staleBackup);
    writeFileSync(
      join(outputDir, "target-field-causal-slice.json"),
      "partial-new",
    );
    writeFileSync(
      join(staleBackup, "target-field-causal-slice.json"),
      "old-json",
    );
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
