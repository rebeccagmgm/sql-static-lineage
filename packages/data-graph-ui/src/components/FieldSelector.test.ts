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
];
describe("FieldSelector helpers", () => {
  it("counts and numerically orders exact scheduling IDs", () =>
    expect(taskOptions(fields)).toEqual([
      { taskId: "2", count: 2 },
      { taskId: "10", count: 2 },
    ]));
  it("keeps task filtering separate from field-name search", () =>
    expect(
      fieldChoices(fields, "2", "amo").map(({ field }) => field.id),
    ).toEqual(["b1"]));
  it("labels same-task same-column writes without displaying write IDs", () =>
    expect(
      fieldChoices(fields, "10", "").map(
        ({ occurrenceLabel }) => occurrenceLabel,
      ),
    ).toEqual(["写入 1/2", "写入 2/2"]));
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
