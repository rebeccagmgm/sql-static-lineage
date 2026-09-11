import { describe, expect, it } from "vitest";
import { fieldChoices, taskOptions, toggleAllVisible } from "./FieldSelector";
import type { GraphNode } from "../types";
const fields: GraphNode[] = [
  {
    id: "a1",
    kind: "WRITE_FIELD",
    taskId: "10",
    column: "amount",
    writeId: "write-b",
  },
  {
    id: "a2",
    kind: "WRITE_FIELD",
    taskId: "10",
    column: "amount",
    writeId: "write-c",
  },
  {
    id: "b1",
    kind: "WRITE_FIELD",
    taskId: "2",
    column: "amount",
    writeId: "write-a",
  },
  {
    id: "b2",
    kind: "WRITE_FIELD",
    taskId: "2",
    column: "date",
    writeId: "write-a",
  },
  {
    id: "c1",
    kind: "WRITE_FIELD",
    taskId: "2",
    column: "prcg_date",
    metadata: {
      table: { status: "AVAILABLE" as const, description: "定价指标表" },
      field: { status: "AVAILABLE" as const, comment: "定价日期" },
    },
  },
].map(field => ({...field, table:"dm.output"}));
describe("FieldSelector helpers", () => {
  it("counts and numerically orders exact scheduling IDs", () =>
    expect(taskOptions(fields)).toEqual([
      { taskId: "2", count: 3 },
      { taskId: "10", count: 1 },
    ]));
  it("keeps task filtering separate from field-name search", () =>
    expect(
      fieldChoices(fields, "2", "amo").map(({ field }) => field.id),
    ).toEqual(["b1"]));
  it("searches Chinese comments only in the current loaded field scope", () =>
    expect(fieldChoices(fields, "2", "定价日期").map(({ field }) => field.id)).toEqual([
      "c1",
    ]));
  it("groups the same physical field and retains all write members", () =>
    expect(
      fieldChoices(fields, "10", "").map(
        ({ members }) => members.map(field => field.id),
      ),
    ).toEqual([["a1", "a2"]]));
  it("keeps other tables and ambiguous table identities separate", () => {
    const rows = [fields[0]!, {...fields[1]!,table:"temp.output"}];
    expect(fieldChoices(rows,"","")).toHaveLength(2);
    expect(fieldChoices(rows.map(field=>({...field,table:undefined})),"","")).toHaveLength(2);
  });
  it("keeps the entire group when only an alias comment matches", () => {
    const rows = [fields[0]!, {...fields[1]!,metadata:{table:{status:"AVAILABLE" as const},field:{status:"AVAILABLE" as const,comment:"金额"}}}];
    expect(fieldChoices(rows,"","金额")[0]?.members.map(field=>field.id)).toEqual(["a1","a2"]);
  });
  it("selects and clears only the current filtered fields", () => {
    expect(toggleAllVisible(["hidden"], ["a1", "a2"], true)).toEqual([
      "hidden",
      "a1",
      "a2",
    ]);
    expect(
      toggleAllVisible(["hidden", "a1", "a2"], ["a1", "a2"], false),
    ).toEqual(["hidden"]);
  });
});
