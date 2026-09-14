import { describe, expect, it } from "vitest";
import { partitionOptions, selectedPartitionWrites, parsePartitionSelection, type PartitionWrite } from "../src/asset-graph/partition-selection.ts";
const write = (id: string, group: string, date = "2026-09-14"): PartitionWrite => ({ taskId: "1", writeId: id, targetId: id, datasetId: "dataset:a", partition: [{ column: "grp_id", values: [group] }, { column: "busi_date", values: [date] }] });
describe("business partition selection", () => {
  it("ignores day in the selector but preserves it in write evidence", () => {
    const options = partitionOptions([write("w1", "01"), write("w2", "01", "2026-09-13"), write("w3", "02")]);
    expect(options).toHaveLength(2);
    expect(options[0]!.writes).toHaveLength(2);
    expect(options[0]!.writes[1]!.partition).toContainEqual({ column: "busi_date", values: ["2026-09-13"] });
  });
  it("selects exact writes, supports unions, and rejects stale or missing options", () => {
    const options = partitionOptions([write("w1", "01"), write("w2", "02")]);
    const c = { datasetId: "dataset:a", version: "v1", options, ignoredDateColumns: [] };
    const s = { datasetId: c.datasetId, version: c.version, optionIds: [options[1]!.id] };
    expect(selectedPartitionWrites(c, s).map(w => w.writeId)).toEqual(["w2"]);
    expect(selectedPartitionWrites(c, {...s, optionIds: options.map(o => o.id)})).toHaveLength(2);
    expect(() => selectedPartitionWrites(c, {...s, version: "v2"})).toThrow("VERSION_CHANGED");
    expect(() => selectedPartitionWrites(c, {...s, optionIds: ["missing"]})).toThrow("INVALID");
  });
  it("does not flatten alternatives, infer unknown values or hide month partitions", () => {
    const options = partitionOptions([{...write("w1", "01"), partition: [{column: "busi_mon", values: ["202609"]}]}, {...write("w2", "02"), partition: [{column: "grp_id", values: [], partitionStatus: "DYNAMIC"}]}]);
    expect(options[0]!.label).toBe("busi_mon=202609");
    expect(options[1]!.unknown).toBe(true);
    expect(() => parsePartitionSelection('{"datasetId":"bad"}')).toThrow("INVALID");
  });
});
