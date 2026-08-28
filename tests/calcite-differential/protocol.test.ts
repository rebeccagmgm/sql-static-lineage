import { describe, expect, it } from "vitest";
import {
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
  DIFFERENTIAL_HARD_LIMITS,
  DIFFERENTIAL_REQUEST_KINDS,
  makeDifferentialFingerprint,
  parseDifferentialJson,
  requestFingerprint,
  serializeDifferentialRequest,
  serializeDifferentialResponse,
  validateDifferentialRequest,
  validateDifferentialResponse,
  type DifferentialResponse,
  type PlanFactsRelRequest,
  type RawSqlDifferentialRequest,
} from "../../scripts/calcite-differential/protocol.ts";
import {
  CALCITE_DIFFERENTIAL_PROTOCOL_VERSION as LEGACY_PROTOCOL_VERSION,
  DIFFERENTIAL_REQUEST_KINDS as LEGACY_REQUEST_KINDS,
} from "../../scripts/calcite-oracle/protocol.ts";
import {
  reconcileDifferential,
  reconcileDifferentialResponse,
} from "../../scripts/calcite-differential/reconciler.ts";
import {
  reconcileDifferential as reconcileLegacyDifferential,
} from "../../scripts/calcite-oracle/reconciler.ts";
import { PLAN_FACTS_REL_GRAPH_VERSION } from "../../scripts/calcite-differential/plan-facts-rel-contract.ts";

type RawRequestBody = Omit<RawSqlDifferentialRequest, "fingerprint">;

function rawRequest(overrides: Partial<RawRequestBody> = {}): RawSqlDifferentialRequest {
  const body: RawRequestBody = {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: "RAW_SQL_V1",
    sql: "SELECT 1",
    schema: {
      tables: [
        {
          name: "dual",
          columns: [{ name: "value", type: "INTEGER", nullable: false }],
        },
      ],
    },
    ...overrides,
  };
  return { ...body, fingerprint: requestFingerprint(body) };
}

function planFactsRequest(
  overrides: Partial<Omit<PlanFactsRelRequest, "fingerprint">> = {},
): PlanFactsRelRequest {
  const body: Omit<PlanFactsRelRequest, "fingerprint"> = {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: "PLAN_FACTS_REL_V1",
    graphVersion: PLAN_FACTS_REL_GRAPH_VERSION,
    taskId: "task-1",
    statementId: "statement-1",
    schema: { tables: [] },
    relations: [],
    roots: [],
    mappings: [],
    ...overrides,
  };
  return { ...body, fingerprint: requestFingerprint(body) };
}

function response(overrides: Partial<DifferentialResponse> = {}): DifferentialResponse {
  const request = rawRequest();
  return {
    protocolVersion: CALCITE_DIFFERENTIAL_PROTOCOL_VERSION,
    requestKind: request.requestKind,
    status: "SUCCESS",
    fingerprint: makeDifferentialFingerprint(request.fingerprint),
    issues: [],
    mappingRefs: [
      {
        mappingId: "mapping-1",
        nativeRelationId: "native-rel-1",
        nativeRelationOccurrenceId: "native-occ-1",
        evidenceRefs: ["evidence-1"],
      },
    ],
    observations: [
      {
        observationId: "observation-1",
        kind: "predicates",
        status: "EVALUATED",
        mappingRefs: ["mapping-1"],
        evidenceRefs: ["evidence-1"],
        values: [{ predicate: "value > 0" }],
      },
    ],
    ...overrides,
  };
}

