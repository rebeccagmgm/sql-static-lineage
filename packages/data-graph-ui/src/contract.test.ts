import { describe, expect, it } from "vitest";
import { isSameGraphVersion, normalizeRegionItems } from "./contract";

describe("API boundary helpers", () => {
  it("makes region dataset rows selectable without inventing a new identity", () => {
    const [item] = normalizeRegionItems([
      {
        id: "dataset:physical:1",
        table: "pdata_n.member",
        label: "member",
        kind: "",
      },
    ]);
    expect(item).toMatchObject({
      id: "dataset:physical:1",
      table: "pdata_n.member",
      kind: "PHYSICAL_DATASET",
    });
  });

  it("fails closed when evidence belongs to a different graph version", () => {
    expect(isSameGraphVersion("version-a", "version-b")).toBe(false);
    expect(isSameGraphVersion("version-a", "version-a")).toBe(true);
  });
});
