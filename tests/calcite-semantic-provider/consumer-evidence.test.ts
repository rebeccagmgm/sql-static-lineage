import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCandidateTaskSemanticFacts } from "../../scripts/calcite-semantic-provider/contract.ts";
import { semanticFactsQuery } from "../../scripts/calcite-semantic-provider/consumer.ts";
import {
  assembleNativeEvidence,
  type NativeStatementEvidence,
} from "../../scripts/calcite-semantic-provider/evidence-adapter.ts";

function validFacts() {
  const raw = JSON.parse(readFileSync(join(
    "tests", "fixtures", "calcite-semantic-provider", "valid.json",
  ), "utf8"));
  raw.relations[0].providerOrdinal = 0;
  raw.evidenceMappings = [{
    mappingId: "mapping:dep:0",
    providerRefId: "dep:0",
    mappingStatus: "NOT_ASSEMBLED",
    evidenceRefs: [],
  }];
  raw.dependencies[0].evidenceMappingRefs = ["mapping:dep:0"];
  raw.dependencies[0].issueRefs = ["issue:unmapped:dep:0"];
  raw.issues = [{
    issueId: "issue:unmapped:dep:0",
    code: "NATIVE_EVIDENCE_NOT_ASSEMBLED",
    message: "Provider-local semantic fact requires Native evidence assembly.",
    severity: "INFO",
    subjectRefs: ["dep:0"],
  }];
  raw.statementStatus = "PARTIAL";
  return parseCandidateTaskSemanticFacts(raw);
}

function nativeEvidence(facts = validFacts()): NativeStatementEvidence {
  return {
    sqlSourceId: facts.input.sqlSourceId,
    statementOrdinal: facts.input.statementOrdinal,
    sqlSha256: facts.input.sqlSha256,
    relations: [{
      providerRelationOrdinal: 0,
      nativeRelationOccurrenceId: "native:relation:read-0",
      sourceSpan: { start: 0, end: 30 },
      evidenceRefs: ["evidence:relation:read-0"],
      fields: [{
        slot: 0,
        nativeFieldOccurrenceId: "native:field:read-0:amount",
        sourceSpan: { start: 7, end: 13 },
        evidenceRefs: ["evidence:field:read-0:amount"],
      }],
    }],
  };
}

describe("thin semantic facts consumer", () => {
  it("queries provider-emitted facts without inferring SQL semantics", () => {
    const query = semanticFactsQuery(validFacts());
    expect(query.dependenciesByImpact("FIELD_VALUE").map((item) => item.dependencyId))
      .toEqual(["dep:0"]);
    expect(query.dependenciesByKind("VALUE_INPUT")).toHaveLength(1);
    expect(query.capabilityStatus("EXPRESSION_LINEAGE")?.evaluationStatus).toBe("EVALUATED");
  });

  it("assembles exact evidence only from matching statement, relation ordinal and field slot", () => {
    const facts = validFacts();
    const assembled = assembleNativeEvidence(facts, nativeEvidence(facts));
    expect(assembled.statementStatus).toBe("SUCCESS");
    expect(assembled.evidenceMappings).toEqual([
      expect.objectContaining({
        mappingId: "mapping:dep:0",
        mappingStatus: "EXACT",
        evidenceRefs: ["evidence:field:read-0:amount"],
      }),
    ]);
    expect(assembled.issues).toEqual([]);
    expect(() => parseCandidateTaskSemanticFacts(assembled)).not.toThrow();
  });

  it("does not merge duplicate/self-join relation occurrences", () => {
    const facts = validFacts();
    const native = nativeEvidence(facts);
    const ambiguous: NativeStatementEvidence = {
      ...native,
      relations: [native.relations[0]!, {
        ...native.relations[0]!,
        nativeRelationOccurrenceId: "native:relation:read-0-extra",
      }],
    };
    const assembled = assembleNativeEvidence(facts, ambiguous);
    expect(assembled.statementStatus).toBe("PARTIAL");
    expect(assembled.evidenceMappings[0]?.mappingStatus).toBe("AMBIGUOUS");
    expect(assembled.issues.some((item) => item.code === "NATIVE_OCCURRENCE_AMBIGUOUS")).toBe(true);
  });

  it("does not fabricate one bounding source span from disjoint Native evidence", () => {
    const facts = validFacts();
    const secondRelation = {
      ...facts.relations[0]!,
      relationId: "rel:1",
      providerOrdinal: 1,
      outputFieldIds: ["field:1"],
    };
    const assembled = assembleNativeEvidence({
      ...facts,
      relations: [...facts.relations, secondRelation],
      fields: [...facts.fields, {
        ...facts.fields[0]!,
        fieldId: "field:1",
        relationId: "rel:1",
      }],
      dependencies: facts.dependencies.map((dependency) => ({
        ...dependency,
        fromRefs: ["field:0", "field:1"],
      })),
    }, {
      ...nativeEvidence(facts),
      relations: [...nativeEvidence(facts).relations, {
        ...nativeEvidence(facts).relations[0]!,
        providerRelationOrdinal: 1,
        nativeRelationOccurrenceId: "native:relation:read-1",
        sourceSpan: { start: 50, end: 70 },
        evidenceRefs: ["evidence:relation:read-1"],
        fields: [{
          ...nativeEvidence(facts).relations[0]!.fields[0]!,
          nativeFieldOccurrenceId: "native:field:read-1:amount",
          sourceSpan: { start: 50, end: 70 },
          evidenceRefs: ["evidence:field:read-1:amount"],
        }],
      }],
    });
    expect(assembled.evidenceMappings[0]?.mappingStatus).toBe("EXACT");
    expect(assembled.evidenceMappings[0]).not.toHaveProperty("sourceSpan");
    expect(assembled.evidenceMappings[0]?.evidenceRefs).toEqual([
      "evidence:field:read-0:amount",
      "evidence:field:read-1:amount",
    ]);
  });

  it("does not use a tail table-name fallback across physical schemas", () => {
    const facts = validFacts();
    const withPhysicalTable = parseCandidateTaskSemanticFacts({
      ...facts,
      relations: facts.relations.map((relation) => ({
        ...relation,
        qualifiedTableName: "app.orders",
      })),
    });
    const native = nativeEvidence(withPhysicalTable);
    const assembled = assembleNativeEvidence(withPhysicalTable, {
      ...native,
      relations: native.relations.map((relation) => ({
        ...relation,
        qualifiedPhysicalTable: "archive.orders",
      })),
    });
    expect(assembled.evidenceMappings[0]?.mappingStatus).toBe("UNMAPPABLE");
    expect(assembled.statementStatus).toBe("PARTIAL");
  });

  it("distinguishes Provider-local facts that have not entered the evidence assembler", () => {
    const facts = validFacts();
    expect(facts.evidenceMappings[0]?.mappingStatus).toBe("NOT_ASSEMBLED");
    expect(facts.issues.some((item) => item.code === "NATIVE_EVIDENCE_NOT_ASSEMBLED")).toBe(true);
  });

  it("fails closed on SQL slot identity mismatch", () => {
    const facts = validFacts();
    const assembled = assembleNativeEvidence(facts, {
      ...nativeEvidence(facts),
      sqlSourceId: "slot:different",
    });
    expect(assembled.statementStatus).toBe("PARTIAL");
    expect(assembled.issues.some((item) => item.code === "NATIVE_STATEMENT_IDENTITY_MISMATCH"))
      .toBe(true);
  });
});
