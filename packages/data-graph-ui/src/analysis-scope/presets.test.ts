import { describe, expect, it } from "vitest";
import { analysisScopeUrl, presetFromSearch, PRESETS } from "./presets";

describe("presets in the existing analysis workspace", () => {
  it("opens all former custody links in the same workspace with the original task scope", () => {
    expect(
      presetFromSearch("?topic=custody")?.members.map((m) => m.value),
    ).toEqual(["156181", "164968", "156192", "156763", "228530", "228532"]);
    expect(
      presetFromSearch("?topic=custody&view=monitor")?.members.map(
        (m) => m.value,
      ),
    ).toEqual(["101329", "200759"]);
    expect(
      presetFromSearch("?topic=custody&view=product")?.members.map(
        (m) => m.value,
      ),
    ).toEqual(["71716"]);
    expect(
      PRESETS.find((p) => p.id === "tit-party-types")?.members,
    ).toHaveLength(2);
    expect(PRESETS.find((p) => p.id === "tit-party-all")?.members).toHaveLength(
      23,
    );
  });
  it("normalizes the old URL and removes the preset when saving a custom range", () => {
    const migrated = analysisScopeUrl(
      "http://localhost/?topic=custody&view=monitor",
      "custody-monitor",
    );
    expect(migrated).toBe("http://localhost/?analysis=1&scope=custody-monitor");
    expect(presetFromSearch(new URL(migrated).search)?.id).toBe(
      "custody-monitor",
    );
    expect(analysisScopeUrl(migrated)).toBe("http://localhost/?analysis=1");
    expect(presetFromSearch("?scope=unknown")).toBeUndefined();
  });
});
