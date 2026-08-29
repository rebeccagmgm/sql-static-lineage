import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  sha256,
} from "../machine-facts/machine-facts-contract.ts";
import type { CandidateTaskSemanticFacts, ImpactKind } from "./contract.ts";
import type {
  NativeRelationEvidence,
  NativeStatementEvidence,
} from "./evidence-adapter.ts";
import { loadNativeLeafEvidence } from "./native-evidence-loader.ts";
import { resolvePocOutputPath } from "./output-guard.ts";
import { parseProviderResponse } from "./protocol.ts";

const IMPACT_KINDS: readonly ImpactKind[] = [
  "FIELD_VALUE",
  "EXPRESSION_CONTROL",
  "ROW_MEMBERSHIP",
  "NULL_EXTENSION",
  "MULTIPLICITY",
  "GROUPING",
  "SET_MEMBERSHIP",
  "WINDOW_EFFECT",
  "ORDER_SELECTION",
  "RELATION_EXISTENCE",
];

type Dependency = CandidateTaskSemanticFacts["dependencies"][number];
type Relation = CandidateTaskSemanticFacts["relations"][number];
type Certainty = "CONFIRMED" | "UNKNOWN";
type ReadStatus =
  "DIRECT_AND_OR_INDIRECT" | "INDIRECT_ONLY" | "NOT_REACHED" | "UNKNOWN";

export interface ImpactTraversalLimits {
  readonly maxDepth: number;
  readonly maxStatesPerSource: number;
}

export interface ImpactValueGap {
  readonly gapId: string;
  readonly code:
    | "ROOT_RELATION_NOT_UNIQUE"
    | "NATIVE_STATEMENT_IDENTITY_MISMATCH"
    | "NATIVE_SOURCE_OCCURRENCE_NOT_EXACT"
    | "NATIVE_SOURCE_FIELD_NOT_EXACT"
    | "DEPENDENCY_NOT_EVALUATED"
    | "DEPENDENCY_OPERATOR_MISSING"
    | "EVIDENCE_MAPPING_MISSING"
    | "EVIDENCE_MAPPING_SUBJECT_MISMATCH"
    | "EVIDENCE_MAPPING_NOT_EXACT"
    | "EVIDENCE_REFS_MISSING"
    | "MAX_DEPTH_REACHED"
    | "MAX_STATES_REACHED";
  readonly message: string;
  readonly subjectRefs: readonly string[];
}

export interface CalcitePlanImpactWitness {
  readonly channel: ImpactKind;
  readonly coordinateSystem: "CALCITE_VALIDATED_PLAN";
  readonly operatorSourceSpanStatus: "NOT_ASSEMBLED";
  readonly certainty: "CONFIRMED";
  readonly nativeRelationOccurrenceId: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly dependencyIds: readonly string[];
  readonly operatorIds: readonly string[];
  readonly evidenceMappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly depth: number;
  readonly planWitnessSha256: string;
}

export interface ReadImpactValueAssessment {
  readonly relationId: string;
  readonly providerOrdinal?: number;
  readonly qualifiedPhysicalTable?: string;
  readonly nativeRelationOccurrenceId?: string;
  readonly nativeSourceSpan?: { readonly start: number; readonly end: number };
  readonly nativeEvidenceRefs: readonly string[];
  readonly status: ReadStatus;
  readonly directFieldValueWitness?: CalcitePlanImpactWitness;
  readonly indirectWitnesses: readonly CalcitePlanImpactWitness[];
  readonly unknownRootPathObserved: boolean;
  readonly gapRefs: readonly string[];
}

