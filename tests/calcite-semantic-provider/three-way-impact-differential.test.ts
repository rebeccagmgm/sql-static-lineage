import { describe, expect, it } from "vitest";
import type { CalciteImpactValueReport } from "../../scripts/calcite-semantic-provider/impact-value-report.ts";
import { sha256 } from "../../scripts/machine-facts/machine-facts-contract.ts";
import {
  buildThreeWayCaseReport,
  buildThreeWayDifferentialReport,
  type ThreeWayCaseInput,
} from "../../scripts/calcite-semantic-provider/three-way-impact-differential.ts";

const ROOT_SQL = "SELECT a.value FROM demo.a a";
const SQL_SHA = sha256(ROOT_SQL);
const ROOT_STATEMENT = "task:100:slot:query:statement:0";
const ROOT_NODE = "field-node:root";

interface ReadSpec {
  readonly id: string;
  readonly table: string;
  readonly binding: string;
  readonly start: number;
  readonly explicitOccurrence?: boolean;
}

function baseInput(input: {
  readonly reads: readonly ReadSpec[];
  readonly artifactStatus?: "COMPLETE" | "PARTIAL";
  readonly valueTables?: readonly string[];
  readonly controls?: readonly Record<string, unknown>[];
  readonly operatorRelations?: readonly Record<string, unknown>[];
  readonly relationEdges?: readonly Record<string, unknown>[];
  readonly calcite?: CalciteImpactValueReport;
  readonly calciteUnavailable?: string;
}): ThreeWayCaseInput {
  const sourceNodes = (input.valueTables ?? []).map((table, index) => ({
    nodeId: `field-source:${index}`,
    taskId: "100",
    field: {
      qualifiedName: table,
      column: `value_${index}`,
    },
  }));
  const fieldLineage = {
    overallStatus: input.artifactStatus ?? "COMPLETE",
    request: {
      rootWriteObservationIds: ["write:100:0"],
    },
    rootNodeIds: [ROOT_NODE],
    nodes: [
      { nodeId: ROOT_NODE, taskId: "100", evidenceStatus: "CONFIRMED" },
      ...sourceNodes,
    ],
    edges: sourceNodes.map((node, index) => ({
      edgeId: `value-edge:${index}`,
      fromNodeId: node.nodeId,
      toNodeId: ROOT_NODE,
      consumerTaskId: "100",
      producerTaskId: null,
      kind: "VALUE_FLOW",
      evidenceStatus: "CONFIRMED",
      evidenceRefs: [`native:value:${index}`],
    })),
    rowsetControls: input.controls ?? [],
  };
  const readRelations = input.reads.map((read) => ({
    relation_id: read.id,
    relation_type: "read",
    statement_id: ROOT_STATEMENT,
    source_span: { start: read.start, end: read.start + read.table.length },
    relation: {
      id: read.id,
      type: "read",
      table: read.table,
      binding: read.binding,
      ...(read.explicitOccurrence === false
        ? {}
        : { read_occurrence_id: read.id }),
      span: { start: read.start, end: read.start + read.table.length },
    },
  }));
  return {
    taskId: "100",
    fieldLineage,
    relationNodes: [...readRelations, ...(input.operatorRelations ?? [])],
    relationEdges: input.relationEdges ?? [],
    outputBindings: [
      {
        task_id: "100",
        write_observation_id: "write:100:0",
        statement_id: ROOT_STATEMENT,
      },
    ],
    statements: [
      {
        statement_id: ROOT_STATEMENT,
        raw_sql: ROOT_SQL,
      },
    ],
    sourceArtifact: { sql_sha256: "9".repeat(64) },
    ...(input.calcite
      ? {
          calcite: {
            report: input.calcite,
            originalSqlSha256: SQL_SHA,
          },
        }
      : {}),
    ...(input.calciteUnavailable
      ? { calciteNotEvaluated: { reasonCode: input.calciteUnavailable } }
      : {}),
  };
}

