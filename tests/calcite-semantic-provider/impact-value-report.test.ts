import { describe, expect, it } from "vitest";
import type {
  CandidateTaskSemanticFacts,
  EvaluationStatus,
  ImpactKind,
  MappingStatus,
} from "../../scripts/calcite-semantic-provider/contract.ts";
import type { NativeStatementEvidence } from "../../scripts/calcite-semantic-provider/evidence-adapter.ts";
import { buildImpactValueReport } from "../../scripts/calcite-semantic-provider/impact-value-report.ts";

interface SourceSpec {
  readonly relationId: string;
  readonly fieldId: string;
  readonly ordinal: number;
  readonly table: string;
}

interface DependencySpec {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly impact: ImpactKind;
  readonly evaluationStatus?: EvaluationStatus;
  readonly mappingStatus?: MappingStatus;
}

function graphFixture(input: {
  readonly sources: readonly SourceSpec[];
  readonly dependencies: readonly DependencySpec[];
}): {
  readonly facts: CandidateTaskSemanticFacts;
  readonly native: NativeStatementEvidence;
} {
  const rootRelationId = "rel:root";
  const rootFieldId = "field:root";
  const intermediateRefs = new Set(
    input.dependencies
      .flatMap((dependency) => [dependency.from, dependency.to])
      .filter((ref) => ref.startsWith("field:mid:")),
  );
  const relations: CandidateTaskSemanticFacts["relations"] = [
    {
      relationId: rootRelationId,
      kind: "PROJECT" as const,
      inputRelationIds: [],
      outputFieldIds: [rootFieldId],
      providerOrdinal: 0,
    },
    ...input.sources.map((source) => ({
      relationId: source.relationId,
      kind: "TABLE_SCAN" as const,
      inputRelationIds: [],
      outputFieldIds: [source.fieldId],
      qualifiedTableName: source.table,
      providerOrdinal: source.ordinal,
    })),
    ...[...intermediateRefs].map((fieldId, index) => ({
      relationId: `rel:mid:${index}`,
      kind: "PROJECT" as const,
      inputRelationIds: [],
      outputFieldIds: [fieldId],
      providerOrdinal: 100 + index,
    })),
  ].sort((left, right) => left.relationId.localeCompare(right.relationId));
  const fields: CandidateTaskSemanticFacts["fields"] = [
    {
      fieldId: rootFieldId,
      relationId: rootRelationId,
      role: "OUTPUT" as const,
      slot: 0,
      name: "result",
      typeName: "INTEGER",
      nullable: true,
    },
    ...input.sources.map((source) => ({
      fieldId: source.fieldId,
      relationId: source.relationId,
      role: "OUTPUT" as const,
      slot: 0,
      name: "value",
      typeName: "INTEGER",
      nullable: true,
      physicalFieldId: `physical:${source.table}.value`,
    })),
    ...[...intermediateRefs].map((fieldId, index) => ({
      fieldId,
      relationId: `rel:mid:${index}`,
      role: "OUTPUT" as const,
      slot: 0,
      name: `mid_${index}`,
      typeName: "INTEGER",
      nullable: true,
    })),
  ].sort((left, right) => left.fieldId.localeCompare(right.fieldId));
  const dependencies: CandidateTaskSemanticFacts["dependencies"] =
    input.dependencies
      .map((dependency) => ({
        dependencyId: dependency.id,
        dependencyKind:
          dependency.impact === "FIELD_VALUE"
            ? ("VALUE_INPUT" as const)
            : ("FILTER_PREDICATE" as const),
        impactKind: dependency.impact,
        operatorId: `op:${dependency.id}`,
        fromRefs: [dependency.from],
        toRefs: [dependency.to],
        evaluationStatus: dependency.evaluationStatus ?? "EVALUATED",
        evidenceMappingRefs: [`mapping:${dependency.id}`],
        issueRefs: [],
      }))
      .sort((left, right) =>
        left.dependencyId.localeCompare(right.dependencyId),
      );
  const evidenceMappings: CandidateTaskSemanticFacts["evidenceMappings"] =
    input.dependencies
      .map((dependency) => ({
        mappingId: `mapping:${dependency.id}`,
        providerRefId: dependency.id,
        ...(dependency.mappingStatus === "EXACT" ||
        dependency.mappingStatus === undefined
          ? { nativeRefId: `native:${dependency.id}` }
          : {}),
        mappingStatus: dependency.mappingStatus ?? "EXACT",
        evidenceRefs:
          dependency.mappingStatus === "EXACT" ||
          dependency.mappingStatus === undefined
            ? [`evidence:${dependency.id}`]
            : [],
      }))
      .sort((left, right) => left.mappingId.localeCompare(right.mappingId));
  return {
    facts: {
      schemaVersion: "0.1.0-poc",
      provider: {
        name: "calcite-semantic-provider",
        calciteVersion: "1.42.0",
        adapterVersion: "test",
        buildFingerprint: "0".repeat(64),
      },
      input: {
        sqlSourceId: "slot:test",
        statementOrdinal: 0,
        sqlSha256: "1".repeat(64),
        schemaSha256: "2".repeat(64),
        dialectDigest: "3".repeat(64),
      },
      statementStatus: "SUCCESS",
      capabilities: [],
      relations,
      fields,
      operators: input.dependencies
        .map((dependency) => ({
          operatorId: `op:${dependency.id}`,
          kind: "PROJECT" as const,
          relationId: rootRelationId,
          inputRelationIds: [],
        }))
        .sort((left, right) => left.operatorId.localeCompare(right.operatorId)),
      dependencies,
      metadata: [],
      evidenceMappings,
      issues: [],
    },
    native: {
      sqlSourceId: "slot:test",
      statementOrdinal: 0,
      sqlSha256: "1".repeat(64),
      relations: input.sources.map((source) => ({
        providerRelationOrdinal: source.ordinal,
        nativeRelationOccurrenceId: `native:${source.relationId}`,
        qualifiedPhysicalTable: source.table,
        sourceSpan: {
          start: source.ordinal * 10,
          end: source.ordinal * 10 + 5,
        },
        evidenceRefs: [`machine-facts:${source.relationId}`],
        fields: [
          {
            slot: 0,
            nativeFieldOccurrenceId: `native:${source.fieldId}`,
            physicalFieldId: `physical:${source.table}.value`,
            sourceSpan: {
              start: source.ordinal * 10,
              end: source.ordinal * 10 + 5,
            },
            evidenceRefs: [`machine-facts:${source.relationId}`],
          },
        ],
      })),
    },
  };
}