export interface CalciteImpactValueReport {
  readonly reportVersion: 1;
  readonly reportKind: "CALCITE_INDIRECT_IMPACT_VALUE_GATE";
  readonly productionProviderDecision: "VALIDATION_ONLY";
  readonly safety: {
    readonly canonicalArtifactsWritten: false;
    readonly nativeSemanticFallback: false;
    readonly productionIntegrationPerformed: false;
    readonly provenUnrelatedEnabled: false;
  };
  readonly input: CandidateTaskSemanticFacts["input"];
  readonly provider: CandidateTaskSemanticFacts["provider"];
  readonly root: {
    readonly status: "EXACT" | "UNKNOWN";
    readonly relationId?: string;
    readonly providerOrdinal: 0;
  };
  readonly valueGate: {
    readonly decision: "CALCITE_INDIRECT_IMPACT_VALUE_PROVEN" | "NO_GO";
    readonly criterion: "AT_LEAST_ONE_EXACT_INDIRECT_ONLY_NATIVE_READ";
    readonly exactIndirectOnlyReadCount: number;
  };
  readonly summary: {
    readonly tableScanCount: number;
    readonly exactNativeReadCount: number;
    readonly reachedReadCount: number;
    readonly directFieldValueReadCount: number;
    readonly indirectImpactReadCount: number;
    readonly indirectOnlyReadCount: number;
    readonly calciteAddedReadCount: number;
    readonly notReachedReadCount: number;
    readonly unknownReadCount: number;
    readonly impactChannelReadCounts: Readonly<Record<ImpactKind, number>>;
  };
  readonly limits: ImpactTraversalLimits & {
    readonly stateUpdates: number;
    readonly truncatedSourceCount: number;
  };
  readonly reads: readonly ReadImpactValueAssessment[];
  readonly gaps: readonly ImpactValueGap[];
}

interface TraversalState {
  readonly ref: string;
  readonly sourceRef: string;
  readonly impacts: readonly ImpactKind[];
  readonly certainty: Certainty;
  readonly dependencyIds: readonly string[];
  readonly operatorIds: readonly string[];
  readonly evidenceMappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly gapRefs: readonly string[];
  readonly depth: number;
}

interface DependencyQuality {
  readonly certainty: Certainty;
  readonly evidenceMappingRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly gaps: readonly ImpactValueGap[];
}

interface NativeSourceResolution {
  readonly relation?: NativeRelationEvidence;
  readonly gaps: readonly ImpactValueGap[];
}

const DEFAULT_LIMITS: ImpactTraversalLimits = Object.freeze({
  maxDepth: 128,
  maxStatesPerSource: 50_000,
});

