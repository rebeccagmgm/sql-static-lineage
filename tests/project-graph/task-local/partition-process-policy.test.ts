import { describe, expect, it } from "vitest";
import { buildCompactTaskPartition, buildTaskPartitionEvidence } from "../../../scripts/input/shared/task-partition-evidence.ts";
import { buildWritePartitionParts } from "../../../scripts/project-graph/task-local/write-partition-evidence.ts";
import { partitionMatchStatus } from "../../../packages/data-graph/src/continuation/continuation-v2.ts";
import { provenSqlOutputExpressions } from "../../../scripts/plans/sql-output-domain.ts";

const sql = "SELECT tag_id FROM (SELECT CASE WHEN a.kind=b.kind THEN b.tag_id ELSE 'TOTAL' END AS tag_id FROM source a LEFT JOIN (SELECT 'A' tag_id, 'one' kind UNION ALL SELECT 'B' tag_id, 'two' kind) b ON 1=1) q";
const table = { platform: "hive", dataSource: "test", qualifiedName: "demo.target", objectType: "TABLE", partitionFields: ["tag_id"], ddl: "CREATE TABLE demo.target (id STRING) PARTITIONED BY (tag_id STRING)", evidenceProvider: "test" };
const read = { readOccurrenceId: "r", readOccurrenceNodeId: "rn", datasetNodeId: "d", qualifiedName: "demo.target", identityStatus: "CONFIRMED", partitionPredicateStatus: "LITERAL" as const, partitionPredicates: [{ column: "tag_id", values: ["TOTAL"] }] };
const writer = { taskId: "w", writeObservationId: "w", targetWriteNodeId: "wn", datasetNodeId: "d", qualifiedName: "demo.target", source: "IN_UNION_FINAL_WRITE" as const, partitionStatus: "STATIC" };

describe("process partition matching", () => {
  it("requires every UNION branch and follows renamed outputs instead of same-named aliases", () => {
    expect(provenSqlOutputExpressions("SELECT 'A' AS p UNION ALL SELECT p FROM source", "p")).toBeNull();
    expect(provenSqlOutputExpressions("SELECT renamed AS p FROM (SELECT 'B' AS renamed, 'WRONG' AS p) q", "p")).toEqual(["'B'"]);
    expect(provenSqlOutputExpressions("SELECT upper(p) AS p FROM (SELECT 'a' AS p) q", "p")).toBeNull();
    expect(provenSqlOutputExpressions("SELECT p FROM source WHERE p='A' OR other='B'", "p")).toBeNull();
  });
  it("does not turn nested aliases into an exhaustive CASE output domain", () => {
    const input = { taskTarget: "demo.target", tables: [table], sparkIndexMode: true, sql: { query: sql } };
    // '*' is the existing compact Pack spelling of an unresolved partition.
    expect(buildCompactTaskPartition(input)).toEqual({ tag_id: "*" });
    expect(buildTaskPartitionEvidence(input).targets[0]?.writes[0]?.assignments[0]?.status).toBe("UNKNOWN");
  });

  it("does not prune from a legacy Pack array when the query domain is unproven", () => {
    const parts = buildWritePartitionParts({ qualifiedName: "demo.target", statementSql: sql,
      packTarget: { qualifiedName: "demo.target" }, targetWriteCount: 1, writeObservationId: "w",
      packPartition: [{ tag_id: "A" }, { tag_id: "B" }],
      factsWrite: { write_observation_id: "w", physical_dataset: "demo.target", provenance: "PLATFORM_TARGET",
        partition_mode: "DYNAMIC", partition_binding_status: "COMPLETE", partition_columns: ["tag_id"],
        partition_assignments: [{ field: "tag_id", status: "CONFIRMED", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL" }] },
    });
    expect(parts[0]).toMatchObject({ values: [], valueStatus: "UNKNOWN" });
    expect(partitionMatchStatus(read, { ...writer, partition: parts })).toBe("UNKNOWN");
  });

  it("replaces unrelated nested constants with a proven scalar output", () => {
    const parts = buildWritePartitionParts({ qualifiedName: "demo.target", statementSql: "SELECT tag_id FROM (SELECT 'A' AS tag_id FROM source a LEFT JOIN (SELECT 'B' AS tag_id) b ON 1=1) q",
      packTarget: { qualifiedName: "demo.target" }, targetWriteCount: 1, writeObservationId: "w",
      packPartition: [{ tag_id: "A" }, { tag_id: "B" }],
      factsWrite: { write_observation_id: "w", physical_dataset: "demo.target", provenance: "PLATFORM_TARGET",
        partition_mode: "DYNAMIC", partition_binding_status: "COMPLETE", partition_columns: ["tag_id"],
        partition_assignments: [{ field: "tag_id", status: "CONFIRMED", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL" }] },
    });
    expect(parts[0]).toMatchObject({ values: ["A"], partitionStatus: "STATIC" });
  });

  it.each(["{busi_date}", "${yyyy-MM-dd}", "2026-09-01"])("matches approved day process expression %s", value => {
    expect(partitionMatchStatus({ ...read, partitionPredicates: [{ column: "busi_date", values: ["2026-05-21"] }] },
      { ...writer, partition: [{ column: "busi_date", values: [value], valueStatus: "OBSERVED_RENDERED_VALUE" }] })).toBe("CONFIRMED");
  });

  it("keeps explicit batch labels separate", () => {
    expect(partitionMatchStatus({ ...read, partitionPredicates: [{ column: "busi_date", values: ["h15"] }] },
      { ...writer, partition: [{ column: "busi_date", values: ["h10"], valueStatus: "OBSERVED_RENDERED_VALUE" }] })).toBe("DISJOINT");
  });
});