const sourceA: SourceSpec = {
  relationId: "rel:scan:a",
  fieldId: "field:scan:a",
  ordinal: 1,
  table: "demo.a",
};

describe("Calcite indirect-impact value report", () => {
  it("keeps a pure FIELD_VALUE path as the value-lineage baseline", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:direct",
          from: sourceA.fieldId,
          to: "field:root",
          impact: "FIELD_VALUE",
        },
      ],
    });

    const report = buildImpactValueReport(fixture);

    expect(report.summary.directFieldValueReadCount).toBe(1);
    expect(report.summary.indirectOnlyReadCount).toBe(0);
    expect(report.reads[0]?.status).toBe("DIRECT_AND_OR_INDIRECT");
    expect(report.reads[0]?.directFieldValueWitness?.dependencyIds).toEqual([
      "dep:direct",
    ]);
    expect(report.valueGate.decision).toBe("NO_GO");
  });

  it("proves an indirect-only read through a composed Calcite impact path", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:value",
          from: sourceA.fieldId,
          to: "field:mid:0",
          impact: "FIELD_VALUE",
        },
        {
          id: "dep:filter",
          from: "field:mid:0",
          to: "field:root",
          impact: "ROW_MEMBERSHIP",
        },
      ],
    });

    const report = buildImpactValueReport(fixture);
    const read = report.reads[0];

    expect(read?.status).toBe("INDIRECT_ONLY");
    expect(read?.directFieldValueWitness).toBeUndefined();
    expect(read?.indirectWitnesses).toHaveLength(1);
    expect(read?.indirectWitnesses[0]).toMatchObject({
      channel: "ROW_MEMBERSHIP",
      dependencyIds: ["dep:value", "dep:filter"],
      coordinateSystem: "CALCITE_VALIDATED_PLAN",
      operatorSourceSpanStatus: "NOT_ASSEMBLED",
    });
    expect(report.summary.calciteAddedReadCount).toBe(1);
    expect(report.valueGate.decision).toBe(
      "CALCITE_INDIRECT_IMPACT_VALUE_PROVEN",
    );
  });

  it("retains a confirmed path and also exposes an uncertain alternative gap", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:confirmed",
          from: sourceA.fieldId,
          to: "field:root",
          impact: "FIELD_VALUE",
        },
        {
          id: "dep:unknown",
          from: sourceA.fieldId,
          to: "field:root",
          impact: "FIELD_VALUE",
          mappingStatus: "UNMAPPABLE",
        },
      ],
    });

    const report = buildImpactValueReport(fixture);

    expect(report.reads[0]?.status).toBe("DIRECT_AND_OR_INDIRECT");
    expect(report.reads[0]?.directFieldValueWitness).toBeDefined();
    expect(report.reads[0]?.gapRefs.length).toBeGreaterThan(0);
    expect(report.gaps.map((gap) => gap.code)).toContain(
      "EVIDENCE_MAPPING_NOT_EXACT",
    );
  });

  it("returns UNKNOWN when the only root path is not exactly mapped", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:unknown",
          from: sourceA.fieldId,
          to: "field:root",
          impact: "ROW_MEMBERSHIP",
          mappingStatus: "UNMAPPABLE",
        },
      ],
    });

    const report = buildImpactValueReport(fixture);

    expect(report.reads[0]?.status).toBe("UNKNOWN");
    expect(report.reads[0]?.indirectWitnesses).toEqual([]);
    expect(report.valueGate.decision).toBe("NO_GO");
  });

  it("fails closed when Native statement identity does not match", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:direct",
          from: sourceA.fieldId,
          to: "field:root",
          impact: "FIELD_VALUE",
        },
      ],
    });

    const report = buildImpactValueReport({
      ...fixture,
      native: { ...fixture.native, sqlSha256: "9".repeat(64) },
    });

    expect(report.reads[0]?.status).toBe("UNKNOWN");
    expect(report.gaps.map((gap) => gap.code)).toContain(
      "NATIVE_STATEMENT_IDENTITY_MISMATCH",
    );
  });

  it("turns traversal budget exhaustion into UNKNOWN", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:first",
          from: sourceA.fieldId,
          to: "field:mid:0",
          impact: "FIELD_VALUE",
        },
        {
          id: "dep:second",
          from: "field:mid:0",
          to: "field:root",
          impact: "ROW_MEMBERSHIP",
        },
      ],
    });

    const report = buildImpactValueReport({
      ...fixture,
      limits: { maxDepth: 1, maxStatesPerSource: 100 },
    });

    expect(report.reads[0]?.status).toBe("UNKNOWN");
    expect(report.gaps.map((gap) => gap.code)).toContain("MAX_DEPTH_REACHED");
  });

  it("keeps an unobserved source as NOT_REACHED instead of unrelated", () => {
    const fixture = graphFixture({ sources: [sourceA], dependencies: [] });

    const report = buildImpactValueReport(fixture);

    expect(report.reads[0]?.status).toBe("NOT_REACHED");
    expect(JSON.stringify(report)).not.toContain("PROVEN_UNRELATED");
  });

  it("produces a deterministic plan witness digest", () => {
    const fixture = graphFixture({
      sources: [sourceA],
      dependencies: [
        {
          id: "dep:indirect",
          from: sourceA.fieldId,
          to: "field:root",
          impact: "RELATION_EXISTENCE",
        },
      ],
    });

    const first = buildImpactValueReport(fixture);
    const second = buildImpactValueReport(fixture);

    expect(first.reads[0]?.indirectWitnesses[0]?.planWitnessSha256).toBe(
      second.reads[0]?.indirectWitnesses[0]?.planWitnessSha256,
    );
  });
});