describe("Calcite differential protocol", () => {
  it("rejects malformed JSON and invalid UTF-8", () => {
    expect(parseDifferentialJson("{").issues[0]?.code).toBe("MALFORMED_JSON");
    expect(parseDifferentialJson(new Uint8Array([0xff, 0xfe])).issues[0]?.code).toBe(
      "MALFORMED_JSON",
    );
  });

  it("rejects protocol versions and request kinds outside the versioned contract", () => {
    const badVersion = { ...rawRequest(), protocolVersion: 2 };
    expect(validateDifferentialRequest(badVersion).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PROTOCOL_VERSION_MISMATCH" }),
      ]),
    );

    const badKindBody = {
      ...rawRequest(),
      requestKind: "UNSUPPORTED_V1",
    } as unknown as Record<string, unknown>;
    badKindBody.fingerprint = requestFingerprint(badKindBody);
    expect(validateDifferentialRequest(badKindBody).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_REQUEST_KIND" }),
      ]),
    );
  });

  it("requires the declared request fingerprint to match the deterministic content hash", () => {
    const valid = rawRequest();
    expect(validateDifferentialRequest(valid).valid).toBe(true);
    expect(
      validateDifferentialRequest({ ...valid, fingerprint: "not-the-hash" }).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "REQUEST_FINGERPRINT_MISMATCH" }),
      ]),
    );
  });

  it("rejects invalid and over-hard-cap resource limits", () => {
    const invalid = rawRequest({ limits: { maxPlanNodes: 0 } });
    expect(validateDifferentialRequest(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "LIMIT_INVALID" })]),
    );

    const tooLarge = rawRequest({
      limits: { maxInputBytes: DIFFERENTIAL_HARD_LIMITS.maxInputBytes + 1 },
    });
    expect(validateDifferentialRequest(tooLarge).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LIMIT_EXCEEDS_HARD_CAP" }),
      ]),
    );
  });

  it("rejects duplicate mappings and SQL fallback on the Plan Facts lane", () => {
    const duplicate = planFactsRequest({
      mappings: [
        {
          mappingId: "duplicate",
          nativeRelationId: "rel-1",
          nativeRelationOccurrenceId: "occ-1",
          evidenceRefs: [],
        },
        {
          mappingId: "duplicate",
          nativeRelationId: "rel-2",
          nativeRelationOccurrenceId: "occ-2",
          evidenceRefs: [],
        },
      ],
    });
    expect(validateDifferentialRequest(duplicate).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MAPPING_ID_DUPLICATE" }),
      ]),
    );

    const withSql = planFactsRequest() as unknown as Record<string, unknown>;
    withSql.sql = "SELECT 1";
    withSql.fingerprint = requestFingerprint(withSql);
    expect(validateDifferentialRequest(withSql).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SQL_STRING_FALLBACK_FORBIDDEN" }),
      ]),
    );
  });

  it("applies the complete relational contract at the protocol boundary", () => {
    const malformed = planFactsRequest({
      relations: [
        {
          kind: "READ",
          nodeId: "read-1",
          nativeRelationId: "native-read-1",
          nativeRelationOccurrenceId: "occurrence-1",
          mappingId: "",
          evidenceRefs: [],
          table: { name: "source" },
          outputFields: [
            {
              ordinal: 0,
              name: "id",
              type: { status: "CONCRETE", name: "ANY", nullable: false },
              mappingId: "",
              evidenceRefs: [],
            },
          ],
        },
      ],
      roots: ["missing-root"],
    });

    expect(validateDifferentialRequest(malformed).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MAPPING_ID_MISSING" }),
        expect.objectContaining({ code: "EVIDENCE_REFS_MISSING" }),
        expect.objectContaining({ code: "TYPE_NOT_CONCRETE" }),
        expect.objectContaining({ code: "ROOT_NODE_DANGLING" }),
      ]),
    );
  });

  it("rejects unknown nested relation and expression kinds", () => {
    const invalid = planFactsRequest({
      relations: [
        {
          kind: "EVIL_RELATION",
          nodeId: "bad-1",
          nativeRelationId: "native-bad-1",
          mappingId: "mapping-bad-1",
          evidenceRefs: ["evidence-bad-1"],
          outputFields: [],
          inputNodeId: "bad-project",
        } as unknown as PlanFactsRelRequest["relations"][number],
        {
          kind: "PROJECT",
          nodeId: "bad-project",
          nativeRelationId: "native-bad-project",
          mappingId: "mapping-bad-project",
          evidenceRefs: ["evidence-bad-project"],
          outputFields: [],
          inputNodeId: "bad-1",
          expressions: [
            {
              kind: "EVIL_EXPRESSION",
              expressionId: "bad-expression-1",
              mappingId: "mapping-bad-expression-1",
              evidenceRefs: ["evidence-bad-expression-1"],
              type: { status: "CONCRETE", name: "INTEGER", nullable: false },
            },
          ],
        } as unknown as PlanFactsRelRequest["relations"][number],
      ],
      roots: ["bad-project"],
    });

    expect(validateDifferentialRequest(invalid).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "RELATION_KIND_INVALID" }),
        expect.objectContaining({ code: "EXPRESSION_KIND_INVALID" }),
      ]),
    );
  });

  it("requires stable graph ownership and exact graph-to-mapping bindings", () => {
    const relation = {
      kind: "READ" as const,
      nodeId: "read-1",
      nativeRelationId: "native-read-1",
      nativeRelationOccurrenceId: "occurrence-1",
      mappingId: "mapping-read-1",
      evidenceRefs: ["evidence-read-1"],
      table: { name: "source" },
      outputFields: [
        {
          ordinal: 0,
          name: "id",
          type: { status: "CONCRETE" as const, name: "INTEGER", nullable: false },
          mappingId: "mapping-field-1",
          evidenceRefs: ["evidence-field-1"],
        },
      ],
    };
    const unbound = planFactsRequest({
      relations: [relation],
      roots: [relation.nodeId],
      mappings: [],
    });
    expect(validateDifferentialRequest(unbound).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "GRAPH_MAPPING_REF_UNKNOWN" }),
      ]),
    );

    const mismatched = planFactsRequest({
      relations: [relation],
      roots: [relation.nodeId],
      mappings: [
        {
          mappingId: "mapping-read-1",
          nativeRelationId: "another-relation",
          nativeRelationOccurrenceId: "another-occurrence",
          evidenceRefs: ["evidence-read-1"],
        },
        {
          mappingId: "mapping-field-1",
          nativeRelationId: "native-read-1",
          nativeRelationOccurrenceId: "occurrence-1",
          nativeOutputOrdinal: 9,
          evidenceRefs: ["evidence-field-1"],
        },
      ],
    });
    expect(validateDifferentialRequest(mismatched).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "GRAPH_MAPPING_RELATION_MISMATCH" }),
        expect.objectContaining({ code: "GRAPH_MAPPING_OCCURRENCE_MISMATCH" }),
        expect.objectContaining({ code: "GRAPH_MAPPING_OUTPUT_ORDINAL_MISMATCH" }),
      ]),
    );
  });

  it("validates response structure, mapping/evidence references, and output hard limits", () => {
    const valid = response();
    expect(validateDifferentialResponse(valid).valid).toBe(true);

    const conclusionFromCalcite = response({
      observations: [
        {
          ...valid.observations[0]!,
          status: "CALCITE_CORROBORATED",
        } as unknown as (typeof valid.observations)[number],
      ],
    });
    expect(validateDifferentialResponse(conclusionFromCalcite).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OBSERVATION_STATUS_INVALID" }),
      ]),
    );

    const dangling = response({
      observations: [
        {
          ...valid.observations[0]!,
          mappingRefs: ["missing-mapping"],
          evidenceRefs: ["missing-evidence"],
        },
      ],
    });
    expect(validateDifferentialResponse(dangling).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MAPPING_REF_UNKNOWN" }),
        expect.objectContaining({ code: "EVIDENCE_REF_UNBOUND" }),
      ]),
    );

    expect(validateDifferentialResponse(valid, { maxMappingRefs: 0 }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "LIMIT_INVALID" })]),
    );
    expect(validateDifferentialResponse(valid, { maxMappingRefs: 0 }).valid).toBe(false);
    expect(validateDifferentialResponse(valid, { maxOutputItems: 1 }).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OUTPUT_ITEMS_LIMIT_EXCEEDED" }),
      ]),
    );
    expect(validateDifferentialResponse(valid, { maxOutputBytes: 10 }).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OUTPUT_LIMIT_EXCEEDED" }),
      ]),
    );
    expect(() => serializeDifferentialResponse(valid, { maxOutputBytes: 10 })).toThrow(
      "Differential response validation failed",
    );
  });

  it("serializes the same request deterministically regardless of object insertion order", () => {
    const request = rawRequest();
    const reordered = {
      schema: request.schema,
      sql: request.sql,
      fingerprint: request.fingerprint,
      requestKind: request.requestKind,
      protocolVersion: request.protocolVersion,
    } satisfies RawSqlDifferentialRequest;
    expect(serializeDifferentialRequest(reordered)).toBe(
      serializeDifferentialRequest(request),
    );
    expect(DIFFERENTIAL_REQUEST_KINDS).toEqual(["RAW_SQL_V1", "PLAN_FACTS_REL_V1"]);
  });

  it("keeps conservative reconciliation statuses and old imports working", () => {
    const valid = response();
    const exact = {
      evaluated: true,
      values: [{ value: 1 }],
      mappingRefs: ["mapping-1"],
      evidenceRefs: ["evidence-1"],
    } as const;
    const result = reconcileDifferential({
      native: {
        predicates: exact,
        uniqueKeys: { evaluated: true, values: [{ key: "id" }] },
        rowCountCardinality: {
          evaluated: true,
          values: [{ count: 1 }],
          mappingRefs: ["mapping-1"],
          evidenceRefs: ["evidence-1"],
        },
      },
      calcite: {
        predicates: exact,
        tableOccurrences: { evaluated: true, values: [{ occurrence: "calcite-only" }] },
        rowCountCardinality: {
          evaluated: true,
          values: [{ count: 2 }],
          mappingRefs: ["mapping-1"],
          evidenceRefs: ["evidence-1"],
        },
      },
    });
    expect(result.results.find((item) => item.kind === "predicates")?.status).toBe(
      "CALCITE_CORROBORATED",
    );
    expect(result.results.find((item) => item.kind === "uniqueKeys")?.status).toBe(
      "NATIVE_ONLY",
    );
    expect(result.results.find((item) => item.kind === "tableOccurrences")?.status).toBe(
      "CALCITE_ONLY_UNMAPPABLE",
    );
    expect(result.results.find((item) => item.kind === "rowCountCardinality")?.status).toBe(
      "SEMANTIC_ENGINE_CONFLICT",
    );

    const exchanged = reconcileDifferential({
      native: {
        predicates: {
          evaluated: true,
          values: [{ mapping: "m1", value: "left" }, { mapping: "m2", value: "right" }],
          mappingRefs: ["m1", "m2"],
          evidenceRefs: ["e1", "e2"],
        },
      },
      calcite: {
        predicates: {
          evaluated: true,
          values: [{ mapping: "m1", value: "right" }, { mapping: "m2", value: "left" }],
          mappingRefs: ["m1", "m2"],
          evidenceRefs: ["e1", "e2"],
        },
      },
    });
    expect(exchanged.results.find((item) => item.kind === "predicates")?.status).toBe(
      "CALCITE_ONLY_UNMAPPABLE",
    );

    const multiMappingResponse = response({
      mappingRefs: [
        ...valid.mappingRefs,
        {
          mappingId: "mapping-2",
          nativeRelationId: "native-rel-2",
          nativeRelationOccurrenceId: "native-occ-2",
          evidenceRefs: ["evidence-2"],
        },
      ],
      observations: [
        valid.observations[0]!,
        {
          ...valid.observations[0]!,
          observationId: "observation-2",
          mappingRefs: ["mapping-2"],
          evidenceRefs: ["evidence-2"],
          values: [{ predicate: "value < 0" }],
        },
      ],
    });
    expect(validateDifferentialResponse(multiMappingResponse).valid).toBe(true);
    expect(
      reconcileDifferentialResponse(
        {
          predicates: {
            evaluated: true,
            values: [{ predicate: "value > 0" }, { predicate: "value < 0" }],
            mappingRefs: ["mapping-1", "mapping-2"],
            evidenceRefs: ["evidence-1", "evidence-2"],
          },
        },
        multiMappingResponse,
      ).results.find((item) => item.kind === "predicates")?.status,
    ).toBe("CALCITE_ONLY_UNMAPPABLE");
    expect(LEGACY_PROTOCOL_VERSION).toBe(CALCITE_DIFFERENTIAL_PROTOCOL_VERSION);
    expect(LEGACY_REQUEST_KINDS).toEqual(DIFFERENTIAL_REQUEST_KINDS);

    const legacy = reconcileLegacyDifferential({
      native: { predicates: { evaluated: true, values: [{ value: 1 }] } },
      calcite: { predicates: { evaluated: true, values: [{ value: 1 }] } },
    });
    expect(legacy.results.find((item) => item.kind === "predicates")?.status).toBe(
      "AGREED",
    );
  });
});