export function buildImpactValueReport(input: {
  readonly facts: CandidateTaskSemanticFacts;
  readonly native: NativeStatementEvidence;
  readonly limits?: Partial<ImpactTraversalLimits>;
}): CalciteImpactValueReport {
  const limits = normalizeLimits(input.limits);
  const gaps = new Map<string, ImpactValueGap>();
  const nativeStatementIdentityExact =
    input.facts.input.sqlSourceId === input.native.sqlSourceId &&
    input.facts.input.statementOrdinal === input.native.statementOrdinal &&
    input.facts.input.sqlSha256 === input.native.sqlSha256;
  if (!nativeStatementIdentityExact) {
    addGap(
      gaps,
      gap(
        "NATIVE_STATEMENT_IDENTITY_MISMATCH",
        input.facts.input.sqlSourceId,
        "Native statement identity does not exactly match the Calcite input.",
        [input.facts.input.sqlSourceId, input.native.sqlSourceId],
      ),
    );
  }
  const rootCandidates = input.facts.relations.filter(
    (relation) => relation.providerOrdinal === 0,
  );
  const root = rootCandidates.length === 1 ? rootCandidates[0] : undefined;
  if (!root) {
    addGap(
      gaps,
      gap(
        "ROOT_RELATION_NOT_UNIQUE",
        "facts:root",
        "Calcite plan must expose exactly one providerOrdinal=0 root relation.",
        rootCandidates.map((relation) => relation.relationId),
      ),
    );
  }
  const dependenciesBySource = groupDependenciesBySource(
    input.facts.dependencies,
  );
  const mappings = new Map(
    input.facts.evidenceMappings.map((mapping) => [mapping.mappingId, mapping]),
  );
  const operators = new Map(
    input.facts.operators.map((operator) => [operator.operatorId, operator]),
  );
  const nativeByOrdinal = groupNativeByOrdinal(input.native.relations);
  const tableScans = input.facts.relations
    .filter((relation) => relation.kind === "TABLE_SCAN")
    .sort(compareRelations);
  const reads: ReadImpactValueAssessment[] = [];
  let stateUpdates = 0;
  let truncatedSourceCount = 0;

  for (const source of tableScans) {
    const sourceGapIds = new Set<string>();
    const nativeResolution = resolveNativeSource(source, nativeByOrdinal);
    for (const item of nativeResolution.gaps) {
      addGap(gaps, item);
      sourceGapIds.add(item.gapId);
    }
    if (!root || !nativeStatementIdentityExact || !nativeResolution.relation) {
      if (!nativeStatementIdentityExact) {
        sourceGapIds.add(
          gap(
            "NATIVE_STATEMENT_IDENTITY_MISMATCH",
            input.facts.input.sqlSourceId,
            "Native statement identity does not exactly match the Calcite input.",
            [input.facts.input.sqlSourceId, input.native.sqlSourceId],
          ).gapId,
        );
      }
      reads.push(
        readAssessment(
          source,
          nativeResolution.relation,
          "UNKNOWN",
          undefined,
          [],
          false,
          sourceGapIds,
        ),
      );
      continue;
    }
    const traversal = traverseSource({
      facts: input.facts,
      source,
      nativeSource: nativeResolution.relation,
      root,
      dependenciesBySource,
      mappings,
      operators,
      limits,
      globalGaps: gaps,
    });
    stateUpdates += traversal.stateUpdates;
    if (traversal.truncated) truncatedSourceCount++;
    for (const gapRef of traversal.gapRefs) sourceGapIds.add(gapRef);
    const direct = traversal.exactWitnesses.get("FIELD_VALUE");
    const indirect = IMPACT_KINDS.filter((impact) => impact !== "FIELD_VALUE")
      .map((impact) => traversal.exactWitnesses.get(impact))
      .filter(
        (witness): witness is CalcitePlanImpactWitness => witness !== undefined,
      );
    const status: ReadStatus = direct
      ? "DIRECT_AND_OR_INDIRECT"
      : indirect.length > 0
        ? "INDIRECT_ONLY"
        : traversal.unknownRootPathObserved || sourceGapIds.size > 0
          ? "UNKNOWN"
          : "NOT_REACHED";
    reads.push(
      readAssessment(
        source,
        nativeResolution.relation,
        status,
        direct,
        indirect,
        traversal.unknownRootPathObserved,
        sourceGapIds,
      ),
    );
  }

  const sortedReads = reads.sort(compareReadAssessments);
  const directCount = sortedReads.filter(
    (read) => read.directFieldValueWitness !== undefined,
  ).length;
  const indirectCount = sortedReads.filter(
    (read) => read.indirectWitnesses.length > 0,
  ).length;
  const indirectOnlyCount = sortedReads.filter(
    (read) => read.status === "INDIRECT_ONLY",
  ).length;
  const impactChannelReadCounts = Object.fromEntries(
    IMPACT_KINDS.map((impact) => [
      impact,
      impact === "FIELD_VALUE"
        ? directCount
        : sortedReads.filter((read) =>
            read.indirectWitnesses.some(
              (witness) => witness.channel === impact,
            ),
          ).length,
    ]),
  ) as Record<ImpactKind, number>;
  const report: CalciteImpactValueReport = {
    reportVersion: 1,
    reportKind: "CALCITE_INDIRECT_IMPACT_VALUE_GATE",
    productionProviderDecision: "VALIDATION_ONLY",
    safety: {
      canonicalArtifactsWritten: false,
      nativeSemanticFallback: false,
      productionIntegrationPerformed: false,
      provenUnrelatedEnabled: false,
    },
    input: input.facts.input,
    provider: input.facts.provider,
    root: root
      ? { status: "EXACT", relationId: root.relationId, providerOrdinal: 0 }
      : { status: "UNKNOWN", providerOrdinal: 0 },
    valueGate: {
      decision:
        indirectOnlyCount > 0
          ? "CALCITE_INDIRECT_IMPACT_VALUE_PROVEN"
          : "NO_GO",
      criterion: "AT_LEAST_ONE_EXACT_INDIRECT_ONLY_NATIVE_READ",
      exactIndirectOnlyReadCount: indirectOnlyCount,
    },
    summary: {
      tableScanCount: tableScans.length,
      exactNativeReadCount: sortedReads.filter(
        (read) => read.nativeRelationOccurrenceId !== undefined,
      ).length,
      reachedReadCount: sortedReads.filter(
        (read) =>
          read.status === "DIRECT_AND_OR_INDIRECT" ||
          read.status === "INDIRECT_ONLY",
      ).length,
      directFieldValueReadCount: directCount,
      indirectImpactReadCount: indirectCount,
      indirectOnlyReadCount: indirectOnlyCount,
      calciteAddedReadCount: indirectOnlyCount,
      notReachedReadCount: sortedReads.filter(
        (read) => read.status === "NOT_REACHED",
      ).length,
      unknownReadCount: sortedReads.filter((read) => read.status === "UNKNOWN")
        .length,
      impactChannelReadCounts,
    },
    limits: {
      ...limits,
      stateUpdates,
      truncatedSourceCount,
    },
    reads: sortedReads,
    gaps: [...gaps.values()].sort((left, right) =>
      left.gapId.localeCompare(right.gapId),
    ),
  };
  return Object.freeze(report);
}

