import { describe, expect, it } from "vitest";
import { buildWritePartitionParts } from "../../../scripts/project-graph/task-local/write-partition-evidence.ts";
import { partitionMatchStatus } from "../../../packages/data-graph/src/continuation/continuation-v2.ts";
import { consumptionScopeFromDetail, consumptionScopeIdentity } from "../../../packages/data-graph/src/asset-graph/consumption-scope.ts";
import { createPartitionValueResolver, createPartitionValueDomainResolver } from "../../../scripts/project-graph/task-local/partition-value-propagation.ts";

const packInput = {
  qualifiedName: "dm.target", packTarget: { qualifiedName: "dm.target" }, targetWriteCount: 1,
  statementSql: null, writeObservationId: "write:pack",
  factsWrite: { write_observation_id: "write:pack", physical_dataset: "dm.target", provenance: "PLATFORM_TARGET",
    partition_mode: "DYNAMIC", partition_binding_status: "COMPLETE", partition_columns: ["grp_id", "busi_date"],
    partition_assignments: [{ field: "grp_id", status: "CONFIRMED" }, { field: "busi_date", status: "RUNTIME_EXPRESSION" }] },
  packPartition: [{ grp_id: "A", busi_date: "h12" }, { grp_id: "B", busi_date: "h20" }],
};
const read = (grp: string, date: string) => ({ readOccurrenceId: "r", readOccurrenceNodeId: "rn", datasetNodeId: "d",
  qualifiedName: "dm.target", identityStatus: "CONFIRMED", partitionPredicateStatus: "LITERAL" as const,
  partitionPredicates: [{ column: "grp_id", values: [grp] }, { column: "busi_date", values: [date] }] });
const write = (partition: ReturnType<typeof buildWritePartitionParts>) => ({ taskId: "w", writeObservationId: "write:pack",
  targetWriteNodeId: "wn", datasetNodeId: "d", qualifiedName: "dm.target", source: "IN_UNION_FINAL_WRITE" as const,
  partitionStatus: "STATIC", partition });

