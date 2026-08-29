import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CandidateTaskSemanticFacts } from "../../scripts/calcite-semantic-provider/contract.ts";
import {
  lineColumnSpanToOffsets,
  loadNativeLeafEvidence,
  nativeRelationEvidenceRef,
  reverseDialectSpan,
} from "../../scripts/calcite-semantic-provider/native-evidence-loader.ts";

describe("Calcite source occurrence to Native evidence adapter", () => {
  it("converts Calcite inclusive line-column spans to canonical exclusive offsets", () => {
    expect(lineColumnSpanToOffsets("select\nfoo.bar\n", {
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 7,
    })).toEqual({ start: 7, end: 14 });
  });

  it("reverses a completed dialect insertion without guessing through an overlap", () => {
    const transforms = [{
      beforeSpan: { start: 7, end: 10 },
      afterSpan: { start: 7, end: 12 },
    }];
    expect(reverseDialectSpan({ start: 0, end: 15 }, transforms))
      .toEqual({ start: 0, end: 13 });
    expect(reverseDialectSpan({ start: 8, end: 10 }, transforms)).toBeUndefined();
  });

  it("encodes punctuation-bearing Native occurrence IDs reversibly without collisions", () => {
    const relationId = "task:209119:statement:0:relation:root.(child).read.a";
    const evidenceRef = nativeRelationEvidenceRef(relationId);
    expect(evidenceRef).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:/#-]*$/u);
    const encoded = evidenceRef.slice("machine-facts:relation-b64:".length);
    expect(Buffer.from(encoded, "base64url").toString("utf8")).toBe(relationId);
    expect(nativeRelationEvidenceRef(`${relationId}-extra`)).not.toBe(evidenceRef);
  });

  it("maps self-join aliases to distinct Native occurrences by exact identifier anchors", () => {
    const directory = mkdtempSync(join(tmpdir(), "calcite-native-evidence-"));
    try {
      const sql = "select * from app.orders a join app.orders a_extra";
      const sqlPath = join(directory, "query.sql");
      const relationNodesPath = join(directory, "relation-nodes.jsonl");
      writeFileSync(sqlPath, sql, "utf8");
      writeFileSync(relationNodesPath, [
        JSON.stringify(nativeRead("native:read-a", 14, 26)),
        JSON.stringify(nativeRead("native:read-a-extra", 32, 50)),
      ].join("\n"), "utf8");
      const manifestPath = join(directory, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify({
        dialectTransform: { sql, transforms: [] },
        evidence: { relationNodesPath, sqlPath },
      }), "utf8");
      const result = loadNativeLeafEvidence(selfJoinFacts(), manifestPath);
      expect(result.metrics).toMatchObject({
        exactNativeReadCount: 2,
        identifierAnchorExactReadCount: 2,
        ambiguousNativeReadCount: 0,
        unmappableNativeReadCount: 0,
      });
      expect(result.statement.relations.map((item) => item.nativeRelationOccurrenceId))
        .toEqual(["native:read-a", "native:read-a-extra"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function nativeRead(relationId: string, start: number, end: number) {
  return {
    relation_id: relationId,
    relation_type: "read",
    source_span: { start, end },
    relation: { table: "app.orders", read_occurrence_id: relationId },
  };
}

function selfJoinFacts(): CandidateTaskSemanticFacts {
  const relations = [0, 1].map((ordinal) => ({
    relationId: `rel:${ordinal}`,
    kind: "TABLE_SCAN" as const,
    inputRelationIds: [],
    outputFieldIds: [`field:${ordinal}`],
    qualifiedTableName: "app.orders",
    providerOrdinal: ordinal,
    sourceOccurrences: [{
      occurrenceId: `sql-table-reference:000${ordinal}`,
      sourceKind: "TABLE_REFERENCE" as const,
      coordinateSystem: "DIALECT_TRANSFORMED_SQL" as const,
      sourceSpan: {
        startLine: 1,
        startColumn: ordinal === 0 ? 15 : 33,
        endLine: 1,
        endColumn: ordinal === 0 ? 24 : 42,
      },
    }],
  }));
  return {
    schemaVersion: "0.1.0-poc",
    provider: {
      name: "calcite-semantic-provider",
      calciteVersion: "1.42.0",
      adapterVersion: "0.1.0",
      buildFingerprint: "0".repeat(64),
    },
    input: {
      sqlSourceId: "slot:self-join",
      statementOrdinal: 0,
      sqlSha256: "1".repeat(64),
      schemaSha256: "2".repeat(64),
      dialectDigest: "3".repeat(64),
    },
    statementStatus: "PARTIAL",
    capabilities: [],
    relations,
    fields: relations.map((relation, slot) => ({
      fieldId: `field:${slot}`,
      relationId: relation.relationId,
      role: "OUTPUT" as const,
      slot: 0,
      name: "id",
      typeName: "BIGINT",
      nullable: true,
    })),
    operators: [],
    dependencies: [],
    metadata: [],
    evidenceMappings: [],
    issues: [],
  };
}