function traverseSource(input: {
  readonly facts: CandidateTaskSemanticFacts;
  readonly source: Relation;
  readonly nativeSource: NativeRelationEvidence;
  readonly root: Relation;
  readonly dependenciesBySource: ReadonlyMap<string, readonly Dependency[]>;
  readonly mappings: ReadonlyMap<
    string,
    CandidateTaskSemanticFacts["evidenceMappings"][number]
  >;
  readonly operators: ReadonlyMap<
    string,
    CandidateTaskSemanticFacts["operators"][number]
  >;
  readonly limits: ImpactTraversalLimits;
  readonly globalGaps: Map<string, ImpactValueGap>;
}): {
  readonly exactWitnesses: ReadonlyMap<ImpactKind, CalcitePlanImpactWitness>;
  readonly unknownRootPathObserved: boolean;
  readonly gapRefs: ReadonlySet<string>;
  readonly stateUpdates: number;
  readonly truncated: boolean;
} {
  const queue: TraversalState[] = [];
  const seen = new Set<string>();
  const gapRefs = new Set<string>();
  const exactWitnesses = new Map<ImpactKind, CalcitePlanImpactWitness>();
  const nativeEvidenceRefs = sorted(input.nativeSource.evidenceRefs);
  const nativeFieldsBySlot = groupNativeFieldsBySlot(input.nativeSource);
  for (const fieldId of [...input.source.outputFieldIds].sort()) {
    const field = input.facts.fields.find(
      (candidate) => candidate.fieldId === fieldId,
    );
    const nativeFields = field
      ? (nativeFieldsBySlot.get(field.slot) ?? [])
      : [];
    if (
      !field ||
      nativeFields.length !== 1 ||
      nativeFields[0]!.evidenceRefs.length === 0
    ) {
      const item = gap(
        "NATIVE_SOURCE_FIELD_NOT_EXACT",
        `${input.source.relationId}:${fieldId}`,
        "Source field does not map to exactly one Native field occurrence with evidence.",
        [input.source.relationId, fieldId],
      );
      addGap(input.globalGaps, item);
      gapRefs.add(item.gapId);
      queue.push(
        initialState(fieldId, "UNKNOWN", [], nativeEvidenceRefs, [item.gapId]),
      );
      continue;
    }
    queue.push(
      initialState(
        fieldId,
        "CONFIRMED",
        [],
        sorted([...nativeEvidenceRefs, ...nativeFields[0]!.evidenceRefs]),
        [],
      ),
    );
  }
  queue.push(
    initialState(
      input.source.relationId,
      "CONFIRMED",
      ["RELATION_EXISTENCE"],
      nativeEvidenceRefs,
      [],
    ),
  );
  queue.sort(compareStates);
  const rootRefs = new Set([
    input.root.relationId,
    ...input.root.outputFieldIds,
  ]);
  let cursor = 0;
  let stateUpdates = 0;
  let unknownRootPathObserved = false;
  let truncated = false;
  while (cursor < queue.length) {
    const state = queue[cursor++]!;
    const key = stateKey(state);
    if (seen.has(key)) continue;
    seen.add(key);
    stateUpdates++;
    if (stateUpdates > input.limits.maxStatesPerSource) {
      const item = gap(
        "MAX_STATES_REACHED",
        input.source.relationId,
        "Calcite impact traversal exceeded maxStatesPerSource.",
        [input.source.relationId],
      );
      addGap(input.globalGaps, item);
      gapRefs.add(item.gapId);
      truncated = true;
      break;
    }
    if (rootRefs.has(state.ref)) {
      if (state.certainty === "UNKNOWN") {
        unknownRootPathObserved = true;
      } else if (state.impacts.length === 0) {
        recordWitness(
          exactWitnesses,
          "FIELD_VALUE",
          makeWitness(
            input.facts,
            input.source,
            input.nativeSource,
            input.root,
            state,
            "FIELD_VALUE",
          ),
        );
      } else {
        for (const impact of state.impacts) {
          recordWitness(
            exactWitnesses,
            impact,
            makeWitness(
              input.facts,
              input.source,
              input.nativeSource,
              input.root,
              state,
              impact,
            ),
          );
        }
      }
      continue;
    }
    const outgoing = input.dependenciesBySource.get(state.ref) ?? [];
    if (state.depth >= input.limits.maxDepth && outgoing.length > 0) {
      const item = gap(
        "MAX_DEPTH_REACHED",
        `${input.source.relationId}:${state.ref}`,
        "Calcite impact traversal exceeded maxDepth before reaching the root.",
        [input.source.relationId, state.ref],
      );
      addGap(input.globalGaps, item);
      gapRefs.add(item.gapId);
      truncated = true;
      continue;
    }
    for (const dependency of outgoing) {
      const quality = dependencyQuality(
        dependency,
        input.mappings,
        input.operators,
      );
      for (const item of quality.gaps) {
        addGap(input.globalGaps, item);
        gapRefs.add(item.gapId);
      }
      const certainty: Certainty =
        state.certainty === "CONFIRMED" && quality.certainty === "CONFIRMED"
          ? "CONFIRMED"
          : "UNKNOWN";
      const impacts =
        dependency.impactKind === "FIELD_VALUE"
          ? state.impacts
          : sortedImpacts([...state.impacts, dependency.impactKind]);
      for (const target of [...dependency.toRefs].sort()) {
        queue.push({
          ref: target,
          sourceRef: state.sourceRef,
          impacts,
          certainty,
          dependencyIds: [...state.dependencyIds, dependency.dependencyId],
          operatorIds: uniqueInOrder([
            ...state.operatorIds,
            dependency.operatorId,
          ]),
          evidenceMappingRefs: uniqueInOrder([
            ...state.evidenceMappingRefs,
            ...quality.evidenceMappingRefs,
          ]),
          evidenceRefs: sorted([
            ...state.evidenceRefs,
            ...quality.evidenceRefs,
          ]),
          gapRefs: sorted([
            ...state.gapRefs,
            ...quality.gaps.map((item) => item.gapId),
          ]),
          depth: state.depth + 1,
        });
      }
    }
  }
  return {
    exactWitnesses,
    unknownRootPathObserved,
    gapRefs,
    stateUpdates,
    truncated,
  };
}