describe("partition alternatives regression", () => {
  it.each([['alpha.input', 'origin', 'A'], ['renamed.source', 'category', 'BETA']])(
    "uses the same nullable-domain rules after renaming %s.%s",
    (table, column, value) => {
      const physical = [{ table, column }];
      const expression = { expression_id: "out", relation_id: "out", role: "PROJECT_EXPRESSION", ordinal: 0,
        expression_text: `a.${column} AS p`, input_fields: physical };
      const fixture = (joinType: string, side: string) => ({
        expressions: [expression], bindings: [], materializations: [],
        literal: (sql: unknown) => sql === `'${value}'` ? value : null,
        relations: [
          { relation_id: "read", relation: { type: "read", table, binding: "a", scope_id: "root" } },
          { relation_id: "other", relation: { type: "read", table: "other.source", binding: "b", scope_id: "root" } },
          { relation_id: "filter", relation: { type: "filter", source: "read", scope_id: "root", predicate_tree: {
            kind: "ATOM", operator: "EQ", operands: [
              { kind: "COLUMN", column: { resolution: "PHYSICAL", physical } },
              { kind: "LITERAL", expression: `'${value}'` },
            ],
          } } },
          { relation_id: "join", relation: { type: "join", join_type: joinType, scope_id: "root",
            left: side === "left" ? "filter" : "other", right: side === "right" ? "filter" : "other" } },
          { relation_id: "out", relation: { type: "project", source: "join", scope_id: "root" } },
        ],
      });
      for (const [join, side, nullable] of [['inner','left',false],['left','left',false],['left','right',true],
        ['right','right',false],['right','left',true],['full','left',true],['full','right',true]] as const) {
        expect(createPartitionValueDomainResolver(fixture(join, side))(expression)).toEqual({ values: [value], mayBeNull: nullable });
      }
      const facts = fixture('full', 'left');
      const union = { expression_id: 'union', relation_id: 'union', role: 'SETOP_OUTPUT', ordinal: 0 };
      const nullBranch = { expression_id: 'null', relation_id: 'null', role: 'PROJECT_EXPRESSION', ordinal: 0, expression_text: 'NULL', input_fields: [] };
      const unionFacts = { ...facts, expressions: [...facts.expressions, union, nullBranch], relations: [...facts.relations,
        { relation_id: 'union', relation: { type: 'setop', setop: 'union', branches: ['out','null'] } },
        { relation_id: 'null', relation: { type: 'project' } },
      ] };
      expect(createPartitionValueDomainResolver(unionFacts)(union)).toEqual({ values: [value], mayBeNull: true });
      expect(createPartitionValueDomainResolver({ ...unionFacts, expressions: unionFacts.expressions.filter(e=>e.expression_id!=='null') })(union)).toBeNull();
      const writerInput = { ...facts, qualifiedName: 'dm.target', statementSql: null, packPartition: null,
        writeObservationId: 'w', factsWrite: { write_observation_id: 'w', physical_dataset: 'dm.target', partition_mode: 'DYNAMIC',
          partition_columns: ['p'], partition_assignments: [{ field: 'p', status: 'CONFIRMED', mapping_method: 'DYNAMIC_PARTITION_OUTPUT_ORDINAL' }] },
        bindings: [{ write_observation_id: 'w', target_field: 'p', binding_status: 'RESOLVED', source_ordinal: 0, expression_id: 'out' }],
      };
      expect(buildWritePartitionParts(writerInput)[0]?.values).toEqual([]);
      const witness = { expression_id: 'witness', relation_id: 'witness', role: 'PROJECT_EXPRESSION', ordinal: 0,
        expression_text: `'${value}' AS p`, input_fields: [] };
      const parts = buildWritePartitionParts({ ...writerInput,
        bindings: writerInput.bindings.map(b=>({...b, expression_id:'union'})),
        expressions: [...facts.expressions, union, witness],
        relations: [...facts.relations,
          { relation_id: 'union', relation: { type: 'setop', setop: 'union', branches: ['out','witness'] } },
          { relation_id: 'witness', relation: { type: 'project' } },
        ],
      });
      expect(parts[0]).toMatchObject({ column: 'p', values: [value], mayBeNull: true, observedValue: null });
      const reader = { ...read('unused','unused'), partitionPredicates: [{ column: 'p', values: [value] }] };
      expect(partitionMatchStatus(reader, write(parts))).toBe('CONFIRMED');
      expect(partitionMatchStatus({ ...reader, partitionPredicates: [{ column:'p', values:['OTHER'] }] }, write(parts))).toBe('DISJOINT');
      expect(partitionMatchStatus({ ...reader, partitionPredicateStatus: 'NON_LITERAL_PRESENT',
        partitionPredicates: [{ column:'p', values:['OTHER'] }] }, write(parts))).toBe('UNKNOWN');
      expect(partitionMatchStatus({ ...reader, partitionPredicates: [{ column:'p', values:['OTHER'] }, { column:'other', values:['X'] }] }, write(parts))).toBe('UNKNOWN');
      expect(partitionMatchStatus({ ...reader, partitionPredicateStatus: 'NON_LITERAL_PRESENT', partitionPredicates: [] }, write(parts))).toBe('UNKNOWN');
      const scope = consumptionScopeFromDetail({ partition: parts });
      expect(scope.label).toContain('可能含 NULL');
      expect(consumptionScopeIdentity(scope)).not.toBe(consumptionScopeIdentity(consumptionScopeFromDetail({ partition: parts.map(p=>({...p, mayBeNull: false})) })));
    },
  );

  it("follows a renamed materialized field while rejecting nullable join sides and mismatched writes", () => {
    const field = { table: "demo.tmp", column: "renamed" };
    const expression = { expression_id: "consumer", task_id: "t", relation_id: "out", role: "PROJECT_EXPRESSION",
      expression_text: "t.renamed AS grp_id", input_fields: [field] };
    const producer = { expression_id: "producer", relation_id: "producer", role: "PROJECT_EXPRESSION", expression_text: "'A' AS renamed" };
    const bridge = { physical_dataset: "demo.tmp", column: "renamed", read_expression_ids: ["consumer"],
      status: "RESOLVED", write_statement_index: 0, read_statement_index: 1,
      output_binding_id: "binding", write_observation_id: "write" };
    const binding = { binding_id: "binding", target_field: "renamed", target_dataset: "demo.tmp",
      binding_status: "RESOLVED", write_observation_id: "write", expression_id: "producer" };
    const resolve = (join: string, side: string, materialization = bridge, outputBinding = binding) => {
      const relations = [
        { relation_id: "read", relation: { type: "read", table: "demo.tmp", binding: "t", scope_id: "root" } },
        { relation_id: "other", relation: { type: "read", table: "demo.other", binding: "o", scope_id: "root" } },
        { relation_id: "join", relation: { type: "join", join_type: join,
          left: side === "left" ? "read" : "other", right: side === "right" ? "read" : "other", scope_id: "root" } },
        { relation_id: "out", relation: { type: "project", source: "join", scope_id: "root" } },
      ];
      return createPartitionValueResolver({ bindings: [outputBinding], expressions: [expression, producer], relations,
        materializations: [materialization], literal: value => String(value).startsWith("'A'") ? "A" : null })(expression);
    };
    expect(resolve("left", "left")).toEqual(["A"]);
    expect(resolve("inner", "right")).toEqual(["A"]);
    expect(resolve("left", "right")).toBeNull();
    expect(resolve("full", "left")).toBeNull();
    expect(resolve("left", "left", { ...bridge, write_statement_index: 1 })).toBeNull();
    expect(resolve("left", "left", bridge, { ...binding, write_observation_id: "other" })).toBeNull();
    expect(resolve("left", "left", bridge, { ...binding, target_dataset: "other.tmp" })).toBeNull();
  });

  it("keeps UNION branch column combinations instead of creating cross products", () => {
    const fields = ["grp_id", "busi_date"];
    const parts = buildWritePartitionParts({ ...packInput, packPartition: null,
      factsWrite: { ...packInput.factsWrite, provenance: "SQL_PARSE", partition_assignments: fields.map(field => ({ field, status: "CONFIRMED", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL" })) },
      bindings: fields.map((field, ordinal) => ({ target_field: field, source_ordinal: ordinal, expression_id: `root:${ordinal}`, write_observation_id: "write:pack", binding_status: "RESOLVED" })),
      expressions: fields.flatMap((field, ordinal) => [
        { expression_id: `root:${ordinal}`, relation_id: "union", role: "SETOP_OUTPUT", ordinal },
        { expression_id: `left:${ordinal}`, relation_id: "left", role: "PROJECT_EXPRESSION", ordinal, expression_text: `'${ordinal ? "h12" : "A"}' AS ${field}` },
        { expression_id: `right:${ordinal}`, relation_id: "right", role: "PROJECT_EXPRESSION", ordinal, expression_text: `'${ordinal ? "h20" : "B"}' AS ${field}` },
      ]),
      relations: [{ relation_id: "union", relation: { type: "setop", setop: "union", branches: ["left", "right"] } },
        { relation_id: "left", relation: { type: "project" } }, { relation_id: "right", relation: { type: "project" } }],
    });
    expect(partitionMatchStatus(read("A", "h12"), write(parts))).toBe("CONFIRMED");
    expect(partitionMatchStatus(read("A", "h20"), write(parts))).toBe("DISJOINT");
    expect(consumptionScopeFromDetail({ partition: parts }).ranges).toHaveLength(2);
    const broken = parts.map((part, index) => index === 0 ? part : { ...part, alternatives: part.alternatives?.slice(0, 1) });
    expect(partitionMatchStatus(read("A", "h12"), write(broken))).toBe("UNKNOWN");
  });
  it("preserves Pack tuples through matching and display", () => {
    const parts = buildWritePartitionParts(packInput);
    expect(parts.map(p => p.values)).toEqual([["A", "B"], ["h12", "h20"]]);
    expect(partitionMatchStatus(read("A", "h12"), write(parts))).toBe("CONFIRMED");
    expect(partitionMatchStatus(read("A", "h20"), write(parts))).toBe("DISJOINT");
    const scope = consumptionScopeFromDetail({ partition: parts });
    expect(scope.ranges).toHaveLength(2);
    expect(scope.ranges?.every(range => range.every(item => item.values.length === 1))).toBe(true);
  });
  it("does not apply a Pack to several writes or override conflicts", () => {
    expect(buildWritePartitionParts({ ...packInput, targetWriteCount: 2 }).every(p => !p.values.length)).toBe(true);
    expect(buildWritePartitionParts({ ...packInput, factsWrite: { ...packInput.factsWrite, partition_status: "CONFLICT" } }).every(p => !p.values.length)).toBe(true);
    expect(buildWritePartitionParts({ ...packInput, packPartition: [{ grp_id: "A" }] }).every(p => !p.values.length)).toBe(true);
  });
  it("does not interpret an identifier suffix as a numeric constant", () => {
    const input = { qualifiedName: "dm.target", packPartition: null, writeObservationId: "write:ref",
      factsWrite: { write_observation_id: "write:ref", physical_dataset: "dm.target", partition_mode: "DYNAMIC",
        partition_assignments: [{ field: "src_tbl", status: "CONFIRMED", mapping_method: "DYNAMIC_PARTITION_OUTPUT_ORDINAL" }] },
      bindings: [{ write_observation_id: "write:ref", target_field: "src_tbl", source_ordinal: 0, binding_status: "RESOLVED", expression_id: "e" }],
      expressions: [{ expression_id: "e", role: "PROJECT_EXPRESSION", expression_text: "src_tbl" }] };
    expect(buildWritePartitionParts({ ...input, statementSql: "select SRC_TBL1 AS SRC_TBL" })[0]?.values).toEqual([]);
    expect(buildWritePartitionParts({ ...input, statementSql: "select 1 AS SRC_TBL" })[0]?.values).toEqual(["1"]);
  });
});