function calciteReport(
  reads: readonly {
    readonly occurrenceId: string;
    readonly relationId: string;
    readonly table: string;
    readonly direct?: boolean;
    readonly indirect?: readonly string[];
    readonly status?:
      "DIRECT_AND_OR_INDIRECT" | "INDIRECT_ONLY" | "NOT_REACHED" | "UNKNOWN";
  }[],
): CalciteImpactValueReport {
  const witness = (input: {
    occurrenceId: string;
    relationId: string;
    channel: string;
  }) => ({
    channel: input.channel,
    coordinateSystem: "CALCITE_VALIDATED_PLAN",
    operatorSourceSpanStatus: "NOT_ASSEMBLED",
    certainty: "CONFIRMED",
    nativeRelationOccurrenceId: input.occurrenceId,
    sourceRef: input.relationId,
    targetRef: "rel:root",
    dependencyIds: [`dep:${input.occurrenceId}:${input.channel}`],
    operatorIds: [`op:${input.occurrenceId}`],
    evidenceMappingRefs: [`mapping:${input.occurrenceId}`],
    evidenceRefs: [`native:${input.occurrenceId}`],
    depth: 2,
    planWitnessSha256: `${input.occurrenceId}:${input.channel}`
      .padEnd(64, "0")
      .slice(0, 64),
  });
  return {
    reportVersion: 1,
    reportKind: "CALCITE_INDIRECT_IMPACT_VALUE_GATE",
    productionProviderDecision: "VALIDATION_ONLY",
    safety: {
      canonicalArtifactsWritten: false,
      nativeSemanticFallback: false,
      productionIntegrationPerformed: false,
      provenUnrelatedEnabled: false,
    },
    input: {
      sqlSourceId: ROOT_STATEMENT,
      statementOrdinal: 0,
      sqlSha256: "2".repeat(64),
      schemaSha256: "3".repeat(64),
      dialectDigest: "4".repeat(64),
    },
    provider: {
      name: "calcite-semantic-provider",
      calciteVersion: "1.42.0",
      adapterVersion: "test",
      buildFingerprint: "5".repeat(64),
    },
    root: { status: "EXACT", relationId: "rel:root", providerOrdinal: 0 },
    valueGate: {
      decision: reads.some((read) => (read.indirect?.length ?? 0) > 0)
        ? "CALCITE_INDIRECT_IMPACT_VALUE_PROVEN"
        : "NO_GO",
      criterion: "AT_LEAST_ONE_EXACT_INDIRECT_ONLY_NATIVE_READ",
      exactIndirectOnlyReadCount: reads.filter(
        (read) => !read.direct && (read.indirect?.length ?? 0) > 0,
      ).length,
    },
    summary: {
      tableScanCount: reads.length,
      exactNativeReadCount: reads.length,
      reachedReadCount: reads.filter(
        (read) => read.status !== "NOT_REACHED" && read.status !== "UNKNOWN",
      ).length,
      directFieldValueReadCount: reads.filter((read) => read.direct).length,
      indirectImpactReadCount: reads.filter(
        (read) => (read.indirect?.length ?? 0) > 0,
      ).length,
      indirectOnlyReadCount: reads.filter(
        (read) => !read.direct && (read.indirect?.length ?? 0) > 0,
      ).length,
      calciteAddedReadCount: reads.filter(
        (read) => !read.direct && (read.indirect?.length ?? 0) > 0,
      ).length,
      notReachedReadCount: reads.filter((read) => read.status === "NOT_REACHED")
        .length,
      unknownReadCount: reads.filter((read) => read.status === "UNKNOWN")
        .length,
      impactChannelReadCounts: {
        FIELD_VALUE: reads.filter((read) => read.direct).length,
        EXPRESSION_CONTROL: 0,
        ROW_MEMBERSHIP: 0,
        NULL_EXTENSION: 0,
        MULTIPLICITY: 0,
        GROUPING: 0,
        SET_MEMBERSHIP: 0,
        WINDOW_EFFECT: 0,
        ORDER_SELECTION: 0,
        RELATION_EXISTENCE: 0,
      },
    },
    limits: {
      maxDepth: 32,
      maxStatesPerSource: 100,
      stateUpdates: 1,
      truncatedSourceCount: 0,
    },
    reads: reads.map((read) => ({
      relationId: read.relationId,
      qualifiedPhysicalTable: read.table,
      nativeRelationOccurrenceId: read.occurrenceId,
      nativeEvidenceRefs: [`native:${read.occurrenceId}`],
      status:
        read.status ??
        (read.direct
          ? "DIRECT_AND_OR_INDIRECT"
          : (read.indirect?.length ?? 0) > 0
            ? "INDIRECT_ONLY"
            : "NOT_REACHED"),
      ...(read.direct
        ? {
            directFieldValueWitness: witness({
              occurrenceId: read.occurrenceId,
              relationId: read.relationId,
              channel: "FIELD_VALUE",
            }) as never,
          }
        : {}),
      indirectWitnesses: (read.indirect ?? []).map((channel) =>
        witness({
          occurrenceId: read.occurrenceId,
          relationId: read.relationId,
          channel,
        }),
      ) as never,
      unknownRootPathObserved: read.status === "UNKNOWN",
      gapRefs: [],
    })),
    gaps: [],
  };
}