function dependencyQuality(
  dependency: Dependency,
  mappings: ReadonlyMap<
    string,
    CandidateTaskSemanticFacts["evidenceMappings"][number]
  >,
  operators: ReadonlyMap<
    string,
    CandidateTaskSemanticFacts["operators"][number]
  >,
): DependencyQuality {
  const gaps: ImpactValueGap[] = [];
  const evidenceRefs: string[] = [];
  if (dependency.evaluationStatus !== "EVALUATED") {
    gaps.push(
      gap(
        "DEPENDENCY_NOT_EVALUATED",
        dependency.dependencyId,
        "Calcite dependency is not EVALUATED.",
        [dependency.dependencyId],
      ),
    );
  }
  if (!operators.has(dependency.operatorId)) {
    gaps.push(
      gap(
        "DEPENDENCY_OPERATOR_MISSING",
        dependency.dependencyId,
        "Calcite dependency references a missing operator.",
        [dependency.dependencyId, dependency.operatorId],
      ),
    );
  }
  if (dependency.evidenceMappingRefs.length === 0) {
    gaps.push(
      gap(
        "EVIDENCE_MAPPING_MISSING",
        dependency.dependencyId,
        "Calcite dependency has no evidence mapping reference.",
        [dependency.dependencyId],
      ),
    );
  }
  for (const mappingId of dependency.evidenceMappingRefs) {
    const mapping = mappings.get(mappingId);
    if (!mapping) {
      gaps.push(
        gap(
          "EVIDENCE_MAPPING_MISSING",
          `${dependency.dependencyId}:${mappingId}`,
          "Referenced dependency evidence mapping does not exist.",
          [dependency.dependencyId, mappingId],
        ),
      );
      continue;
    }
    if (mapping.mappingStatus !== "EXACT") {
      gaps.push(
        gap(
          "EVIDENCE_MAPPING_NOT_EXACT",
          `${dependency.dependencyId}:${mappingId}`,
          "Dependency evidence mapping is not EXACT.",
          [dependency.dependencyId, mappingId],
        ),
      );
      continue;
    }
    if (mapping.providerRefId !== dependency.dependencyId) {
      gaps.push(
        gap(
          "EVIDENCE_MAPPING_SUBJECT_MISMATCH",
          `${dependency.dependencyId}:${mappingId}`,
          "Exact evidence mapping is not bound to the current dependency.",
          [dependency.dependencyId, mappingId, mapping.providerRefId],
        ),
      );
      continue;
    }
    if (mapping.evidenceRefs.length === 0) {
      gaps.push(
        gap(
          "EVIDENCE_REFS_MISSING",
          `${dependency.dependencyId}:${mappingId}`,
          "Exact dependency mapping has no Native evidence refs.",
          [dependency.dependencyId, mappingId],
        ),
      );
      continue;
    }
    evidenceRefs.push(...mapping.evidenceRefs);
  }
  return {
    certainty: gaps.length === 0 ? "CONFIRMED" : "UNKNOWN",
    evidenceMappingRefs: [...dependency.evidenceMappingRefs],
    evidenceRefs: sorted(evidenceRefs),
    gaps,
  };
}

