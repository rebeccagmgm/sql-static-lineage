import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { GraphEdge } from "../types";
import { tableRelationRecords } from "../table-relations";
import { TableRelationsPanel } from "./TableRelationsPanel";

it("shows each write separately, preserves unknown evidence and does not fetch on render", () => {
  const records: GraphEdge[] = [
    {
      id: "w3",
      from: "task:103935",
      to: "context",
      kind: "WRITES_TABLE",
      status: "CONFIRMED",
      detail: {
        writeObservationId: "write:3",
        partition: [{ column: "src", values: ["A"] }],
      },
    },
    {
      id: "w6",
      from: "task:103935",
      to: "context",
      kind: "WRITES_TABLE",
      status: "CANDIDATE",
      detail: { writeObservationId: "write:6", partitionStatus: "UNKNOWN" },
    },
  ];
  const inspect = vi.fn();
  const html = renderToStaticMarkup(
    <TableRelationsPanel edges={records} nodes={[]} onInspect={inspect} />,
  );
  expect(html).toContain("write:3");
  expect(html).toContain("write:6");
  expect(html).toContain("UNKNOWN");
  expect(html).toContain("候选");
  expect(html.match(/查看此写入加工/g)).toHaveLength(2);
  expect(inspect).not.toHaveBeenCalled();
});

it("shows one evidence record for a relation reached by two paths without discarding the paths", () => {
  const record: GraphEdge = {
    id: "path1",
    from: "ctx1",
    to: "task:2",
    kind: "READS_TABLE",
    detail: { readOccurrenceId: "read:1", physicalEdgeId: "physical-read" },
  };
  const edge: GraphEdge = {
    ...record,
    tableRelations: [record, { ...record, id: "path2", from: "ctx2" }],
  };
  expect(tableRelationRecords(edge)).toHaveLength(1);
  expect(edge.tableRelations).toHaveLength(2);
  const html = renderToStaticMarkup(
    <TableRelationsPanel edges={[edge]} nodes={[]} onInspect={() => {}} />,
  );
  expect(html).toContain("read:1");
  expect(html).toContain("查看读取任务");
  expect(html).toContain("本次关系未返回分区条件");
});
