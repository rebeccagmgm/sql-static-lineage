import {describe, expect, it} from "vitest";
import {partitionFields} from "./partition-fields";
import {fieldChoices} from "./components/FieldSelector";
import {partitionOptions} from "../../data-graph/src/asset-graph/partition-selection";
import {createExplorationEntry, readExplorationEntries, writeExplorationEntries, explorationMember} from "./exploration-entries";
import type {GraphNode} from "./types";
const field = (id: string, group: string): GraphNode => ({id, kind: "WRITE_FIELD", taskId: "1", table: "dm.a", column: "name", writeId: id, detail: {partition: [{column: "grp_id", values: [group]}]}});
describe("partition fields", () => {
  it("retains the exact partition selection through save and reopen", () => {
    const selection = {datasetId: "dataset:a", version: "v", optionIds: ["choice"]};
    const member = explorationMember({nodeId: "dataset:a", label: "dm.a", partitionSelection: selection});
    const entry = createExplorationEntry({id: "saved", name: "分区专题", description: "", graphVersion: "v", member,
      state: {layer: "table", direction: "up", depth: 2, candidates: true, selectedFieldIds: [], expandedCandidateIds: [], viewport: {x: 0,y: 0,zoom: 1}}, now: "2026-09-14"});
    const memory = new Map<string, string>();
    const storage = {getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => {memory.set(key, value);}};
    writeExplorationEntries(storage, [entry]);
    expect(readExplorationEntries(storage).entries[0]!.members[0]!.anchor.partitionSelection).toEqual(selection);
  });
  it("filters write occurrences before same-task field rows merge", () => {
    const fields = [field("w1", "01"), field("w2", "02")];
    const options = partitionOptions(fields.map(f => ({taskId: "1", writeId: f.id, targetId: "", datasetId: "dataset:a", partition: f.detail!.partition as unknown[]})));
    const selection = {datasetId: "dataset:a", version: "v", optionIds: [options[1]!.id]};
    expect(fieldChoices(partitionFields(fields, selection), "", "")[0]!.members.map(f => f.id)).toEqual(["w2"]);
    expect(partitionFields(fields, {...selection, optionIds: options.map(o => o.id)})).toHaveLength(2);
    expect(partitionFields(fields)).toHaveLength(2);
  });
});