function makeWitness(
  facts: CandidateTaskSemanticFacts,
  source: Relation,
  nativeSource: NativeRelationEvidence,
  root: Relation,
  state: TraversalState,
  channel: ImpactKind,
): CalcitePlanImpactWitness {
  const dependencies = state.dependencyIds.map((dependencyId) =>
    facts.dependencies.find(
      (dependency) => dependency.dependencyId === dependencyId,
    ),
  );
  const operators = state.operatorIds.map((operatorId) =>
    facts.operators.find((operator) => operator.operatorId === operatorId),
  );
  const basis = {
    coordinateSystem: "CALCITE_VALIDATED_PLAN",
    provider: facts.provider,
    input: facts.input,
    rootRelationId: root.relationId,
    sourceRelationId: source.relationId,
    nativeSource: {
      nativeRelationOccurrenceId: nativeSource.nativeRelationOccurrenceId,
      qualifiedPhysicalTable: nativeSource.qualifiedPhysicalTable,
      sourceSpan: nativeSource.sourceSpan,
      evidenceRefs: sorted(nativeSource.evidenceRefs),
    },
    sourceRef: state.sourceRef,
    targetRef: state.ref,
    channel,
    dependencies,
    operators,
    evidenceMappingRefs: state.evidenceMappingRefs,
    evidenceRefs: state.evidenceRefs,
  };
  return {
    channel,
    coordinateSystem: "CALCITE_VALIDATED_PLAN",
    operatorSourceSpanStatus: "NOT_ASSEMBLED",
    certainty: "CONFIRMED",
    nativeRelationOccurrenceId: nativeSource.nativeRelationOccurrenceId,
    sourceRef: state.sourceRef,
    targetRef: state.ref,
    dependencyIds: state.dependencyIds,
    operatorIds: state.operatorIds,
    evidenceMappingRefs: state.evidenceMappingRefs,
    evidenceRefs: state.evidenceRefs,
    depth: state.depth,
    planWitnessSha256: sha256(canonicalJson(basis)),
  };
}

