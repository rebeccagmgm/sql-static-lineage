import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import {
  TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE,
  TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION,
  canonicalizeCausalSliceArtifact,
  validateCausalSliceArtifact,
  type CausalSliceArtifactInput,
} from "../../scripts/reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";
import { makeSemanticDependencyDefinition } from "../../scripts/reconcile/consumer/target-field-causal-slice/semantic-dependency-contract.ts";
import { projectCandidateUniverse, buildAssessmentPairSkeleton } from "../../scripts/reconcile/consumer/target-field-causal-slice/candidate-universe.ts";
import { generateRerunSets } from "../../scripts/reconcile/consumer/target-field-causal-slice/rerun-sets.ts";

const ROOT = "hive|warehouse|target|demo.target|amount";
const SOURCE = "hive|warehouse|source|demo.source|amount";
const FINGERPRINT = sha256("fixture");

function tableArtifact(): Record<string, unknown> {
  return {
    artifactType: "TABLE_MULTI_HOP_RECONCILIATION",
    rootTaskId: "100",
    coverage: { status: "COMPLETE_OBSERVED_EVIDENCE", semantics: "OBSERVED_EVIDENCE_ONLY" },
    limits: { truncated: false },
    writeEdges: [{ producerTaskId: "100", table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.target", stableTableId: "target" }, writes: [{ evidence: [{ source: "sql", locator: "write" }] }] }],
    producerBridges: [{ consumerTaskId: "100", producerTaskId: "200", producerRole: "PRIMARY", table: { platform: "hive", dataSource: "warehouse", qualifiedName: "demo.source", stableTableId: "source" }, readOccurrence: { occurrenceId: "read:100:0", readRelationId: "relation:100:0", statementIndex: 0, relationPath: ["relation:100:0"] } }],
    readEdges: [], scheduleEdges: [{ consumerTaskId: "100", producerTaskId: "300", evidence: [{ source: "HORAE_RELATION", locator: "schedule:100:300" }] }], terminals: [],
  };
}

function baseInput(): CausalSliceArtifactInput {
  const universe = projectCandidateUniverse({
    rootTargetFields: [ROOT],
    tableArtifact: tableArtifact(),
    rootWriteObservationIds: ["write:100:0"],
  });
  const branches = universe.branches;
  const pairs = buildAssessmentPairSkeleton([ROOT], branches);
  const rootWrite = branches.find((branch) => branch.branchKind === "ROOT_WRITE")!;
  const producer = branches.find((branch) => branch.branchKind === "PHYSICAL_PRODUCER")!;
  const confirmedProof = {
    rootTargetFieldId: ROOT, candidateBranchId: producer.candidateBranchId, pathCertainty: "CONFIRMED" as const,
    reasonCode: "CONTINUOUS_CONFIRMED_PATH" as const, pathIds: ["path:confirmed"], edgeIds: ["edge:confirmed"], evidenceRefs: ["evidence:read"],
  };
  const positiveProof = { proofId: `positive-proof:${sha256(canonicalJson(confirmedProof))}`, ...confirmedProof };
  const unknownPair = pairs.find((pair) => pair.candidateBranchId === rootWrite.candidateBranchId)!;
  const unknownGap = { gapId: "assessment-gap:unknown", rootTargetFieldId: ROOT, candidateBranchId: unknownPair.candidateBranchId, reasonCode: "BRANCH_KIND_REQUIRES_SEPARATE_PROOF" as const, evidenceRefs: [] };
  const unrelated = pairs.find((pair) => pair.candidateBranchId !== producer.candidateBranchId && pair.candidateBranchId !== rootWrite.candidateBranchId)!;
  const negativeBase = { rootTargetFieldId: ROOT, candidateBranchId: unrelated.candidateBranchId, reasonCode: "EXPLICIT_SAFE_RULES_ONLY" as const, checkedObligations: [{ kind: "VALUE" as const, evidenceRefs: ["negative:value"] }, { kind: "CONTROL" as const, evidenceRefs: ["negative:control"] }, { kind: "RELATION" as const, evidenceRefs: ["negative:relation"] }], evidenceRefs: ["negative:control", "negative:relation", "negative:value"], sourceNegativeProofId: null };
  const negativeProof = { proofId: `negative-proof:${sha256(canonicalJson(negativeBase))}`, ...negativeBase };
  const assessments = pairs.map((pair) => pair.candidateBranchId === producer.candidateBranchId
    ? { assessmentId: "assessment:confirmed", pairId: pair.pairId, rootTargetFieldId: ROOT, candidateBranchId: pair.candidateBranchId, status: "CONFIRMED_RELATED" as const, reasonCode: "CONTINUOUS_CONFIRMED_PATH" as const, positiveProofIds: [positiveProof.proofId], negativeProofIds: [], gapRefs: [] }
    : pair.candidateBranchId === unrelated.candidateBranchId
      ? { assessmentId: "assessment:unrelated", pairId: pair.pairId, rootTargetFieldId: ROOT, candidateBranchId: pair.candidateBranchId, status: "PROVEN_UNRELATED" as const, reasonCode: "EXPLICIT_SAFE_RULES_ONLY" as const, positiveProofIds: [], negativeProofIds: [negativeProof.proofId], gapRefs: [] }
      : { assessmentId: "assessment:unknown", pairId: pair.pairId, rootTargetFieldId: ROOT, candidateBranchId: pair.candidateBranchId, status: "UNKNOWN" as const, reasonCode: "BRANCH_KIND_REQUIRES_SEPARATE_PROOF" as const, positiveProofIds: [], negativeProofIds: [], gapRefs: [unknownGap.gapId] });
  const rerunSets = generateRerunSets({ candidateUniverse: universe, rootTargetFieldIds: [ROOT], assessments });
  const definition = makeSemanticDependencyDefinition({ subject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE }, effectKind: "VALUE_CONTRIBUTION", operatorKind: "PROJECT", operatorVariant: "DIRECT", operatorRole: "VALUE", localEdgeKind: "VALUE_FLOW" }, "SUPPORTED");
  return {
    artifactType: TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_TYPE, schemaVersion: TARGET_FIELD_CAUSAL_SLICE_SCHEMA_VERSION, generatedAt: "2026-08-27T00:00:00Z",
    request: { rootTaskId: "100", rootTable: "demo.target", rootFields: [ROOT], rootWriteObservationIds: ["write:100:0"], negativeProofMode: "SAFE_RULES_ONLY" },
    inputFingerprints: { inputPack: [{ fingerprint: FINGERPRINT, reference: "input-pack" }], machineFacts: [{ fingerprint: FINGERPRINT, reference: "machine-facts" }], producerIndex: [{ fingerprint: FINGERPRINT, reference: "producer-index" }], tableMultiHopArtifact: [{ fingerprint: FINGERPRINT, reference: "table-artifact" }] },
    dependencies: { definitions: [definition], applications: [], edges: [], gaps: [] }, candidateUniverse: universe,
    traversal: { options: { maxDepth: 10, maxValueStates: 10, maxValuePaths: 10, maxControlStates: 10, maxControlPaths: 10 }, roots: [{ root: { rootTargetFieldId: ROOT, taskId: "100" }, visitedStateKeys: [], activeCycleChecks: 0, frontiers: { VALUE: 0, EXPRESSION_CONTROL: 0, ROWSET_CONTROL: 0, WINDOW_CONTEXT: 0, RELATION_CONTEXT: 0 }, paths: [{ pathId: "path:confirmed", rootTargetFieldId: ROOT, rootDependenceKind: "VALUE_TO_TARGET", pathCertainty: "CONFIRMED", edges: [{ edgeId: "edge:confirmed", fromTaskId: "200", toTaskId: "100", fromSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE }, toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE }, rootDependenceKind: "VALUE_TO_TARGET", localEdgeKind: "VALUE_FLOW", frontierKind: "VALUE", pathCertainty: "CONFIRMED", dependencyId: definition.dependencyId, readOccurrenceId: "read:100:0", evidenceRefs: ["evidence:read"] }] }], gaps: [], decision: { valuePathCertainty: "CONFIRMED", controlPathCertainty: null, valueClosed: true, controlClosed: true, valueGapIds: [], controlGapIds: [] }}], sharedEvidenceRefs: ["evidence:read", "negative:control", "negative:relation", "negative:value"], edges: [{ edgeId: "edge:confirmed", fromTaskId: "200", toTaskId: "100", fromSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE }, toSubject: { subjectKind: "PHYSICAL_FIELD", physicalFieldId: SOURCE }, rootDependenceKind: "VALUE_TO_TARGET", localEdgeKind: "VALUE_FLOW", frontierKind: "VALUE", pathCertainty: "CONFIRMED", dependencyId: definition.dependencyId, readOccurrenceId: "read:100:0", evidenceRefs: ["evidence:read"] }], gaps: [] },
    limits: { maxDepth: 10, value: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] }, control: { maxStates: 10, maxPaths: 10, truncated: false, reasons: [] } }, assessments, positiveProofs: [positiveProof], negativeProofs: [negativeProof], assessmentGaps: [unknownGap], rerunSets, boundaries: { staticSqlOnly: true, runtimeExecution: "NOT_EVALUATED", dataCorrectness: "NOT_EVALUATED", businessAcceptance: "NOT_EVALUATED" },
  };
}

