import { describe, expect, it } from "vitest";

import {
  canonicalPartitionValue,
  partitionCanonicalValuesOverlap,
} from "../../../scripts/project-graph/task-local/partition-canonical.ts";

describe("partition-canonical", () => {
  it("maps Horae business-date templates to ${YYYY-MM-DD}", () => {
    expect(canonicalPartitionValue("busi_date", "${data_day_str}")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "${yyyy-MM-dd}")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "${YYYY-MM-DD}")).toBe(
      "${YYYY-MM-DD}",
    );
  });

  it("canonicalizes ISO literals on temporal columns", () => {
    expect(canonicalPartitionValue("busi_date", "2026-09-03")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "'2026-09-03'")).toBe(
      "${YYYY-MM-DD}",
    );
  });

  it("keeps static partition keys unchanged", () => {
    expect(canonicalPartitionValue("grp_id", "01")).toBe("01");
    expect(canonicalPartitionValue("src_tbl", "ODATA_N_TIT.D_TRD_OTC_TRADE")).toBe(
      "ODATA_N_TIT.D_TRD_OTC_TRADE",
    );
  });

  it("detects overlap across template families", () => {
    expect(
      partitionCanonicalValuesOverlap(
        "busi_date",
        ["${data_day_str}"],
        ["${YYYY-MM-DD}"],
      ),
    ).toBe(true);
    expect(
      partitionCanonicalValuesOverlap(
        "busi_date",
        ["2026-09-03"],
        ["${YYYY-MM-DD}"],
      ),
    ).toBe(true);
    expect(
      partitionCanonicalValuesOverlap("grp_id", ["01"], ["02"]),
    ).toBe(false);
  });
});