function resolveNativeSource(
  source: Relation,
  nativeByOrdinal: ReadonlyMap<number, readonly NativeRelationEvidence[]>,
): NativeSourceResolution {
  const candidates =
    source.providerOrdinal === undefined
      ? []
      : (nativeByOrdinal.get(source.providerOrdinal) ?? []);
  const exact = candidates.filter(
    (candidate) =>
      source.qualifiedTableName !== undefined &&
      candidate.qualifiedPhysicalTable !== undefined &&
      canonicalPhysicalName(source.qualifiedTableName) ===
        canonicalPhysicalName(candidate.qualifiedPhysicalTable),
  );
  if (exact.length !== 1 || exact[0]!.evidenceRefs.length === 0) {
    return {
      gaps: [
        gap(
          "NATIVE_SOURCE_OCCURRENCE_NOT_EXACT",
          source.relationId,
          "TableScan does not map by canonical physical identity and provider ordinal to exactly one Native read occurrence with evidence.",
          [source.relationId],
        ),
      ],
    };
  }
  return { relation: exact[0], gaps: [] };
}

function readAssessment(
  source: Relation,
  native: NativeRelationEvidence | undefined,
  status: ReadStatus,
  direct: CalcitePlanImpactWitness | undefined,
  indirect: readonly CalcitePlanImpactWitness[],
  unknownRootPathObserved: boolean,
  gapRefs: ReadonlySet<string>,
): ReadImpactValueAssessment {
  return {
    relationId: source.relationId,
    ...(source.providerOrdinal === undefined
      ? {}
      : { providerOrdinal: source.providerOrdinal }),
    ...(source.qualifiedTableName
      ? { qualifiedPhysicalTable: source.qualifiedTableName }
      : {}),
    ...(native
      ? {
          nativeRelationOccurrenceId: native.nativeRelationOccurrenceId,
          nativeSourceSpan: native.sourceSpan,
        }
      : {}),
    nativeEvidenceRefs: sorted(native?.evidenceRefs ?? []),
    status,
    ...(direct ? { directFieldValueWitness: direct } : {}),
    indirectWitnesses: [...indirect].sort((left, right) =>
      left.channel.localeCompare(right.channel),
    ),
    unknownRootPathObserved,
    gapRefs: [...gapRefs].sort(),
  };
}

function initialState(
  ref: string,
  certainty: Certainty,
  impacts: readonly ImpactKind[],
  evidenceRefs: readonly string[],
  gapRefs: readonly string[],
): TraversalState {
  return {
    ref,
    sourceRef: ref,
    impacts,
    certainty,
    dependencyIds: [],
    operatorIds: [],
    evidenceMappingRefs: [],
    evidenceRefs,
    gapRefs,
    depth: 0,
  };
}

function recordWitness(
  witnesses: Map<ImpactKind, CalcitePlanImpactWitness>,
  channel: ImpactKind,
  candidate: CalcitePlanImpactWitness,
): void {
  const current = witnesses.get(channel);
  if (
    !current ||
    candidate.depth < current.depth ||
    (candidate.depth === current.depth &&
      candidate.dependencyIds
        .join("\u0000")
        .localeCompare(current.dependencyIds.join("\u0000")) < 0)
  ) {
    witnesses.set(channel, candidate);
  }
}

function groupDependenciesBySource(
  dependencies: readonly Dependency[],
): ReadonlyMap<string, readonly Dependency[]> {
  const result = new Map<string, Dependency[]>();
  for (const dependency of dependencies) {
    for (const source of dependency.fromRefs) {
      result.set(source, [...(result.get(source) ?? []), dependency]);
    }
  }
  for (const [source, values] of result) {
    result.set(
      source,
      values.sort((left, right) =>
        left.dependencyId.localeCompare(right.dependencyId),
      ),
    );
  }
  return result;
}

