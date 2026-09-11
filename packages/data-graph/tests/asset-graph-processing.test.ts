import { beforeEach, describe, expect, it, vi } from "vitest";
import { processingDetail } from "../src/asset-graph/agent-api.ts";
import { readJson } from "../src/asset-graph/evidence-json.ts";
import type { AssetGraphStore } from "../src/asset-graph/store.ts";

vi.mock("../src/asset-graph/evidence-json.ts", () => ({ readJson: vi.fn() }));

const aggregateId = "task:1:statement:1:relation:aggregate";
const filterId = "task:1:statement:1:relation:filter";
const store = {
  ready: vi.fn(async () => ({
    manifestPath: "manifest",
    version: "version-1",
  })),
} as unknown as AssetGraphStore;

beforeEach(() => {
  vi.mocked(readJson).mockImplementation((path) => {
    if (path === "manifest") {
      return {
        tasks: [
          {
            taskId: "1",
            evidencePath: "evidence",
            coverageStatus: "PROJECTED",
          },
        ],
      };
    }
    return {
      expressions: [
        {
          expression_id: "sum",
          relation_id: aggregateId,
          expression_text: "sum(dynamic_notional) as Init_Nom_Prin",
          input_dependency_status: "PARTIAL",
          input_fields: [
            { table: "demo.positions", column: "dynamic_notional" },
          ],
        },
        {
          expression_id: "count",
          relation_id: aggregateId,
          expression_text: "count(*) as position_count",
          input_dependency_status: "NO_PHYSICAL_INPUT",
        },
        {
          expression_id: "outer",
          relation_id: "project",
          expression_text: "dy.Init_Nom_Prin",
          input_dependency_status: "PHYSICAL",
        },
        { expression_id: "legacy", expression_text: "legacy_value" },
      ],
      relations: [
        {
          relation_id: aggregateId,
          statement_id: "task:1:slot:query:statement:1",
          relation_type: "aggregate",
          provenance: "SQL_PLAN",
          relation: {
            type: "aggregate",
            group_by_exprs: ["instrument_id"],
            source: filterId,
          },
          source_span: { start: 20, end: 40 },
          source_text: "group by instrument_id",
        },
        {
          relation_id: filterId,
          relation_type: "filter",
          relation: {
            type: "filter",
            predicate_display: "rk = 1",
            source: "window",
          },
        },
      ],
      sqlSources: [
        {
          slot: "query",
          sha256: "fixed-hash",
          content: "SELECT\nSUM(amount)\nFROM positions",
        },
      ],
    };
  });
});

describe("processing evidence consumption", () => {
  it("preserves partial, physical, non-physical and missing dependency states", async () => {
    const result = await processingDetail(store, { taskId: "1" });
    expect(result.expressions.map((e) => e.inputDependencyStatus)).toEqual([
      "PARTIAL",
      "NO_PHYSICAL_INPUT",
      "PHYSICAL",
      null,
    ]);
    expect(result.expressions[0].inputFields).toHaveLength(1);
    expect(result.relation).toBeUndefined();
  });

  it("returns the exact selected relation and scopes paginated expressions to it", async () => {
    const result = await processingDetail(store, {
      taskId: "1",
      relationId: aggregateId,
      limit: 1,
    });
    expect(result.relation).toEqual({
      relationId: aggregateId,
      statementId: "task:1:slot:query:statement:1",
      kind: "aggregate",
      provenance: "SQL_PLAN",
      definition: {
        type: "aggregate",
        group_by_exprs: ["instrument_id"],
        source: filterId,
      },
      sourceSpan: { start: 20, end: 40 },
      sourceText: "group by instrument_id",
    });
    expect(result.expressions.map((e) => e.expressionId)).toEqual(["sum"]);
    expect(result.pagination).toMatchObject({ total: 2, nextOffset: 1 });
    const next = await processingDetail(store, {
      taskId: "1",
      relationId: aggregateId,
      offset: 1,
      limit: 1,
    });
    expect(next.expressions.map((e) => e.expressionId)).toEqual(["count"]);
    expect(next.pagination.nextOffset).toBeNull();
  });

  it("lets the reader follow an explicit upstream relation even without expressions", async () => {
    const result = await processingDetail(store, {
      taskId: "1",
      relationId: filterId,
    });
    expect(result.relation?.kind).toBe("filter");
    expect(result.relation?.definition).toMatchObject({
      predicate_display: "rk = 1",
    });
    expect(result.expressions).toEqual([]);
  });

  it("does not broaden an unknown relation into task-wide context", async () => {
    await expect(
      processingDetail(store, {
        taskId: "1",
        relationId: "other-task:relation",
      }),
    ).rejects.toThrow("RELATION_NOT_IN_TASK_EVIDENCE");
  });

  it("combines relation and text filters while preserving fixed SQL paging", async () => {
    const result = await processingDetail(store, {
      taskId: "1",
      relationId: aggregateId,
      text: "INIT_NOM_PRIN",
      sql: true,
      slot: "query",
      lineStart: 2,
      lineCount: 1,
    });
    expect(result.expressions.map((e) => e.expressionId)).toEqual(["sum"]);
    expect(result.sqlSources?.[0]).toMatchObject({
      content: "SUM(amount)",
      sha256: "fixed-hash",
      nextLine: 3,
    });
    expect(result.evidence.version).toBe("version-1");
  });
});