describe("occurrence-aligned Calcite/Native differential", () => {
  it("aligns a unique Native VALUE_FLOW occurrence with Calcite direct value", () => {
    const report = buildThreeWayCaseReport(
      baseInput({
        reads: [{ id: "read:a", table: "demo.a", binding: "a", start: 10 }],
        valueTables: ["demo.a"],
        calcite: calciteReport([
          {
            occurrenceId: "read:a",
            relationId: "rel:scan:a",
            table: "demo.a",
            direct: true,
          },
        ]),
      }),
    );

    expect(report.occurrences[0]).toMatchObject({
      fieldValue: { status: "CONFIRMED" },
      nativeIndirect: { status: "NOT_OBSERVED" },
      calcite: { status: "CONFIRMED", directFieldValue: true },
      overlapClass: "AC",
      calciteIncrementalValue: "NO",
    });
    expect(report.root.sqlSha256).toBe(SQL_SHA);
  });

  it("accepts only the Machine Facts trailing statement terminator normalization", () => {
    const input = baseInput({
      reads: [{ id: "read:a", table: "demo.a", binding: "a", start: 10 }],
      calcite: calciteReport([
        {
          occurrenceId: "read:a",
          relationId: "rel:scan:a",
          table: "demo.a",
          direct: true,
        },
      ]),
    });
    const report = buildThreeWayCaseReport({
      ...input,
      statements: [{ statement_id: ROOT_STATEMENT, raw_sql: `${ROOT_SQL}\n;` }],
    });

    expect(report.coverage.calciteEvaluationStatus).toBe("EVALUATED");
    expect(report.gaps.map((gap) => gap.code)).not.toContain(
      "CALCITE_INPUT_IDENTITY_MISMATCH",
    );
  });

  it("does not guess a VALUE_FLOW occurrence when the same table is read twice", () => {
    const report = buildThreeWayCaseReport(
      baseInput({
        reads: [
          { id: "read:b", table: "demo.lookup", binding: "b", start: 10 },
          { id: "read:c", table: "demo.lookup", binding: "c", start: 40 },
        ],
        valueTables: ["demo.lookup"],
      }),
    );

    expect(report.occurrences.map((item) => item.fieldValue.status)).toEqual([
      "UNKNOWN",
      "UNKNOWN",
    ]);
    expect(
      report.occurrences.every(
        (item) => item.fieldValue.coarseIdentityObserved,
      ),
    ).toBe(true);
    expect(report.coverage.fieldValueOccurrenceCoverageComplete).toBe(false);
    expect(report.gaps.map((gap) => gap.code)).toContain(
      "FIELD_VALUE_OCCURRENCE_AMBIGUOUS",
    );
  });

  it("uses the Native qualifier/binding to isolate one self-table control occurrence", () => {
    const controls = [
      {
        controlId: "control:join:b",
        nodeId: ROOT_NODE,
        relationId: "join:b",
        controlType: "join",
        evidenceStatus: "CONFIRMED",
        evidenceRefs: ["machine-facts:join:b"],
      },
    ];
    const operatorRelations = [
      {
        relation_id: "join:b",
        relation_type: "join",
        statement_id: ROOT_STATEMENT,
        relation: {
          condition_columns: [
            {
              qualifier: "b",
              physical: [{ table: "demo.lookup", column: "code" }],
            },
          ],
        },
      },
    ];
    const relationEdges = [
      {
        statement_id: ROOT_STATEMENT,
        from_relation_id: "read:b",
        to_relation_id: "join:b",
      },
      {
        statement_id: ROOT_STATEMENT,
        from_relation_id: "read:c",
        to_relation_id: "join:b",
      },
    ];
    const report = buildThreeWayCaseReport(
      baseInput({
        reads: [
          { id: "read:b", table: "demo.lookup", binding: "b", start: 10 },
          { id: "read:c", table: "demo.lookup", binding: "c", start: 40 },
        ],
        controls,
        operatorRelations,
        relationEdges,
        calcite: calciteReport([
          {
            occurrenceId: "read:b",
            relationId: "rel:scan:b",
            table: "demo.lookup",
            indirect: ["MULTIPLICITY"],
          },
          {
            occurrenceId: "read:c",
            relationId: "rel:scan:c",
            table: "demo.lookup",
            status: "NOT_REACHED",
          },
        ]),
      }),
    );

    expect(
      report.occurrences.find(
        (item) => item.occurrence.readOccurrenceId === "read:b",
      ),
    ).toMatchObject({
      nativeIndirect: { status: "CONFIRMED", controlTypes: ["join"] },
      calcite: { status: "CONFIRMED", indirectChannels: ["MULTIPLICITY"] },
      overlapClass: "BC",
      calciteIncrementalValue: "NO",
    });
    expect(
      report.occurrences.find(
        (item) => item.occurrence.readOccurrenceId === "read:c",
      )?.nativeIndirect.status,
    ).toBe("NOT_OBSERVED");
  });

  it("only proves Calcite net value when Native coverage is complete", () => {
    const read = { id: "read:a", table: "demo.a", binding: "a", start: 10 };
    const calcite = calciteReport([
      {
        occurrenceId: "read:a",
        relationId: "rel:scan:a",
        table: "demo.a",
        indirect: ["RELATION_EXISTENCE"],
      },
    ]);
    const complete = buildThreeWayCaseReport(
      baseInput({ reads: [read], calcite, artifactStatus: "COMPLETE" }),
    );
    const partial = buildThreeWayCaseReport(
      baseInput({ reads: [read], calcite, artifactStatus: "PARTIAL" }),
    );

    expect(complete.occurrences[0]?.calciteIncrementalValue).toBe(
      "PROVEN_OVER_CURRENT_ARTIFACTS",
    );
    expect(partial.occurrences[0]?.calciteIncrementalValue).toBe(
      "CANDIDATE_NATIVE_COVERAGE_INCOMPLETE",
    );
    expect(buildThreeWayDifferentialReport([complete]).decision).toBe(
      "CALCITE_NET_INCREMENTAL_VALUE_PROVEN",
    );
  });

  it("reports occurrence precision rather than net-new scope when Native kept the table coarsely", () => {
    const controls = [
      {
        controlId: "control:derived",
        nodeId: ROOT_NODE,
        relationId: "join:derived",
        controlType: "join",
        evidenceStatus: "CONFIRMED",
      },
    ];
    const report = buildThreeWayCaseReport(
      baseInput({
        reads: [
          { id: "read:b", table: "demo.lookup", binding: "b", start: 10 },
          { id: "read:c", table: "demo.lookup", binding: "c", start: 40 },
        ],
        controls,
        operatorRelations: [
          {
            relation_id: "join:derived",
            relation_type: "join",
            statement_id: ROOT_STATEMENT,
            relation: {
              condition_columns: [
                {
                  qualifier: "derived_lookup",
                  physical: [{ table: "demo.lookup", column: "code" }],
                },
              ],
            },
          },
        ],
        calcite: calciteReport([
          {
            occurrenceId: "read:b",
            relationId: "rel:scan:b",
            table: "demo.lookup",
            indirect: ["MULTIPLICITY"],
          },
          {
            occurrenceId: "read:c",
            relationId: "rel:scan:c",
            table: "demo.lookup",
            status: "NOT_REACHED",
          },
        ]),
      }),
    );

    const readB = report.occurrences.find(
      (item) => item.occurrence.readOccurrenceId === "read:b",
    );
    expect(readB?.nativeIndirect).toMatchObject({
      status: "UNKNOWN",
      coarseIdentityObserved: true,
    });
    expect(readB?.calciteIncrementalValue).toBe("OCCURRENCE_PRECISION_ONLY");
    expect(report.summary.calciteOnlyCount).toBe(0);
    expect(report.summary.calciteOccurrencePrecisionOnlyCount).toBe(1);
  });

  it("keeps an unavailable multi-source case as NOT_EVALUATED", () => {
    const report = buildThreeWayCaseReport(
      baseInput({
        reads: [{ id: "read:a", table: "demo.a", binding: "a", start: 10 }],
        calciteUnavailable: "CALCITE_SOURCE_MAP_REQUIRES_SINGLE_SQL_SOURCE",
      }),
    );

    expect(report.coverage).toMatchObject({
      calciteEvaluationStatus: "NOT_EVALUATED",
      calciteReasonCode: "CALCITE_SOURCE_MAP_REQUIRES_SINGLE_SQL_SOURCE",
    });
    expect(report.occurrences[0]?.calcite.status).toBe("NOT_EVALUATED");
    expect(JSON.stringify(report)).not.toContain("PROVEN_UNRELATED");
  });
});