function groupNativeByOrdinal(
  relations: readonly NativeRelationEvidence[],
): ReadonlyMap<number, readonly NativeRelationEvidence[]> {
  const result = new Map<number, NativeRelationEvidence[]>();
  for (const relation of relations) {
    result.set(relation.providerRelationOrdinal, [
      ...(result.get(relation.providerRelationOrdinal) ?? []),
      relation,
    ]);
  }
  return result;
}

function groupNativeFieldsBySlot(
  relation: NativeRelationEvidence,
): ReadonlyMap<number, readonly NativeRelationEvidence["fields"][number][]> {
  const result = new Map<number, NativeRelationEvidence["fields"][number][]>();
  for (const field of relation.fields) {
    result.set(field.slot, [...(result.get(field.slot) ?? []), field]);
  }
  return result;
}

function stateKey(state: TraversalState): string {
  return `${state.ref}|${state.impacts.join(",")}|${state.certainty}`;
}

function gap(
  code: ImpactValueGap["code"],
  discriminator: string,
  message: string,
  subjectRefs: readonly string[],
): ImpactValueGap {
  return {
    gapId: `gap:${code.toLowerCase()}:${sha256(discriminator).slice(0, 16)}`,
    code,
    message,
    subjectRefs: sorted(subjectRefs),
  };
}

function addGap(
  target: Map<string, ImpactValueGap>,
  item: ImpactValueGap,
): void {
  target.set(item.gapId, item);
}

function normalizeLimits(
  input: Partial<ImpactTraversalLimits> | undefined,
): ImpactTraversalLimits {
  const maxDepth = input?.maxDepth ?? DEFAULT_LIMITS.maxDepth;
  const maxStatesPerSource =
    input?.maxStatesPerSource ?? DEFAULT_LIMITS.maxStatesPerSource;
  if (!Number.isInteger(maxDepth) || maxDepth < 0)
    throw new Error("maxDepth must be a non-negative integer");
  if (!Number.isInteger(maxStatesPerSource) || maxStatesPerSource < 1) {
    throw new Error("maxStatesPerSource must be a positive integer");
  }
  return { maxDepth, maxStatesPerSource };
}

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sortedImpacts(values: readonly ImpactKind[]): ImpactKind[] {
  return [...new Set(values)].sort(
    (left, right) => IMPACT_KINDS.indexOf(left) - IMPACT_KINDS.indexOf(right),
  );
}

function uniqueInOrder(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function canonicalPhysicalName(value: string): string {
  return value
    .split(".")
    .map((part) => part.trim().toLowerCase())
    .join(".");
}

function compareRelations(left: Relation, right: Relation): number {
  return (
    (left.providerOrdinal ?? Number.MAX_SAFE_INTEGER) -
      (right.providerOrdinal ?? Number.MAX_SAFE_INTEGER) ||
    left.relationId.localeCompare(right.relationId)
  );
}

function compareReadAssessments(
  left: ReadImpactValueAssessment,
  right: ReadImpactValueAssessment,
): number {
  return (
    (left.providerOrdinal ?? Number.MAX_SAFE_INTEGER) -
      (right.providerOrdinal ?? Number.MAX_SAFE_INTEGER) ||
    left.relationId.localeCompare(right.relationId)
  );
}

function compareStates(left: TraversalState, right: TraversalState): number {
  return (
    left.ref.localeCompare(right.ref) ||
    left.impacts.join(",").localeCompare(right.impacts.join(",")) ||
    left.certainty.localeCompare(right.certainty)
  );
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return resolve(value);
}

function main(): void {
  const response = parseProviderResponse(
    JSON.parse(readFileSync(argument("--input"), "utf8")),
  );
  if (!response.facts)
    throw new Error("assembled Provider response has no facts");
  const native = loadNativeLeafEvidence(
    response.facts,
    argument("--manifest"),
  ).statement;
  const report = buildImpactValueReport({ facts: response.facts, native });
  const output = resolvePocOutputPath(argument("--output"));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, canonicalJson(report), "utf8");
  process.stdout.write(
    canonicalJson({
      valueGate: report.valueGate,
      summary: report.summary,
      limits: report.limits,
    }),
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
