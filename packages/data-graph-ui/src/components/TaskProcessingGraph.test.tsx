import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  layoutProcessingStages,
  ProcessingStageEvidence,
  TaskProcessingGraphView,
  processingAnchors,
} from "./TaskProcessingGraph";
import type { TaskFieldExplanation, TaskProcessingStage } from "../types";

const stage = (id: string, table: string, kind: TaskProcessingStage["kind"] = "WRITE"): TaskProcessingStage => ({
  id, table, kind, writeId: kind === "SOURCE" ? undefined : id,
  role: id === "final" ? "FINAL" : kind === "SOURCE" ? "SOURCE" : "INTERMEDIATE",
  expressions: [], controls: [],
});
const explanation = (): TaskFieldExplanation => ({
  version: "published-v1", taskId: "76984", anchor: { writeId: "final", column: "pty_name" },
  status: "COMPLETE", limits: { maxDepth: 32, maxNodes: 500, maxEdges: 1000 },
  frontierStageIds: [], stoppedBy: [], gaps: [],
  stages: [
    stage("source", "source.customer", "SOURCE"),
    stage("old", "pdata_n.t01_pty", "SOURCE"),
    stage("temp", "temp_n.customer_temp"),
    stage("mid", "temp_n.customer_mid"),
    ...["I", "U", "S", "D"].map((branch) => ({ ...stage(branch, "pdata_n.t01_pty", "BRANCH"), writeId: "final", label: `${branch} 分支` })),
    stage("final", "pdata_n.t01_pty"),
  ],
  edges: [
    { id: "source-temp", from: "source", to: "temp", kind: "VALUE" },
    { id: "temp-mid", from: "temp", to: "mid", kind: "VALUE" },
    { id: "old-mid", from: "old", to: "mid", kind: "CONDITION" },
    ...["I", "U", "S", "D"].flatMap((branch) => [
      { id: `mid-${branch}`, from: "mid", to: branch, kind: "CONTROL" as const },
      { id: `${branch}-final`, from: branch, to: "final", kind: "MATERIALIZATION" as const, label: "UNION ALL" },
    ]),
  ],
});

describe("task processing graph", () => {
  it("preserves same-table reads, distinct writes, and all four parallel branches", () => {
    const value = explanation();
    const layout = layoutProcessingStages(value.stages, value.edges);
    expect(layout.positions.size).toBe(9);
    for (const edge of value.edges) {
      expect(layout.positions.get(edge.from)!.y).toBeLessThan(layout.positions.get(edge.to)!.y);
    }
    expect(new Set(["I", "U", "S", "D"].map(id => layout.positions.get(id)!.x)).size).toBe(4);
    const html = renderToStaticMarkup(<TaskProcessingGraphView explanation={value} />);
    expect(html).toContain("temp_n.customer_temp");
    expect(html).toContain("temp_n.customer_mid");
    for (const branch of ["I", "U", "S", "D"]) expect(html).toContain(`${branch} 分支`);
    expect(html.match(/data-processing-edge=/g)).toHaveLength(11);
    expect(html).toContain("UNION ALL");
    expect(html).toContain("当前最终写入");
  });

  it("shows per-stage create expressions, condition roles and SQL locations", () => {
    const selected: TaskProcessingStage = {
      ...stage("temp", "temp_n.customer_001"), slot: "create",
      expressions: [{ id: "case", column: "cust_type_desc", text: "CASE WHEN b.cust_typ_cd = '01' THEN '个人' ELSE '未知' END", roles: ["BRANCH_SELECTION"], sourceLocation: { slot: "create", lineStart: 42, lineEnd: 44 } }],
      controls: [{ id: "filter", kind: "FILTER", text: "UPDATED_TS = '9999-12-31'", sourceLocation: { slot: "create", lineStart: 45, lineEnd: 45 } }],
    };
    const html = renderToStaticMarkup(<ProcessingStageEvidence stage={selected} edges={[]} stages={[selected]} gaps={[]} />);
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("cust_type_desc");
    expect(text).toContain("b.cust_typ_cd");
    expect(text).toContain("分支选择");
    expect(text).toContain("create · 第 42–44 行");
    expect(text).toContain("UPDATED_TS");
  });

  it("draws distinct paths for value and condition dependencies between the same stages", () => {
    const value = explanation();
    value.edges.push({ id: "source-temp-condition", from: "source", to: "temp", kind: "CONDITION" });
    const html = renderToStaticMarkup(<TaskProcessingGraphView explanation={value} />);
    const path = (id: string) => html.match(new RegExp(`data-processing-edge="${id}"[^>]*><path d="([^"]+)"`))?.[1];
    expect(path("source-temp")).toBeDefined();
    expect(path("source-temp-condition")).toBeDefined();
    expect(path("source-temp")).not.toBe(path("source-temp-condition"));
  });

  it("keeps unresolved links and makes truncation and gaps visible", () => {
    const value = explanation();
    value.status = "TRUNCATED";
    value.stoppedBy = ["MAX_DEPTH"];
    value.frontierStageIds = ["temp"];
    value.edges[0]!.status = "UNRESOLVED";
    value.gaps = [{ code: "MATERIALIZATION_AMBIGUOUS", message: "同一字段存在多次候选写入", stageId: "temp" }];
    const html = renderToStaticMarkup(<TaskProcessingGraphView explanation={value} />);
    expect(html).toContain("达到查询上限");
    expect(html).toContain("MAX_DEPTH");
    expect(html).toContain("同一字段存在多次候选写入");
    expect(html).toContain("待继续展开");
    expect(html).toContain("待确认");
  });

  it("requires exact final binding identity and never guesses a write from table names", () => {
    expect(processingAnchors({ version: "v", taskId: "t", controls: [], bindings: [
      { column: "x", table: "temp_n.t", writeId: "tmp", outputScope: "OTHER" },
      { column: "x", table: "pdata.t", writeId: "w1", outputScope: "FINAL" },
      { column: "x", table: "pdata.t", writeId: "w2", outputScope: "FINAL" },
      { column: "unknown", table: "pdata.t", outputScope: "FINAL" },
    ] }).map(anchor => anchor.writeId)).toEqual(["w1", "w2"]);
  });

  it("keeps malformed-edge and cycle information without dropping known stages", () => {
    const stages = [stage("a", "temp.same"), stage("b", "temp.same")];
    const layout = layoutProcessingStages(stages, [
      { id: "a-b", from: "a", to: "b", kind: "VALUE" },
      { id: "b-a", from: "b", to: "a", kind: "VALUE" },
      { id: "missing", from: "unknown", to: "a", kind: "VALUE" },
    ]);
    expect(layout.positions.size).toBe(2);
    expect(layout.cycleStageIds).toEqual(["a", "b"]);
    expect(layout.invalidEdgeIds).toEqual(["missing"]);
  });
});