describe("causal slice artifact contract", () => {
  it("canonicalizes ordering, excludes generatedAt from the hash, and validates mixed decisions", () => {
    const first = canonicalizeCausalSliceArtifact(baseInput());
    const second = canonicalizeCausalSliceArtifact({ ...baseInput(), generatedAt: "2027-01-01T00:00:00Z", assessments: [...baseInput().assessments].reverse(), inputFingerprints: { ...baseInput().inputFingerprints, inputPack: [...baseInput().inputFingerprints.inputPack].reverse() } });
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.assessments.map((item) => item.status).sort()).toEqual([
      "CONFIRMED_RELATED",
      "PROVEN_UNRELATED",
      "UNKNOWN",
    ]);
    expect(validateCausalSliceArtifact(first)).toEqual([]);
  });

  it.each([
    ["wrong artifact type", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, artifactType: "FIELD_MULTI_HOP_RECONCILIATION" })],
    ["wrong version", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, schemaVersion: "1.1.0" })],
    ["hash", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, contentHash: "0".repeat(64) })],
    ["unknown without gap", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, assessments: artifact.assessments.map((item) => item.status === "UNKNOWN" ? { ...item, gapRefs: [] } : item) })],
    ["non-NOT_EVALUATED precision", (artifact: ReturnType<typeof canonicalizeCausalSliceArtifact>) => ({ ...artifact, qualityMetrics: { ...artifact.qualityMetrics, precision: "0.5" } })],
  ])("rejects %s", (_name, mutate) => {
    const invalid = mutate(canonicalizeCausalSliceArtifact(baseInput()));
    expect(validateCausalSliceArtifact(invalid)).not.toEqual([]);
  });

  it("rejects a related assessment without a positive proof", () => {
    const artifact = canonicalizeCausalSliceArtifact(baseInput());
    const forged = {
      ...artifact,
      assessments: artifact.assessments.map((assessment) =>
        assessment.status === "CONFIRMED_RELATED"
          ? { ...assessment, positiveProofIds: [] }
          : assessment,
      ),
    };
    expect(validateCausalSliceArtifact(forged).some((error) =>
      error.includes("related assessment has no valid positive proof"),
    )).toBe(true);
  });
});
