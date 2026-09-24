import { describe, expect, it } from "vitest";
import {
  tableRelationRecordCount,
  tableRelationStrokeWidth,
} from "./table-relations";
import type { GraphEdge } from "./types";

function relation(id: string): GraphEdge {
  return {
    id,
    from: "dataset:source",
    to: "task:consumer",
    kind: "READS_TABLE",
  };
}

describe("table relation visual weight", () => {
  it("counts unique relation records rather than duplicate query paths", () => {
    const first = relation("read:1");
    const displayEdge: GraphEdge = {
      ...first,
      tableRelations: [first, { ...first }, relation("read:2")],
    };

    expect(tableRelationRecordCount(displayEdge)).toBe(2);
  });

  it.each([
    [1, 1.5],
    [2, 2.5],
    [3, 2.5],
    [4, 3.5],
    [7, 3.5],
    [8, 5],
    [20, 5],
  ])("maps %i records to a bounded %fpx line", (count, width) => {
    const records = Array.from({ length: count }, (_, index) =>
      relation(`read:${index}`),
    );
    expect(tableRelationStrokeWidth({
      ...records[0]!,
      tableRelations: records,
    })).toBe(width);
  });
});
